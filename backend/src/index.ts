import express from "express";
import cors from "cors";
// import { connect } from "rethinkdb";

const allowedOrigins = ["http://divinimity.kinseyda.com"];
const devOrigins = ["http://localhost:4321", "http://localhost:3000"];
const allOrigins = [...allowedOrigins, ...devOrigins];

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: function (origin, callback) {
      // Disallow requests with no origin (like mobile apps or curl requests)
      if (!origin)
        return callback(new Error("Not allowed by CORS - No Origin"));
      if (allOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS - Invalid Origin"));
      }
    },
  })
);

// Endpoint: ping
//  endpoint to check server status
app.get("/ping", (_, res) => res.send("pong"));

// Endpoint: health
//  endpoint to check server health
app.get("/health", (_, res) => res.send("OK"));

// Endpoint:

app.listen(3000, () => console.log("Server running on port 3000"));
