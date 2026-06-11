import express from "express";
import chokidar from "chokidar";
import path from "node:path";
import { drillsDir } from "./paths.mjs";

/** SSE endpoint that pushes a `drills-changed` event whenever drills/*.json change on disk. */
export function watchRouter() {
  const router = express.Router();
  const clients = new Set();

  const watcher = chokidar.watch(drillsDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
  });

  function broadcast(event, payload) {
    const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) res.write(frame);
  }

  watcher.on("all", (fsEvent, filePath) => {
    if (!filePath.endsWith(".json")) return;
    const id = path.basename(filePath, ".json");
    broadcast("drills-changed", { id, fsEvent });
  });

  router.get("/events", (req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders();
    res.write(": connected\n\n");
    clients.add(res);
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
  });

  return router;
}
