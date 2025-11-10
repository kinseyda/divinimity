import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import {
  ClientToClientMessage,
  ClientToClientMessageType,
  ClientToServerMessage,
  ClientToServerMessageType,
  JoinSessionData,
  ServerToClientMessage,
  ServerToClientMessageData,
  ServerToClientMessageType,
  SessionInfo,
  StartSessionData,
} from "../../shared";
import { getConnection } from "./db-utils";

const allowedOrigins = [process.env.PUBLIC_URL];
const port = process.env.PORT || 3000;

const devOrigins = [];
const allOrigins = [...allowedOrigins, ...devOrigins];

interface NetworkPlayerConnection {
  socketId: string;
  playerUuid: string;
}

interface SessionStoreEntry {
  // Session entries are basically sockets.io rooms with some metadata
  session: SessionInfo;
  connections: NetworkPlayerConnection[]; // list of player connections in the session
}

const sessionStore: Map<string, SessionStoreEntry> = new Map();

function updateSessionTimestamp(sessionId: string) {
  const entry = sessionStore.get(sessionId);
  if (entry) {
    entry.session.lastUpdated = Date.now();
  }
}

function updateSession(entry: SessionStoreEntry) {
  const {
    session: { id: sessionId },
  } = entry;
  if (!sessionId) return;

  // For updating session info in the store, such as adding or removing players
  const oldEntry = sessionStore.get(sessionId);
  if (oldEntry) {
    sessionStore.set(sessionId, entry);
    updateSessionTimestamp(sessionId);
    // Notify all clients in the session that it is updated
    const SessionUpdatedMessageData: ServerToClientMessageData = {
      session: entry.session,
    };
    io.to(sessionId).emit(ServerToClientMessageType.SessionUpdated, {
      type: ServerToClientMessageType.SessionUpdated,
      data: SessionUpdatedMessageData,
    });
  }
}

function relayMessageToSession(
  sessionId: string,
  originSocketId: string,
  message: ClientToClientMessage
) {
  const entry = sessionStore.get(sessionId);
  if (entry) {
    entry.connections.forEach((player) => {
      if (player.socketId !== originSocketId) {
        io.to(player.socketId).emit(message.type, message);
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
});

const io = new Server(server, {
  path: "/ws",
  cors: {
    origin: allOrigins,
    methods: ["GET", "POST"],
  },
});
io.on("connection", (socket) => {
  console.log("a user connected:", socket.id);
  socket.on("disconnect", (reason) => {
    console.log("user disconnected:", socket.id, "reason:", reason);
    // Remove the player from the connections list and the session players
    // list. TODO optimize this, store a map of socketId to sessionIds (?).
    // Only necessary when there are many simultaneous sessions
    sessionStore.forEach((entry, sessionId) => {
      console.log(
        "Checking disconnect for session:",
        sessionId,
        socket.id,
        entry.connections
      );
      const playerIndex = entry.connections.findIndex(
        (p) => p.socketId === socket.id
      );
      if (playerIndex !== -1) {
        console.log(
          `Removing player ${entry.connections[playerIndex].playerUuid} from session ${sessionId} due to disconnect`
        );

        const newEntry = structuredClone(entry);
        const playerUuid = newEntry.connections[playerIndex].playerUuid;
        newEntry.connections.splice(playerIndex, 1);
        newEntry.session.players = newEntry.session.players.filter(
          (p) => p.uuid !== playerUuid
        );

        updateSession(newEntry);
      }
    });
  });
  socket.onAny((event, msg) => {
    console.log("Received client message:", msg);
    switch ((msg as ClientToClientMessage | ClientToServerMessage).type) {
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
          connections: [{ socketId: socket.id, playerUuid: playerInfo.uuid }],
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
          const newEntry = structuredClone(entry);
          newEntry.connections.push({
            socketId: socket.id,
            playerUuid: joinPlayerInfo.uuid,
          });
          socket.join(joinSessionId);
          newEntry.session.players.push(joinPlayerInfo);

          updateSession(newEntry);

          const successMessageData: ServerToClientMessageData = {
            session: newEntry.session,
          };
          const successMessage: ServerToClientMessage = {
            type: ServerToClientMessageType.JoinSuccess,
            data: successMessageData,
          };
          socket.emit(ServerToClientMessageType.JoinSuccess, successMessage);
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
