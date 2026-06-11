import express from "express";
import fsp from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson, dataDir, drillsDir, isValidSlug, readJson, trashDir } from "./paths.mjs";

const rostersFile = path.join(dataDir, "rosters.json");
const settingsFile = path.join(dataDir, "settings.json");

async function listDrillFiles() {
  const entries = await fsp.readdir(drillsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => e.name)
    .sort();
}

function summarize(drill) {
  return {
    id: drill.id,
    title: drill.title ?? drill.id,
    description: drill.description ?? "",
    tags: drill.tags ?? [],
    pitch: drill.pitch ?? "9v9",
    stepCount: Array.isArray(drill.steps) ? drill.steps.length : 0,
    entityCount: Array.isArray(drill.entities) ? drill.entities.length : 0,
    updatedAt: drill.updatedAt ?? null,
    rev: drill.rev ?? 0,
  };
}

export function drillsRouter() {
  const router = express.Router();
  router.use(express.json({ limit: "2mb" }));

  router.get("/drills", async (_req, res) => {
    const out = [];
    for (const file of await listDrillFiles()) {
      const id = file.replace(/\.json$/, "");
      try {
        const drill = await readJson(path.join(drillsDir, file));
        const summary = summarize(drill);
        // The filename is the identity; flag files whose inner id disagrees.
        if (drill.id !== id) summary.invalid = true, (summary.error = `file is ${id}.json but "id" is "${drill.id}"`);
        summary.id = id;
        out.push(summary);
      } catch (err) {
        out.push({ id, title: id, invalid: true, error: String(err.message ?? err) });
      }
    }
    res.json(out);
  });

  router.get("/drills/:id", async (req, res) => {
    const { id } = req.params;
    if (!isValidSlug(id)) return res.status(400).json({ error: "invalid drill id" });
    try {
      res.json(await readJson(path.join(drillsDir, `${id}.json`)));
    } catch (err) {
      if (err.code === "ENOENT") return res.status(404).json({ error: "not found" });
      res.status(500).json({ error: String(err.message ?? err) });
    }
  });

  router.put("/drills/:id", async (req, res) => {
    const { id } = req.params;
    if (!isValidSlug(id)) return res.status(400).json({ error: "invalid drill id" });
    const body = req.body;
    if (!body || typeof body !== "object" || !Array.isArray(body.steps)) {
      return res.status(400).json({ error: "body must be a drill object" });
    }
    const file = path.join(drillsDir, `${id}.json`);
    let existing = null;
    try {
      existing = await readJson(file);
    } catch (err) {
      if (err.code !== "ENOENT") return res.status(500).json({ error: String(err.message ?? err) });
    }
    const ifMatch = req.get("If-Match");
    if (ifMatch != null && existing && String(existing.rev ?? 0) !== ifMatch) {
      return res.status(409).json({ error: "rev mismatch", currentRev: existing.rev ?? 0 });
    }
    const now = new Date().toISOString();
    const drill = {
      ...body,
      id,
      rev: (existing?.rev ?? 0) + 1,
      createdAt: existing?.createdAt ?? body.createdAt ?? now,
      updatedAt: now,
    };
    await atomicWriteJson(file, drill);
    res.json({ ok: true, rev: drill.rev, updatedAt: drill.updatedAt });
  });

  router.delete("/drills/:id", async (req, res) => {
    const { id } = req.params;
    if (!isValidSlug(id)) return res.status(400).json({ error: "invalid drill id" });
    const file = path.join(drillsDir, `${id}.json`);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    try {
      await fsp.rename(file, path.join(trashDir, `${id}.${stamp}.json`));
      res.json({ ok: true });
    } catch (err) {
      if (err.code === "ENOENT") return res.status(404).json({ error: "not found" });
      res.status(500).json({ error: String(err.message ?? err) });
    }
  });

  router.get("/rosters", async (_req, res) => {
    try {
      res.json(await readJson(rostersFile));
    } catch {
      res.json({ teams: [] });
    }
  });

  router.put("/rosters", async (req, res) => {
    if (!req.body || !Array.isArray(req.body.teams)) {
      return res.status(400).json({ error: "body must be { teams: [...] }" });
    }
    await atomicWriteJson(rostersFile, req.body);
    res.json({ ok: true });
  });

  router.get("/settings", async (_req, res) => {
    try {
      res.json(await readJson(settingsFile));
    } catch {
      res.json({});
    }
  });

  router.put("/settings", async (req, res) => {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ error: "body must be an object" });
    }
    await atomicWriteJson(settingsFile, req.body);
    res.json({ ok: true });
  });

  return router;
}
