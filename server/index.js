import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["https://pokemon-fight-sandy.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
  path: '/socket.io'
});

app.use(cors({
  origin: ["https://pokemon-fight-sandy.vercel.app", "http://localhost:5173"],
  credentials: true
}));
app.use(express.json());

// Basic routes
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    playersConnected: io.engine.clientsCount,
    playersInQueue: queue.length,
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Store connected players and queue
const connectedPlayers = new Map();
const queue = [];

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinQueue', (playerData) => {
    const player = {
      socketId: socket.id,
      ...playerData
    };
    
    // Remove player from queue if already in it
    removeFromQueue(socket.id);
    
    // Add player to queue
    queue.push(player);
    connectedPlayers.set(socket.id, player);
    
    // Update all players with new queue status
    io.emit('queueUpdate', {
      position: queue.indexOf(player) + 1,
      totalPlayers: queue.length
    });

    // Check for match
    checkForMatch();
  });

  socket.on('leaveQueue', () => {
    removeFromQueue(socket.id);
    connectedPlayers.delete(socket.id);
    updateQueuePositions();
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const player = connectedPlayers.get(socket.id);
    
    // Notify opponent if player was in a match
    if (player && player.opponent) {
      io.to(player.opponent.socketId).emit('opponentLeft');
    }
    
    removeFromQueue(socket.id);
    connectedPlayers.delete(socket.id);
    updateQueuePositions();
  });

  socket.on('pokemonSelected', (data) => {
    // Broadcast pokemon selection to opponent
    const player = connectedPlayers.get(socket.id);
    if (player && player.opponent) {
      io.to(player.opponent.socketId).emit('pokemonSelected', {
        ...data,
        username: player.username
      });
    }
  });

  socket.on('attack', (data) => {
    // Broadcast attack to opponent
    const player = connectedPlayers.get(socket.id);
    if (player && player.opponent) {
      io.to(player.opponent.socketId).emit('attackPerformed', {
        ...data,
        username: player.username
      });
    }
  });

  // Send initial queue status
  socket.emit('queueUpdate', {
    position: queue.length,
    totalPlayers: queue.length
  });
});

function removeFromQueue(socketId) {
  const index = queue.findIndex(player => player.socketId === socketId);
  if (index !== -1) {
    queue.splice(index, 1);
  }
}

function updateQueuePositions() {
  queue.forEach((player, index) => {
    io.to(player.socketId).emit('queueUpdate', {
      position: index + 1,
      totalPlayers: queue.length
    });
  });
}

function checkForMatch() {
  if (queue.length >= 2) {
    const player1 = queue.shift();
    const player2 = queue.shift();

    // Set opponents
    connectedPlayers.get(player1.socketId).opponent = player2;
    connectedPlayers.get(player2.socketId).opponent = player1;

    // Notify both players
    io.to(player1.socketId).emit('matchFound', {
      opponent: {
        username: player2.username,
        rating: player2.rating,
        stats: player2.stats
      }
    });

    io.to(player2.socketId).emit('matchFound', {
      opponent: {
        username: player1.username,
        rating: player1.rating,
        stats: player1.stats
      }
    });

    // Update queue positions for remaining players
    updateQueuePositions();
  }
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});