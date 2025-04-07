import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const httpServer = createServer(app);

// Configuration
const PORT = process.env.PORT || 3001;
const allowedOrigins = [
  "https://pokeserver-beta.vercel.app",
  "http://localhost:5173",
];

// Initialize Socket.io with enhanced settings
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
  pingInterval: 10000, // Send ping every 10 seconds
  pingTimeout: 5000, // Wait 5 seconds for pong response
});

// Middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

// Game state
const connectedPlayers = new Map();
const queue = [];
const activeMatches = new Map();

// Helper functions
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
      estimatedWaitTime: calculateWaitTime(index + 1),
    });
  });
}

function calculateWaitTime(position) {
  // Simple estimation: average 30 seconds per position
  return position * 30;
}

function checkForMatch() {
  if (queue.length >= 2) {
    const [player1, player2] = queue.splice(0, 2);

    // Set opponents
    player1.opponent = player2;
    player2.opponent = player1;

    // Update connected players
    connectedPlayers.set(player1.socketId, player1);
    connectedPlayers.set(player2.socketId, player2);

    // Create match record
    const matchId = `${player1.socketId}-${player2.socketId}-${Date.now()}`;
    activeMatches.set(matchId, {
      players: [player1, player2],
      startedAt: new Date().toISOString(),
    });

    // Notify players
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

    updateQueuePositions();
  }
}

function cleanupMatch(socketId) {
  const player = connectedPlayers.get(socketId);
  if (player && player.opponent) {
    const opponent = connectedPlayers.get(player.opponent.socketId);
    if (opponent) {
      io.to(opponent.socketId).emit("opponentLeft");
      opponent.opponent = null;
    }

    // Remove match from active matches
    for (const [matchId, match] of activeMatches.entries()) {
      if (match.players.some((p) => p.socketId === socketId)) {
        activeMatches.delete(matchId);
        break;
      }
    }
  }
}

// Routes
app.get("/", (req, res) => {
  res.json({
    status: "online",
    playersConnected: io.engine.clientsCount,
    playersInQueue: queue.length,
    activeMatches: activeMatches.size,
    uptime: process.uptime(),
    serverTime: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Socket.io events
io.on("connection", (socket) => {
  console.log(
    `Player connected: ${socket.id} (Total: ${io.engine.clientsCount})`
  );

  // Heartbeat mechanism
  socket.on("ping", (cb) => cb());

  socket.on("joinQueue", (playerData) => {
    if (!playerData.username || !playerData.rating) {
      return socket.emit("error", "Missing required player data");
    }

    const player = {
      socketId: socket.id,
      joinedAt: new Date().toISOString(),
      ...playerData,
    };

    removeFromQueue(socket.id);
    queue.push(player);
    connectedPlayers.set(socket.id, player);

    updateQueuePositions();
    checkForMatch();
  });

  socket.on("leaveQueue", () => {
    removeFromQueue(socket.id);
    connectedPlayers.delete(socket.id);
    updateQueuePositions();
  });

  socket.on("pokemonSelected", (data) => {
    const player = connectedPlayers.get(socket.id);
    if (player?.opponent) {
      io.to(player.opponent.socketId).emit("pokemonSelected", {
        ...data,
        username: player.username,
      });
    }
  });

  socket.on("attack", (data) => {
    const player = connectedPlayers.get(socket.id);
    if (player?.opponent) {
      io.to(player.opponent.socketId).emit("attackPerformed", {
        ...data,
        username: player.username,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    cleanupMatch(socket.id);
    removeFromQueue(socket.id);
    connectedPlayers.delete(socket.id);
    updateQueuePositions();
  });

  // Initial queue status
  socket.emit("queueUpdate", {
    position: queue.length + 1,
    totalPlayers: queue.length,
    estimatedWaitTime: calculateWaitTime(queue.length + 1),
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});
