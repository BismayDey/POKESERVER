import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const httpServer = createServer(app);

// Configure CORS for both Express and Socket.IO
const allowedOrigins = [
  "https://pokeserver-beta.vercel.app",
  "https://pokemon-fight-sandy.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  path: "/socket.io",
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
  allowEIO3: true,
  maxHttpBufferSize: 1e8,
});

// Store active connections and matches
const connectedPlayers = new Map();
const activeMatches = new Map();
const queue = [];

// Middleware to handle connection timeouts
io.use((socket, next) => {
  const playerId = socket.handshake.auth.playerId;
  if (playerId) {
    socket.playerId = playerId;
    const existingSocket = connectedPlayers.get(playerId);
    if (existingSocket) {
      existingSocket.disconnect();
      connectedPlayers.delete(playerId);
    }
  }
  next();
});

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("heartbeat", () => {
    socket.emit("heartbeat_ack");
  });

  socket.on("joinQueue", (playerData) => {
    const player = {
      socketId: socket.id,
      ...playerData,
      lastActive: Date.now(),
    };

    removeFromQueue(socket.id);
    queue.push(player);
    connectedPlayers.set(socket.id, player);

    updateQueueStatus();
    checkForMatch();
  });

  socket.on("matchAcknowledged", ({ matchId }) => {
    const match = activeMatches.get(matchId);
    if (match) {
      match.acknowledgedBy = match.acknowledgedBy || new Set();
      match.acknowledgedBy.add(socket.id);

      if (match.acknowledgedBy.size === 2) {
        io.to(match.player1.socketId).emit("matchConfirmed");
        io.to(match.player2.socketId).emit("matchConfirmed");
      }
    }
  });

  socket.on("disconnect", (reason) => {
    handleDisconnect(socket.id, reason);
  });

  socket.on("pokemonSelected", (data) => {
    const match = findMatchByPlayerId(socket.id);
    if (match) {
      const opponent =
        match.player1.socketId === socket.id ? match.player2 : match.player1;
      io.to(opponent.socketId).emit("pokemonSelected", {
        ...data,
        username: connectedPlayers.get(socket.id)?.username,
      });
    }
  });

  socket.on("attack", (data) => {
    const match = findMatchByPlayerId(socket.id);
    if (match) {
      const opponent =
        match.player1.socketId === socket.id ? match.player2 : match.player1;
      io.to(opponent.socketId).emit("attackPerformed", {
        ...data,
        username: connectedPlayers.get(socket.id)?.username,
      });
    }
  });
});

function handleDisconnect(socketId, reason) {
  console.log(`Player disconnected (${socketId}):`, reason);

  const match = findMatchByPlayerId(socketId);
  if (match) {
    const opponent =
      match.player1.socketId === socketId ? match.player2 : match.player1;
    if (opponent && io.sockets.sockets.get(opponent.socketId)) {
      io.to(opponent.socketId).emit("opponentDisconnected", {
        reason,
        reconnectionAllowed: reason !== "client namespace disconnect",
      });
    }

    setTimeout(() => {
      const updatedMatch = activeMatches.get(match.id);
      if (updatedMatch && !updatedMatch.acknowledgedBy?.has(socketId)) {
        activeMatches.delete(match.id);
      }
    }, 10000);
  }

  removeFromQueue(socketId);
  connectedPlayers.delete(socketId);
  updateQueueStatus();
}

function updateQueueStatus() {
  queue.forEach((player, index) => {
    io.to(player.socketId).emit("queueUpdate", {
      position: index + 1,
      totalPlayers: queue.length,
    });
  });
}

function findMatchByPlayerId(socketId) {
  for (const [, match] of activeMatches) {
    if (
      match.player1.socketId === socketId ||
      match.player2.socketId === socketId
    ) {
      return match;
    }
  }
  return null;
}

function removeFromQueue(socketId) {
  const index = queue.findIndex((player) => player.socketId === socketId);
  if (index !== -1) {
    queue.splice(index, 1);
  }
}

function checkForMatch() {
  while (queue.length >= 2) {
    const player1 = queue.shift();
    const player2 = queue.shift();

    if (!player1 || !player2) continue;

    const matchId = `match_${Date.now()}_${player1.socketId}_${
      player2.socketId
    }`;
    const match = {
      id: matchId,
      player1,
      player2,
      startTime: Date.now(),
      status: "pending",
    };

    activeMatches.set(matchId, match);

    [player1, player2].forEach((player, index) => {
      const opponent = index === 0 ? player2 : player1;
      io.to(player.socketId).emit("matchFound", {
        matchId,
        opponent: {
          username: opponent.username,
          rating: opponent.rating,
          stats: opponent.stats,
        },
      });
    });
  }
}

// Cleanup inactive matches and disconnected players
setInterval(() => {
  const now = Date.now();

  // Clean up inactive matches
  for (const [matchId, match] of activeMatches) {
    if (now - match.startTime > 5 * 60 * 1000) {
      // 5 minutes timeout
      const { player1, player2 } = match;
      [player1, player2].forEach((player) => {
        if (player && io.sockets.sockets.get(player.socketId)) {
          io.to(player.socketId).emit("matchTimeout");
        }
      });
      activeMatches.delete(matchId);
    }
  }

  // Clean up disconnected players
  for (const [socketId, player] of connectedPlayers) {
    if (!io.sockets.sockets.get(socketId)) {
      connectedPlayers.delete(socketId);
      removeFromQueue(socketId);
    }
  }
}, 30000);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    connections: io.engine.clientsCount,
    activeMatches: activeMatches.size,
    queueLength: queue.length,
    uptime: process.uptime(),
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
