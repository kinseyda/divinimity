import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import {
  ClientToServerSocketEvents,
  JoinSessionData,
  ServerToClientSocketEvents,
  SessionInfo,
  StartSessionData,
  TurnData,
} from "../../shared";
import { getConnection } from "./db-utils";

const allowedOrigins = [process.env.PUBLIC_URL];
const port = process.env.PORT || 3000;

const devOrigins = [];
const allOrigins = [...allowedOrigins, ...devOrigins];

interface SessionStoreEntry {
  session: SessionInfo;
  sockets: string[]; // set of socket IDs connected to this session
}

const sessionStore: Map<string, SessionStoreEntry> = new Map();

function updateSession(sessionId: string, session: SessionInfo) {
  const entry = sessionStore.get(sessionId);
  if (entry) {
    entry.session = session;
    entry.session.lastUpdated = Date.now();
  }
  for (const socketId of entry?.sockets || []) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(ServerToClientSocketEvents.SESSION_UPDATED, entry.session);
    }
  }
}

function printSessions() {
  console.log("Current sessions:");
  sessionStore.forEach((entry, id) => {
    const { lastUpdated, players, turns } = entry.session;
    console.log(
      `- ID: ${id}, Last Updated: ${new Date(
        lastUpdated
      ).toISOString()}, Players: ${players
        .map((p) => p.name)
        .join(", ")}, Turns: ${turns.length}`
    );
  });
}

function clearOldSessions(maxAgeMs: number) {
  const now = Date.now();
  sessionStore.forEach((entry, id) => {
    if (now - entry.session.lastUpdated > maxAgeMs) {
      sessionStore.delete(id);
    }
  });
}
setInterval(() => clearOldSessions(24 * 60 * 60 * 1000), 60 * 60 * 1000); // every hour, clear sessions older than 24 hours

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
app.get(`/ping`, (_, res) =>
  res.send(`PONG from backend at ${new Date().toISOString()}`)
);

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

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
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

  socket.on(
    ClientToServerSocketEvents.START_SESSION,
    (data: StartSessionData) => {
      // Handle start session
      const { playerInfo, ruleset } = data;
      const sessionId = generateSessionId();
      const newSession: SessionInfo = {
        id: sessionId,
        turns: [],
        players: [playerInfo],
        ruleset,
        lastUpdated: Date.now(),
      };
      sessionStore.set(sessionId, {
        session: newSession,
        sockets: [socket.id],
      });
      // Respond to the client with the session data
      socket.emit(ServerToClientSocketEvents.SESSION_STARTED, newSession);
      console.log(`Session started with ID: ${sessionId}`);
      printSessions();
    }
  );

  socket.on(
    ClientToServerSocketEvents.JOIN_SESSION,
    (data: JoinSessionData) => {
      // Handle join session
      const { sessionId, playerInfo } = data;

      const entry = sessionStore.get(sessionId);
      if (entry) {
        const players = [...entry.session.players, playerInfo];
        players.sort((a, b) => a.turnRemainder - b.turnRemainder);
        updateSession(sessionId, {
          ...entry.session,
          players,
        });
        entry.sockets.push(socket.id);
        // Respond to the client with the session data
        socket.emit(ServerToClientSocketEvents.SESSION_STARTED, entry.session);
        console.log(
          `Player ${playerInfo.name} joined session with ID: ${sessionId}`
        );
        printSessions();
      } else {
        // Session not found; send an error or handle accordingly
        socket.emit("error", `Session with ID ${sessionId} not found.`);
      }
    }
  );

  socket.on(ClientToServerSocketEvents.TURN, (data: TurnData) => {
    // Handle make move
    const { sessionId, turn } = data;
    const entry = sessionStore.get(sessionId);
    if (entry) {
      const turns = [...entry.session.turns, turn];
      updateSession(sessionId, {
        ...entry.session,
        turns,
      });
      console.log(`Turn added to session ${sessionId}:`, turn);
    } else {
      socket.emit("error", `Session with ID ${sessionId} not found.`);
    }
  });

  socket.on(ClientToServerSocketEvents.DISCONNECT, () => {
    console.log("user disconnected");
  });
});

function generateSessionId(): string {
  while (true) {
    const sessionId = Math.random().toString(36).substring(2, 8);
    if (!sessionStore.has(sessionId)) {
      return sessionId;
    }
  }
}
