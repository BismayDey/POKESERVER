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
    if (io.sockets.sockets.has(player.socketId)) {
      io.to(player.socketId).emit("queueUpdate", {
        position: index + 1,
        totalPlayers: queue.length,
        estimatedWaitTime: calculateWaitTime(index + 1),
      });
    }
  });
}

function calculateWaitTime(position) {
  return position * 30; // 30 seconds per position
}

function verifyPlayersConnected(socketId1, socketId2) {
  return io.sockets.sockets.has(socketId1) && io.sockets.sockets.has(socketId2);
}

async function checkForMatch() {
  if (queue.length >= 2) {
    const player1 = queue[0];
    const player2 = queue[1];

    // Verify both players are still connected
    if (!verifyPlayersConnected(player1.socketId, player2.socketId)) {
      // Clean up disconnected players
      if (!io.sockets.sockets.has(player1.socketId)) {
        removeFromQueue(player1.socketId);
        connectedPlayers.delete(player1.socketId);
      }
      if (!io.sockets.sockets.has(player2.socketId)) {
        removeFromQueue(player2.socketId);
        connectedPlayers.delete(player2.socketId);
      }
      return;
    }

    // Remove from queue
    queue.shift();
    queue.shift();

    // Set opponents
    player1.opponent = player2;
    player2.opponent = player1;
    connectedPlayers.set(player1.socketId, player1);
    connectedPlayers.set(player2.socketId, player2);

    // Create match record
    const matchId = `match-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 8)}`;
    activeMatches.set(matchId, {
      players: [player1, player2],
      startedAt: new Date().toISOString(),
      lastActivity: Date.now(),
    });

    try {
      // Notify both players with acknowledgement
      await Promise.all([
        new Promise((resolve, reject) => {
          io.to(player1.socketId)
            .timeout(5000)
            .emit(
              "matchFound",
              {
                matchId,
                opponent: {
                  username: player2.username,
                  rating: player2.rating,
                  stats: player2.stats,
                },
              },
              (err) => {
                if (err) reject(`Player1 notification failed: ${err}`);
                else resolve();
              }
            );
        }),
        new Promise((resolve, reject) => {
          io.to(player2.socketId)
            .timeout(5000)
            .emit(
              "matchFound",
              {
                matchId,
                opponent: {
                  username: player1.username,
                  rating: player1.rating,
                  stats: player1.stats,
                },
              },
              (err) => {
                if (err) reject(`Player2 notification failed: ${err}`);
                else resolve();
              }
            );
        }),
      ]);

      updateQueuePositions();
    } catch (error) {
      console.error("Match setup failed:", error);
      handleFailedMatch(player1, player2);
    }
  }
}

function handleFailedMatch(player1, player2) {
  // Clean up references
  connectedPlayers.delete(player1.socketId);
  connectedPlayers.delete(player2.socketId);

  // Put players back in queue if they're still connected
  if (io.sockets.sockets.has(player1.socketId)) {
    queue.unshift(player1);
    io.to(player1.socketId).emit(
      "matchFailed",
      "Connection issue with opponent"
    );
  }
  if (io.sockets.sockets.has(player2.socketId)) {
    queue.unshift(player2);
    io.to(player2.socketId).emit(
      "matchFailed",
      "Connection issue with opponent"
    );
  }

  updateQueuePositions();
}

function cleanupMatch(socketId) {
  const player = connectedPlayers.get(socketId);
  if (!player) return;

  if (player.opponent) {
    const opponent = connectedPlayers.get(player.opponent.socketId);
    if (opponent) {
      // Clear opponent's reference
      opponent.opponent = null;
      connectedPlayers.set(opponent.socketId, opponent);

      // Notify opponent
      if (io.sockets.sockets.has(opponent.socketId)) {
        io.to(opponent.socketId).emit("opponentLeft");
      }
    }

    // Remove from active matches
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
  const heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit("ping");
    }
  }, 10000);

  socket.on("pong", () => {
    // Connection is alive
  });

  socket.on("joinQueue", (playerData, callback) => {
    try {
      if (!playerData?.username || !playerData?.rating) {
        throw new Error("Missing required player data");
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

      callback({ success: true });
    } catch (error) {
      console.error("Join queue error:", error.message);
      callback({ success: false, error: error.message });
    }
  });

  socket.on("leaveQueue", () => {
    removeFromQueue(socket.id);
    connectedPlayers.delete(socket.id);
    updateQueuePositions();
  });

  socket.on("pokemonSelected", (data) => {
    const player = connectedPlayers.get(socket.id);
    if (player?.opponent && io.sockets.sockets.has(player.opponent.socketId)) {
      io.to(player.opponent.socketId).emit("pokemonSelected", {
        ...data,
        username: player.username,
      });
    }
  });

  socket.on("attack", (data) => {
    const player = connectedPlayers.get(socket.id);
    if (player?.opponent && io.sockets.sockets.has(player.opponent.socketId)) {
      io.to(player.opponent.socketId).emit("attackPerformed", {
        ...data,
        username: player.username,
      });
    }
  });

  socket.on("rejoinMatch", ({ matchId }, callback) => {
    const match = activeMatches.get(matchId);
    if (!match) {
      return callback({ success: false, error: "Match not found" });
    }

    const player = match.players.find((p) => p.socketId === socket.id);
    if (!player) {
      return callback({ success: false, error: "Not part of this match" });
    }

    // Update socket reference
    player.socketId = socket.id;
    connectedPlayers.set(socket.id, player);

    // Notify opponent
    const opponent = player.opponent;
    if (opponent && io.sockets.sockets.has(opponent.socketId)) {
      io.to(opponent.socketId).emit("opponentReconnected");
    }

    callback({ success: true });
  });

  socket.on("disconnect", (reason) => {
    clearInterval(heartbeatInterval);
    console.log(`Player disconnected: ${socket.id} (Reason: ${reason})`);
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
