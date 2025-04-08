import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      "https://pokeserver-beta.vercel.app",
      "https://pokemon-fight-sandy.vercel.app",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  path: "/socket.io",
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

app.use(
  cors({
    origin: [
      "https://pokeserver-beta.vercel.app",
      "https://pokemon-fight-sandy.vercel.app",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
app.use(express.json());

// Store connected players and queue
const connectedPlayers = new Map();
const queue = [];
const activeMatches = new Map();

// Basic routes
app.get("/", (req, res) => {
  res.json({
    status: "online",
    playersConnected: io.engine.clientsCount,
    playersInQueue: queue.length,
    activeMatches: activeMatches.size,
    uptime: process.uptime(),
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Handle heartbeat
  socket.on("heartbeat", () => {
    socket.emit("heartbeat_ack");
  });

  socket.on("joinQueue", (playerData) => {
    const player = {
      socketId: socket.id,
      ...playerData,
      lastActive: Date.now(),
    };

    // Remove player from queue if already in it
    removeFromQueue(socket.id);

    // Add player to queue
    queue.push(player);
    connectedPlayers.set(socket.id, player);

    // Update all players with new queue status
    io.emit("queueUpdate", {
      position: queue.indexOf(player) + 1,
      totalPlayers: queue.length,
    });

    // Check for match
    checkForMatch();
  });

  socket.on("leaveQueue", () => {
    removeFromQueue(socket.id);
    connectedPlayers.delete(socket.id);
    updateQueuePositions();
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    handlePlayerDisconnect(socket.id);
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

  // Send initial queue status
  socket.emit("queueUpdate", {
    position: queue.length,
    totalPlayers: queue.length,
  });
});

function removeFromQueue(socketId) {
  const index = queue.findIndex((player) => player.socketId === socketId);
  if (index !== -1) {
    queue.splice(index, 1);
  }
}

function updateQueuePositions() {
  queue.forEach((player, index) => {
    io.to(player.socketId).emit("queueUpdate", {
      position: index + 1,
      totalPlayers: queue.length,
    });
  });
}

function findMatchByPlayerId(socketId) {
  for (const [matchId, match] of activeMatches) {
    if (
      match.player1.socketId === socketId ||
      match.player2.socketId === socketId
    ) {
      return match;
    }
  }
  return null;
}

function handlePlayerDisconnect(socketId) {
  const match = findMatchByPlayerId(socketId);
  if (match) {
    const opponent =
      match.player1.socketId === socketId ? match.player2 : match.player1;
    io.to(opponent.socketId).emit("opponentLeft");
    activeMatches.delete(match.id);
  }

  removeFromQueue(socketId);
  connectedPlayers.delete(socketId);
  updateQueuePositions();
}

function checkForMatch() {
  if (queue.length >= 2) {
    const player1 = queue.shift();
    const player2 = queue.shift();

    const matchId = `match_${Date.now()}_${player1.socketId}_${
      player2.socketId
    }`;
    const match = {
      id: matchId,
      player1,
      player2,
      startTime: Date.now(),
    };

    activeMatches.set(matchId, match);

    // Notify both players
    io.to(player1.socketId).emit("matchFound", {
      matchId,
      opponent: {
        username: player2.username,
        rating: player2.rating,
        stats: player2.stats,
      },
    });

    io.to(player2.socketId).emit("matchFound", {
      matchId,
      opponent: {
        username: player1.username,
        rating: player1.rating,
        stats: player1.stats,
      },
    });

    // Update queue positions for remaining players
    updateQueuePositions();
  }
}

// Clean up inactive matches periodically
setInterval(() => {
  const now = Date.now();
  for (const [matchId, match] of activeMatches) {
    if (now - match.startTime > 30 * 60 * 1000) {
      // 30 minutes timeout
      io.to(match.player1.socketId).emit("matchTimeout");
      io.to(match.player2.socketId).emit("matchTimeout");
      activeMatches.delete(matchId);
    }
  }
}, 60000);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
