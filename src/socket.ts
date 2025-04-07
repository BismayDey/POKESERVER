import { io, Socket } from "socket.io-client";

// Environment configuration
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || "wss://pokeserver-1.onrender.com/";

// Type definitions for better TypeScript support
interface MatchData {
  matchId: string;
  opponent: {
    username: string;
    rating: number;
    stats: any;
  };
}

interface QueueUpdate {
  position: number;
  totalPlayers: number;
  estimatedWaitTime?: number;
}

// Enhanced socket client with proper typing
export const socket: Socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity, // Keep trying to reconnect
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 20000,
  path: "/socket.io",
  withCredentials: true,
  query: {
    clientType: "player",
  },
});

// Connection state management
let isConnected = false;
let currentMatchId: string | null = null;
let connectionAttempts = 0;

// Connection lifecycle handlers
socket.on("connect", () => {
  isConnected = true;
  connectionAttempts = 0;
  console.log("Successfully connected to server. Socket ID:", socket.id);

  // Attempt to rejoin current match if exists
  if (currentMatchId) {
    socket.emit(
      "rejoinMatch",
      { matchId: currentMatchId },
      (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          console.warn("Failed to rejoin match:", response.error);
          currentMatchId = null;
        }
      }
    );
  }
});

socket.on("connect_error", (error: Error) => {
  isConnected = false;
  connectionAttempts++;
  console.error(
    `Connection error (attempt ${connectionAttempts}):`,
    error.message
  );

  // For specific errors, you might want to handle differently
  if (error.message.includes("404")) {
    console.error("Server endpoint not found. Please check the URL.");
  }
});

socket.on("disconnect", (reason: string) => {
  isConnected = false;
  console.log("Disconnected. Reason:", reason);

  // Handle different disconnect reasons appropriately
  switch (reason) {
    case "io server disconnect":
      // Server forced disconnect - needs manual reconnect
      console.log(
        "Server intentionally disconnected us. Trying to reconnect..."
      );
      socket.connect();
      break;
    case "io client disconnect":
      // Client manually disconnected - no auto-reconnect
      console.log("Client manually disconnected");
      break;
    case "ping timeout":
    case "transport close":
      // Network issues - auto-reconnect will handle
      console.log("Network issues detected. Auto-reconnecting...");
      break;
  }
});

// Matchmaking handlers
socket.on("matchFound", (data: MatchData) => {
  currentMatchId = data.matchId;
  console.log(
    "Match found! Match ID:",
    currentMatchId,
    "Opponent:",
    data.opponent.username
  );

  // Start your match initialization logic here
});

socket.on("matchFailed", (reason: string) => {
  console.log("Match failed:", reason);
  currentMatchId = null;

  // Handle match failure (show UI message, etc.)
});

socket.on("opponentDisconnected", () => {
  console.log("Opponent disconnected from the match");

  // Handle opponent disconnect in your game UI
});

socket.on("queueUpdate", (data: QueueUpdate) => {
  console.log(`Queue position: ${data.position}/${data.totalPlayers}`);

  // Update queue position in your UI
});

// Debugging and logging
socket.onAny((event: string, ...args: any[]) => {
  if (!event.startsWith("queueUpdate")) {
    // Skip frequent queue updates
    console.debug("Socket event:", event, args);
  }
});

// Heartbeat handling
socket.on("ping", () => {
  socket.emit("pong");
});

// Export connection management functions
export const connectSocket = (): void => {
  if (!isConnected) {
    console.log("Attempting to connect to server...");
    socket.connect();
  }
};

export const disconnectSocket = (): void => {
  if (isConnected) {
    console.log("Disconnecting from server...");
    socket.disconnect();
  }
};

export const joinQueue = (playerData: any): void => {
  if (isConnected) {
    console.log("Joining queue with data:", playerData);
    socket.emit("joinQueue", playerData);
  } else {
    console.error("Cannot join queue - not connected to server");
  }
};

export const leaveQueue = (): void => {
  if (isConnected) {
    console.log("Leaving queue");
    socket.emit("leaveQueue");
  }
};
