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
  withCredentials: true,
});

socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
  // Attempt to reconnect with polling if websocket fails
  if (socket.io.opts.transports.includes("websocket")) {
    socket.io.opts.transports = ["polling", "websocket"];
  }
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
  if (reason === "io server disconnect" || reason === "transport close") {
    // Attempt to reconnect with a delay
    setTimeout(() => {
      socket.connect();
    }, 1000);
  }
});

// Heartbeat to keep connection alive
setInterval(() => {
  if (socket.connected) {
    socket.emit("heartbeat");
  }
}, 25000);

// Debug events
socket.onAny((event, ...args) => {
  console.log("Socket event:", event, args);
});
