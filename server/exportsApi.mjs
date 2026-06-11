import express from "express";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { drillsDir, exportsDir, isValidSlug, readJson, repoRoot } from "./paths.mjs";

const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

function agentInstructions(id, assets) {
  return `# Posting "${id}" to the soccer-quizzes site

This bundle was exported from Training Ground for the GitHub Pages site
(Dukes0O/soccer-quizzes). Suggested placement, following the site's existing
conventions:

1. Copy \`${id}.png\` to \`assets/graphics/${id}.png\` (poster/diagram image).
2. Copy the animation (\`${id}.gif\`${assets.some((a) => a.endsWith(".mp4")) ? ` and/or \`${id}.mp4\`` : ""}) to \`assets/animations/\`.
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

    const snippet = [
      {
        id,
        title: String(title ?? id),
        description: String(description ?? ""),
        image: `assets/graphics/${id}.png`,
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
