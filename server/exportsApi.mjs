import express from "express";
import fsp from "node:fs/promises";
import path from "node:path";
import { exportsDir, isValidSlug } from "./paths.mjs";

const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

export function exportsRouter() {
  const router = express.Router();

  router.post(
    "/exports/:id/asset",
    express.raw({ type: () => true, limit: "900mb" }),
    async (req, res) => {
      const { id } = req.params;
      const name = String(req.query.name ?? "");
      if (!isValidSlug(id)) return res.status(400).json({ error: "invalid drill id" });
      if (!SAFE_NAME.test(name) || name.includes("..")) {
        return res.status(400).json({ error: "invalid asset name" });
      }
      const dir = path.join(exportsDir, id);
      await fsp.mkdir(dir, { recursive: true });
      const file = path.join(dir, name);
      await fsp.writeFile(file, req.body);
      res.json({ ok: true, path: file, bytes: req.body.length });
    }
  );

  return router;
}
