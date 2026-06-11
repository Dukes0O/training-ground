// Validates drill files: structural (zod) + semantic rules + filename/id match.
// Usage: npm run validate            -> all of drills/*.json
//        npm run validate -- drills/4v1-rondo.json [more...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { DrillSchema, semanticIssues } from "../src/model/schema";
import type { Drill } from "../src/model/types";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const drillsDir = path.join(repoRoot, "drills");

const args = process.argv.slice(2);
const files =
  args.length > 0
    ? args.map((a) => path.resolve(repoRoot, a))
    : fs.existsSync(drillsDir)
      ? fs
          .readdirSync(drillsDir)
          .filter((f) => f.endsWith(".json"))
          .map((f) => path.join(drillsDir, f))
      : [];

if (files.length === 0) {
  console.log("No drill files found.");
  process.exit(0);
}

let failed = 0;
let warned = 0;

for (const file of files) {
  const rel = path.relative(repoRoot, file);
  const problems: string[] = [];
  const warnings: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch (err) {
    console.log(`FAIL  ${rel}`);
    console.log(`      JSON parse error: ${(err as Error).message}`);
    failed++;
    continue;
  }
  const result = DrillSchema.safeParse(raw);
  if (!result.success) {
    problems.push(...z.prettifyError(result.error).split("\n"));
  } else {
    const drill = result.data as Drill;
    const expectedId = path.basename(file, ".json");
    if (drill.id !== expectedId) {
      problems.push(`file is ${expectedId}.json but "id" is "${drill.id}" (they must match)`);
    }
    for (const issue of semanticIssues(drill)) {
      (issue.level === "error" ? problems : warnings).push(issue.message);
    }
  }
  if (problems.length > 0) {
    failed++;
    console.log(`FAIL  ${rel}`);
    for (const p of problems) console.log(`      ${p}`);
    for (const w of warnings) console.log(`      warning: ${w}`);
  } else if (warnings.length > 0) {
    warned++;
    console.log(`WARN  ${rel}`);
    for (const w of warnings) console.log(`      warning: ${w}`);
  } else {
    console.log(`OK    ${rel}`);
  }
}

console.log(
  `\n${files.length} file(s): ${files.length - failed - warned} ok, ${warned} with warnings, ${failed} failed`
);
process.exit(failed > 0 ? 1 : 0);
