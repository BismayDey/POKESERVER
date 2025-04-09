import { io } from "socket.io-client";

// Use the deployed server URL
const SOCKET_URL = "https://pokeserver-1.onrender.com";

export const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  path: "/socket.io",
  withCredentials: false,
  extraHeaders: {
    "Access-Control-Allow-Origin": "*",
  },
});

// Connection state management
let isReconnecting = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
let heartbeatInterval: NodeJS.Timeout;
let lastHeartbeat = Date.now();

// Heartbeat to keep connection alive
const startHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit("heartbeat");

      // Check if we haven't received a heartbeat response in a while
      if (Date.now() - lastHeartbeat > 10000) {
        console.log("No heartbeat response, reconnecting...");
        reconnectSocket();
      }
    }
  }, 5000);
};

socket.on("heartbeat_ack", () => {
  lastHeartbeat = Date.now();
});

// Enhanced connection handling
socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
  reconnectAttempts = 0;
  isReconnecting = false;
  startHeartbeat();
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
  handleReconnection();
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  if (reason === "io server disconnect" || reason === "transport close") {
    handleReconnection();
  }
});

const handleReconnection = () => {
  if (!isReconnecting && reconnectAttempts < maxReconnectAttempts) {
    isReconnecting = true;
    reconnectAttempts++;

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
    setTimeout(() => {
      isReconnecting = false;
      reconnectSocket();
    }, delay);
  }
};

// Match synchronization with acknowledgment
socket.on("matchFound", (data) => {
  console.log("Match found:", data);
  socket.emit("matchAcknowledged", {
    matchId: data.matchId,
    userId: data.userId,
  });
});

socket.on("matchConfirmed", (data) => {
  console.log("Match confirmed:", data);
});

socket.on("matchStarted", (data) => {
  console.log("Match started:", data);
});

// Game state synchronization
socket.on("gameState", (state) => {
  console.log("Received game state:", state);
});

socket.on("playerAction", (action) => {
  console.log("Received player action:", action);
});

// Cleanup function
export const cleanup = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  socket.disconnect();
};

// Reconnection helper
export const reconnectSocket = () => {
  if (!socket.connected && !isReconnecting) {
    socket.connect();
  }
};

// Keep track of the current match
let currentMatchId: string | null = null;

export const setCurrentMatch = (matchId: string | null) => {
  currentMatchId = matchId;
};

export const getCurrentMatch = () => currentMatchId;

// Rejoin match after reconnection
socket.on("connect", () => {
  if (currentMatchId) {
    socket.emit("rejoinMatch", { matchId: currentMatchId });
  }
});
