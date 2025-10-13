// Functions for interfacing with rethinkdb
import pkg from "rethinkdb";
const { connect, table } = pkg;

export async function getConnection() {
  const conSettings = {
    host: process.env.RETHINKDB_HOST,
    port: parseInt(process.env.RETHINKDB_PORT!),
    db: process.env.RETHINKDB_DB,
  };
  return connect(conSettings);
}

function generateSessionId(): string {
  // Simple function to generate a random session ID
  // Session IDs are 6 lowercase letters.
  return Math.random().toString(36).substring(2, 8);
}

export interface Session {
  id: string;
  player1: string | null;
  player2: string | null;
  turn: string | null; // json string of the most recent turn
  lastUpdated: number; // timestamp
}

export const MAX_SESSION_AGE = 1000 * 60 * 60 * 24; // 24 hours

export async function createSession(playerId: string): Promise<Session> {
  const conn = await getConnection();
  const sessions = table("sessions");
  const sessionId = generateSessionId();

  const newSession: Session = {
    id: sessionId,
    player1: playerId,
    player2: null,
    turn: null,
    lastUpdated: Date.now(),
  };

  await sessions.insert(newSession).run(conn);
  return newSession;
}
export async function getSession(sessionId: string): Promise<Session | null> {
  const conn = await getConnection();
  const sessions = table("sessions");
  const result = await sessions
    .filter({ id: sessionId })
    .nth(0)
    .default(null)
    .run(conn);
  if (result) {
    return result as Session;
  } else {
    return null;
  }
}
