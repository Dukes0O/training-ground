import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "..");
export const drillsDir = path.join(repoRoot, "drills");
export const dataDir = path.join(repoRoot, "data");
export const trashDir = path.join(dataDir, "trash");
export const exportsDir = path.join(repoRoot, "exports");

export function ensureDirs() {
  for (const dir of [drillsDir, dataDir, trashDir, exportsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");
const BOM = new RegExp("^\\uFEFF");

/** True when the id is safe to use as a filename segment on Windows. */
export function isValidSlug(id) {
  return typeof id === "string" && SLUG.test(id) && !RESERVED.test(id);
}

export function slugify(text) {
  const slug = String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return isValidSlug(slug) ? slug : `drill-${slug}`.slice(0, 60);
}

/** Write via a temp file + rename so readers never see a half-written file. */
export async function atomicWriteJson(filePath, value) {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fsp.rename(tmp, filePath);
}

export async function readJson(filePath) {
  const text = await fsp.readFile(filePath, "utf8");
  // Tolerate a UTF-8 BOM, e.g. from PowerShell-authored files.
  return JSON.parse(text.replace(BOM, ""));
}
