import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { openDatabase } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { orgsRouter } from "./routes/orgs.js";
import { requestsRouter } from "./routes/requests.js";

/** Backend package root (`backend/`), stable even if `node` is started from the monorepo root. */
const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const port = Number(process.env.PORT ?? "4000");
const jwtSecret = process.env.JWT_SECRET;
const dbPathRaw = process.env.DATABASE_PATH ?? "./data.sqlite";
const dbPath = path.isAbsolute(dbPathRaw)
  ? dbPathRaw
  : path.resolve(backendDir, dbPathRaw);

if (!jwtSecret || jwtSecret.length < 16) {
  console.error("Set JWT_SECRET (min 16 chars). See backend/.env.example");
  process.exit(1);
}

const db = openDatabase(dbPath);
const app = express();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "512kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter(db, jwtSecret));
app.use("/api/orgs", orgsRouter(db, jwtSecret));
app.use("/api", requestsRouter(db, jwtSecret));

const staticDirRaw = process.env.STATIC_DIR;
const staticDir =
  staticDirRaw &&
  (path.isAbsolute(staticDirRaw)
    ? staticDirRaw
    : path.resolve(backendDir, staticDirRaw));
if (staticDir && fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) {
        next(err);
      }
    });
  });
}

const server = app.listen(port, () => {
  const base = `http://localhost:${port}`;
  if (staticDir && fs.existsSync(staticDir)) {
    console.log(`Serving API + SPA at ${base} (static: ${staticDir})`);
  } else {
    console.log(`API ${base} (set STATIC_DIR to serve the built frontend)`);
  }
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Stop the other process (e.g. an old "npm run dev") or set PORT in backend/.env`,
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
