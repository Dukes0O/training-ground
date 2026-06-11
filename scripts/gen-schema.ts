// Generates schema/drill.schema.json from the zod schema (the single source).
// Run via: npm run schema
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { DrillSchema } from "../src/model/schema";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(repoRoot, "schema", "drill.schema.json");

const jsonSchema = z.toJSONSchema(DrillSchema, { target: "draft-2020-12" }) as Record<string, unknown>;
jsonSchema.$id = "https://github.com/Dukes0O/training-ground/schema/drill.schema.json";
jsonSchema.title = "Training Ground drill";
jsonSchema.description =
  "A soccer drill/animation for the Training Ground app. Units are meters; origin is the pitch's top-left corner. See docs/drill-authoring.md.";

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(jsonSchema, null, 2) + "\n", "utf8");
console.log(`wrote ${outFile}`);
