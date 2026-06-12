import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { drillsDir, exportsDir, isValidSlug, readJson, repoRoot } from "./paths.mjs";

const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

function agentInstructions(id, assets) {
  const png = assets.find((a) => a.endsWith(".png"));
  const gif = assets.find((a) => a.endsWith(".gif"));
  const mp4 = assets.find((a) => a.endsWith(".mp4") || a.endsWith(".webm"));
  const animations = [gif, mp4].filter(Boolean).map((a) => `\`${a}\``).join(" and/or ");
  return `# Posting "${id}" to the soccer-quizzes site

This bundle was exported from Training Ground for the GitHub Pages site
(Dukes0O/soccer-quizzes). Suggested placement, following the site's existing
conventions:

1. Copy ${png ? `\`${png}\`` : "the poster PNG"} to \`assets/graphics/\` (poster/diagram image).
2. Copy the animation (${animations || "GIF/MP4"}) to \`assets/animations/\`.
3. Append the entry in \`manifest-snippet.json\` to the appropriate manifest
   (e.g. \`resources/manifest.json\`, or the drills manifest if a Training
   Ground/drills section exists). Keep the existing field style.
4. \`${id}.json\` is the full drill definition (positions in meters, keyframe
   steps). It isn't needed for a media-only post; keep it alongside the page
   if an interactive viewer is added later.

Image alt text suggestion: use the manifest entry's "description".
`;
}

export function exportsRouter() {
  const router = express.Router();

  // Streamed to disk (no body buffering): a long narrated take should neither
  // spike RAM nor hit a body-size ceiling, and tmp+rename keeps writes atomic.
  router.post("/exports/:id/asset", async (req, res) => {
    const { id } = req.params;
    const name = String(req.query.name ?? "");
    if (!isValidSlug(id)) return res.status(400).json({ error: "invalid drill id" });
    if (!SAFE_NAME.test(name) || name.includes("..")) {
      return res.status(400).json({ error: "invalid asset name" });
    }
    const dir = path.join(exportsDir, id);
    await fsp.mkdir(dir, { recursive: true });
    const file = path.join(dir, name);
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
    });
    try {
      await pipeline(req, fs.createWriteStream(tmp));
      await fsp.rename(tmp, file);
      res.json({ ok: true, path: file, bytes });
    } catch (err) {
      await fsp.unlink(tmp).catch(() => undefined);
      res.status(500).json({ error: String(err.message ?? err) });
    }
  });

  router.post("/exports/:id/bundle", express.json(), async (req, res) => {
    const { id } = req.params;
    if (!isValidSlug(id)) return res.status(400).json({ error: "invalid drill id" });
    const { title, description, themeColor, assets } = req.body ?? {};
    if (!Array.isArray(assets)) return res.status(400).json({ error: "assets must be an array" });

    const dir = path.join(exportsDir, id);
    const bundleDir = path.join(dir, "site-bundle");
    await fsp.mkdir(bundleDir, { recursive: true });

    const copied = [];
    for (const name of assets) {
      if (!SAFE_NAME.test(String(name)) || String(name).includes("..")) continue;
      try {
        await fsp.copyFile(path.join(dir, name), path.join(bundleDir, name));
        copied.push(name);
      } catch {
        // asset missing — skip rather than fail the bundle
      }
    }

    try {
      const drill = await readJson(path.join(drillsDir, `${id}.json`));
      await fsp.writeFile(
        path.join(bundleDir, `${id}.json`),
        JSON.stringify(drill, null, 2) + "\n",
        "utf8"
      );
    } catch {
      // drill file unavailable; bundle remains media-only
    }

    const pngName = copied.find((a) => a.endsWith(".png")) ?? `${id}.png`;
    const snippet = [
      {
        id,
        title: String(title ?? id),
        description: String(description ?? ""),
        image: `assets/graphics/${pngName}`,
        themeColor: String(themeColor ?? "#1e40af"),
      },
    ];
    await fsp.writeFile(
      path.join(bundleDir, "manifest-snippet.json"),
      JSON.stringify(snippet, null, 2) + "\n",
      "utf8"
    );
    await fsp.writeFile(path.join(bundleDir, "AGENT-INSTRUCTIONS.md"), agentInstructions(id, copied), "utf8");

    res.json({ ok: true, path: bundleDir });
  });

  router.post("/reveal", express.json(), (req, res) => {
    const target = String(req.body?.path ?? "");
    const normalized = path.resolve(target);
    if (!normalized.toLowerCase().startsWith(repoRoot.toLowerCase())) {
      return res.status(400).json({ error: "path must be inside the project" });
    }
    // explorer.exe exits non-zero even on success; fire and forget.
    spawn("explorer.exe", [`/select,${normalized}`], { detached: true, stdio: "ignore" }).unref();
    res.json({ ok: true });
  });

  return router;
}
