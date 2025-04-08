import { io } from "socket.io-client";

// Use the deployed server URL
const SOCKET_URL = "https://pokeserver-1.onrender.com";

export const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  path: "/socket.io",
  withCredentials: false,
  extraHeaders: {
    "Access-Control-Allow-Origin": "*",
  },
});

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
  reconnectAttempts = 0;
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
  reconnectAttempts++;

  if (reconnectAttempts < maxReconnectAttempts) {
    setTimeout(() => {
      if (socket.io.opts.transports.includes("websocket")) {
        socket.io.opts.transports = ["polling", "websocket"];
      }
      socket.connect();
    }, Math.min(1000 * Math.pow(2, reconnectAttempts), 10000));
  }
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
  if (
    reason === "io server disconnect" ||
    reason === "transport close" ||
    reason === "transport error"
  ) {
    setTimeout(() => {
      if (!socket.connected && reconnectAttempts < maxReconnectAttempts) {
        socket.connect();
      }
    }, 1000);
  }
});

// Heartbeat mechanism
let heartbeatInterval: NodeJS.Timeout;
let missedHeartbeats = 0;
const maxMissedHeartbeats = 3;

socket.on("connect", () => {
  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      missedHeartbeats = 0;
      socket.emit("heartbeat");
      socket.timeout(5000).emit("heartbeat", () => {
        missedHeartbeats++;
        if (missedHeartbeats >= maxMissedHeartbeats) {
          socket.disconnect();
          socket.connect();
        }
      });
    }
  }, 15000);
});

socket.on("heartbeat_ack", () => {
  missedHeartbeats = 0;
});

socket.on("disconnect", () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
});

socket.on("matchFound", (data) => {
  console.log("Match found:", data);
  socket.emit("matchAcknowledged", { matchId: data.matchId });
});

socket.on("matchTimeout", () => {
  console.log("Match timed out");
  socket.connect(); // Attempt to reconnect
});

// Debug events in development only
if (import.meta.env.DEV) {
  socket.onAny((event, ...args) => {
    console.log("Socket event:", event, args);
  });
}

export const reconnectSocket = () => {
  if (!socket.connected && reconnectAttempts < maxReconnectAttempts) {
    socket.connect();
  }
};
