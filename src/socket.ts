import { io } from "socket.io-client";

// Use the deployed server URL
const SOCKET_URL = "wss://pokeserver-1.onrender.com/";

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  path: "/socket.io",
});

socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
  if (reason === "io server disconnect") {
    socket.connect();
  }
});

// Debug events
socket.onAny((event, ...args) => {
  console.log("Socket event:", event, args);
});
