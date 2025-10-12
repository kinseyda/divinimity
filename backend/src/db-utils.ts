// Functions for interfacing with rethinkdb
import pkg from "rethinkdb";
const { connect, table } = pkg;

export async function getConnection() {
  return connect({
    host: process.env.RETHINKDB_HOST,
    port: parseInt(process.env.RETHINKDB_PORT),
    db: process.env.RETHINKDB_DB,
  });
}

function generateSessionId(): string {
  // Simple function to generate a random session ID
  // Session IDs are 6 lowercase letters.
  return Math.random().toString(36).substring(2, 8);
}
