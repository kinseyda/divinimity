import express from "express";
import cors from "cors";
// import { connect } from "rethinkdb";

const allowedOrigins = [process.env.PUBLIC_URL || "http://localhost:4321"];
const devOrigins = [
  "http://localhost:4321", // Vite / Astro
  "http://localhost:3000", // This Express server
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

const prefix = process.env.PUBLIC_BACKEND_PREFIX || "multiplayer";

// Endpoint: ping
//  endpoint to check server status
app.get(`/${prefix}/ping`, (_, res) => res.send("pong"));

// Endpoint: health
//  endpoint to check server health
app.get(`${prefix}/health`, (_, res) => res.send("OK"));

// Endpoint:

app.listen(3000, () => console.log("Server running on port 3000"));
