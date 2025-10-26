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
