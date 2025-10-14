import cors from "cors";
import express from "express";
import { getConnection } from "./db-utils";
import { Server } from "socket.io";
import { SocketEvents } from "@divinimity/shared/index";

const allowedOrigins = [process.env.PUBLIC_URL || "http://localhost:4321"];
const devOrigins = [
  "http://localhost:4321", // Vite / Astro
  "http://localhost:3000", // This Express server
  "http://frontend:4321", // Vite / Astro in Docker
  "http://backend:3000", // This Express server in Docker
];
const allOrigins = [...allowedOrigins, ...devOrigins];

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow REST tools or curl requests with no origin

      if (allOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS - '${origin}'`));
      }
    },
  })
);

// Endpoint: ping
//  endpoint to check server status
app.get(`/ping`, (_, res) => res.send("pong"));

// Endpoint: health
//  endpoint to check server health
app.get(`/health/backend`, (_, res) => res.send("OK"));

// Endpoint: db-health
//  endpoint to check database connection
app.get(`/health/db`, async (_, res) => {
  try {
    const conn = await getConnection();
    conn.close();
    res.send("OK");
  } catch (error) {
    res.status(500).send(`DB connection failed: ${error}`);
  }
});

const server = app.listen(3000, () => {
  console.log("Server running on port 3000");
  console.log(`Allowed origins: ${allOrigins}`);
});

const io = new Server(server, {
  path: "/ws",
  cors: {
    origin: allOrigins,
    methods: ["GET", "POST"],
  },
});
io.on("connection", (socket) => {
  console.log("a user connected");
  // Handle incoming socket events here. Upon connection, a user is either
  // trying to start a session or join one. They will emit either a
  // "start-session" or "join-session" event with their player ID and (if
  // joining) the session ID. Then, in both cases, the server will respond with
  // a "session-started" event, with the full session data (including the
  // session ID). From there, players will emit "make-move" events with their
  // move data, and the server will broadcast the updated session state to both
  // players with a "session-updated" event.

  socket.on(SocketEvents.START_SESSION, (data) => {
    // Handle start session
  });

  socket.on(SocketEvents.JOIN_SESSION, (data) => {
    // Handle join session
  });

  socket.on(SocketEvents.MAKE_MOVE, (data) => {
    // Handle make move
  });

  socket.on(SocketEvents.DISCONNECT, () => {
    console.log("user disconnected");
  });
});
