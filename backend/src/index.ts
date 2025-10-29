import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import {
  ClientToClientMessage,
  ClientToClientMessageType,
  ClientToServerMessageType,
  JoinSessionData,
  JoinSessionMessage,
  ServerToClientMessage,
  ServerToClientMessageData,
  ServerToClientMessageType,
  SessionInfo,
  StartSessionData,
  StartSessionMessage,
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

function updateSessionTimestamp(sessionId: string) {
  const entry = sessionStore.get(sessionId);
  if (entry) {
    entry.session.lastUpdated = Date.now();
  }
}

function updateSession(session: SessionInfo) {
  // For updating session info in the store, such as adding or removing players
  const entry = sessionStore.get(session.id);
  if (entry) {
    entry.session = session;
    updateSessionTimestamp(session.id);
  }
}

function relayMessageToSession(
  sessionId: string,
  originSocketId: string,
  message: ClientToClientMessage
) {
  const entry = sessionStore.get(sessionId);
  if (entry) {
    entry.sockets.forEach((socketId) => {
      if (socketId !== originSocketId) {
        console.log("Relaying message to socket:", socketId, message);
        io.to(socketId).emit(message.type, message);
        updateSessionTimestamp(sessionId);
      }
    });
  }
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

  socket.onAny((event, msg) => {
    if (event === "disconnect") {
      console.log("user disconnected");
      // Remove socket from any sessions it was part of
      // TODO optimize this, store a map of socketId to sessionIds (?)
      sessionStore.forEach((entry, sessionId) => {
        const index = entry.sockets.indexOf(socket.id);
        if (index !== -1) {
          entry.sockets.splice(index, 1);
          updateSessionTimestamp(sessionId);
        }
      });
    }
    console.log("Received client message:", msg);
    switch (msg.type) {
      default:
        console.log(`Unknown message type: ${msg.type}`);
        break;
      case ClientToClientMessageType.Turn:
      case ClientToClientMessageType.NewGame:
        const clientMessage = msg as ClientToClientMessage;
        relayMessageToSession(
          clientMessage.sessionId,
          socket.id,
          clientMessage
        );
        break;
      case ClientToServerMessageType.StartSession:
        const { playerInfo, ruleset } = msg.data as StartSessionData;
        const sessionId = generateSessionId();
        const newSession: SessionInfo = {
          id: sessionId,
          players: [playerInfo],
          lastUpdated: Date.now(),
        };
        sessionStore.set(sessionId, {
          session: newSession,
          sockets: [socket.id],
        });
        socket.join(sessionId);
        const startSuccessMessageData: ServerToClientMessageData = {
          session: newSession,
        };
        const startSuccessMessage: ServerToClientMessage = {
          type: ServerToClientMessageType.StartSuccess,
          data: startSuccessMessageData,
        };
        console.log("Successfully started session:", newSession);
        socket.emit(
          ServerToClientMessageType.StartSuccess,
          startSuccessMessage
        );
        break;
      case ClientToServerMessageType.JoinSession:
        const { sessionId: joinSessionId, playerInfo: joinPlayerInfo } =
          msg.data as JoinSessionData;
        const entry = sessionStore.get(joinSessionId);
        if (entry) {
          entry.sockets.push(socket.id);
          socket.join(joinSessionId);
          entry.session.players.push(joinPlayerInfo);
          updateSessionTimestamp(joinSessionId);
          const successMessageData: ServerToClientMessageData = {
            session: entry.session,
          };
          const successMessage: ServerToClientMessage = {
            type: ServerToClientMessageType.JoinSuccess,
            data: successMessageData,
          };
          console.log("Successfully joined session:", entry.session);
          socket.emit(ServerToClientMessageType.JoinSuccess, successMessage);

          // Notify all clients in the session that it is ready
          const SessionUpdatedMessageData: ServerToClientMessageData = {
            session: entry.session,
          };
          const SessionUpdatedMessage: ServerToClientMessage = {
            type: ServerToClientMessageType.SessionUpdated,
            data: SessionUpdatedMessageData,
          };
          io.to(joinSessionId).emit(
            ServerToClientMessageType.SessionUpdated,
            SessionUpdatedMessage
          );
        } else {
          socket.emit(
            ServerToClientMessageType.JoinFailure,
            "Session not found"
          );
        }
        break;
    }
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
