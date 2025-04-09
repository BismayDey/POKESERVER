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
const playerMatches = new Map(); // Track which match each player is in

// Middleware to handle connection timeouts
io.use((socket, next) => {
  const playerId = socket.handshake.auth.playerId;
  if (playerId) {
    socket.playerId = playerId;
    const existingSocket = connectedPlayers.get(playerId);
    if (existingSocket && existingSocket.id !== socket.id) {
      existingSocket.disconnect();
      connectedPlayers.delete(playerId);
    }
  }
  next();
});

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Heartbeat mechanism
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
        match.status = "active";
      }
    }
  });

  socket.on("rejoinMatch", ({ matchId }) => {
    const match = activeMatches.get(matchId);
    if (match) {
      const player =
        match.player1.socketId === socket.id ? match.player1 : match.player2;
      if (player) {
        socket.join(matchId);
        io.to(matchId).emit("playerRejoined", {
          playerId: player.socketId,
          matchState: match.state,
        });
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

    // Keep the match active for a while to allow reconnection
    setTimeout(() => {
      const updatedMatch = activeMatches.get(match.id);
      if (updatedMatch && updatedMatch.status !== "active") {
        activeMatches.delete(match.id);
        playerMatches.delete(socketId);
        playerMatches.delete(opponent.socketId);
      }
    }, 30000);
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
  const matchId = playerMatches.get(socketId);
  if (matchId) {
    return activeMatches.get(matchId);
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
      state: {
        player1Pokemon: null,
        player2Pokemon: null,
        currentTurn: "player1",
      },
    };

    activeMatches.set(matchId, match);
    playerMatches.set(player1.socketId, matchId);
    playerMatches.set(player2.socketId, matchId);

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
    if (now - match.startTime > 10 * 60 * 1000) {
      // 10 minutes timeout
      const { player1, player2 } = match;
      [player1, player2].forEach((player) => {
        if (player && io.sockets.sockets.get(player.socketId)) {
          io.to(player.socketId).emit("matchTimeout");
        }
        playerMatches.delete(player.socketId);
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
