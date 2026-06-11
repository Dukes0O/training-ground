import express from "express";
import path from "node:path";
import { exec } from "node:child_process";
import { createRequire } from "node:module";
import { ensureDirs, repoRoot } from "./paths.mjs";
import { drillsRouter } from "./drills.mjs";
import { exportsRouter } from "./exportsApi.mjs";
import { watchRouter } from "./watch.mjs";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const distDir = path.join(repoRoot, "dist");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 8123;
const MAX_PORT_PROBES = 8;

ensureDirs();

const app = express();
app.disable("x-powered-by");

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: pkg.version, dataDir: repoRoot });
});

app.use("/api", watchRouter());
app.use("/api", exportsRouter());
app.use("/api", drillsRouter());

app.use(express.static(distDir));
// SPA fallback: anything that isn't a file or /api route gets the app shell.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distDir, "index.html"));
});

function listenOn(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, HOST);
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

async function start() {
  const basePort = Number(process.env.PORT) || DEFAULT_PORT;
  let server = null;
  for (let port = basePort; port < basePort + MAX_PORT_PROBES; port++) {
    try {
      server = await listenOn(port);
      break;
    } catch (err) {
      if (err.code !== "EADDRINUSE") throw err;
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
    }
  }
  if (!server) {
    console.error(`No free port found in ${basePort}-${basePort + MAX_PORT_PROBES - 1}.`);
    process.exit(1);
  }
  const { port } = server.address();
  const url = `http://${HOST}:${port}`;
  console.log(`Training Ground is running at ${url}`);
  console.log("Keep this window open while you use the app. Press Ctrl+C to stop.");
  if (process.argv.includes("--open")) {
    exec(`cmd /c start "" ${url}`);
  }
}

start();
