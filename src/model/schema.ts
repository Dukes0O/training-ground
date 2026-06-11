import { z } from "zod";
import type { Drill } from "./types";

// zod mirror of the types in types.ts — the runtime/source-of-truth schema.
// `npm run schema` generates schema/drill.schema.json from DrillSchema, and
// `npm run validate` checks drill files against it plus the semantic rules
// below. The __typeChecks export keeps this file and types.ts from drifting.

export const PointSchema = z.object({ x: z.number(), y: z.number() });

export const EaseSchema = z.enum(["linear", "easeIn", "easeOut", "easeInOut", "instant"]);

export const TeamIdSchema = z.enum(["home", "away", "neutral"]);

export const PitchFormatIdSchema = z.enum(["11v11", "9v9", "8v8", "half-11v11", "grid"]);

export const PitchOverridesSchema = z.object({
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  gridOn: z.boolean().optional(),
});

export const PitchRefSchema = z.union([
  PitchFormatIdSchema,
  z.object({ format: PitchFormatIdSchema, overrides: PitchOverridesSchema.optional() }),
]);

export const PlayerSchema = z.object({
  kind: z.literal("player"),
  id: z.string().min(1),
  team: TeamIdSchema,
  number: z.number().int().min(0).max(99).optional(),
  name: z.string().optional(),
  position: z.string().optional(),
  rosterRef: z.string().optional(),
});

export const BallSchema = z.object({
  kind: z.literal("ball"),
  id: z.string().min(1),
});

export const EquipmentSchema = z.object({
  kind: z.enum(["cone", "flat", "minigoal", "ladder", "mannequin", "pole", "hurdle"]),
  id: z.string().min(1),
  color: z.string().optional(),
});

export const AnchorSchema = z.union([PointSchema, z.object({ ref: z.string().min(1) })]);

export const AnnotationSchema = z.object({
  kind: z.enum(["arrow", "zone", "label"]),
  id: z.string().min(1),
  style: z.enum(["pass", "run", "dribble", "shot", "plain"]).optional(),
  from: AnchorSchema.optional(),
  to: AnchorSchema.optional(),
  via: z.array(PointSchema).optional(),
  rect: z
    .object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() })
    .optional(),
  text: z.string().optional(),
  color: z.string().optional(),
  fromStep: z.number().int().min(0).optional(),
  toStep: z.number().int().min(0).optional(),
});

export const EntitySchema = z.union([PlayerSchema, BallSchema, EquipmentSchema, AnnotationSchema]);

export const PoseSchema = z.object({
  x: z.number(),
  y: z.number(),
  rotation: z.number().optional(),
  via: z.array(PointSchema).optional(),
  ease: EaseSchema.optional(),
  hidden: z.boolean().optional(),
});

export const StepSchema = z.object({
  name: z.string().optional(),
  durationMs: z.number().positive().optional(),
  pauseAfterMs: z.number().min(0).optional(),
  ease: EaseSchema.optional(),
  positions: z.record(z.string(), PoseSchema),
});

export const TeamStyleSchema = z.object({
  label: z.string().optional(),
  fill: z.string().optional(),
  text: z.string().optional(),
});

export const DrillSchema = z.object({
  $schema: z.string().optional(),
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/, "lowercase letters, digits and dashes only"),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "hex color like #1e40af")
    .optional(),
  pitch: PitchRefSchema,
  teams: z
    .object({
      home: TeamStyleSchema.optional(),
      away: TeamStyleSchema.optional(),
      neutral: TeamStyleSchema.optional(),
    })
    .optional(),
  entities: z.array(EntitySchema),
  steps: z.array(StepSchema).min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  rev: z.number().int().optional(),
});

export type SchemaDrill = z.infer<typeof DrillSchema>;

// Compile-time drift guard: Drill (types.ts) and SchemaDrill (zod) must stay
// mutually assignable. If either side changes alone, this stops the build.
export const __typeChecks = (a: Drill, b: SchemaDrill): [SchemaDrill, Drill] => [a, b];

export interface DrillIssue {
  level: "error" | "warning";
  message: string;
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/** Cross-field rules the structural schema can't express. */
export function semanticIssues(drill: Drill): DrillIssue[] {
  const issues: DrillIssue[] = [];
  const ids = new Set<string>();
  for (const e of drill.entities) {
    if (ids.has(e.id)) issues.push({ level: "error", message: `duplicate entity id "${e.id}"` });
    ids.add(e.id);
  }
  if (WINDOWS_RESERVED.test(drill.id)) {
    issues.push({ level: "error", message: `drill id "${drill.id}" is a reserved Windows filename` });
  }
  drill.steps.forEach((step, k) => {
    for (const key of Object.keys(step.positions)) {
      if (!ids.has(key)) {
        issues.push({
          level: "warning",
          message: `steps[${k}].positions["${key}"] does not match any entity id (the app will drop it)`,
        });
      }
    }
  });
  const stepCount = drill.steps.length;
  for (const e of drill.entities) {
    if (e.kind === "arrow" || e.kind === "zone" || e.kind === "label") {
      for (const end of [e.from, e.to]) {
        if (end && "ref" in end && !ids.has(end.ref)) {
          issues.push({ level: "error", message: `annotation "${e.id}" anchors to unknown entity "${end.ref}"` });
        }
      }
      if (e.fromStep != null && e.toStep != null && e.fromStep > e.toStep) {
        issues.push({ level: "error", message: `annotation "${e.id}" has fromStep > toStep` });
      }
      if (e.toStep != null && e.toStep >= stepCount) {
        issues.push({
          level: "warning",
          message: `annotation "${e.id}" has toStep ${e.toStep} but the drill only has ${stepCount} steps`,
        });
      }
      if (e.kind === "arrow" && (!e.from || !e.to)) {
        issues.push({ level: "error", message: `arrow "${e.id}" needs both "from" and "to"` });
      }
      if (e.kind === "zone" && !e.rect) {
        issues.push({ level: "error", message: `zone "${e.id}" needs a "rect"` });
      }
      if (e.kind === "label" && !e.text) {
        issues.push({ level: "warning", message: `label "${e.id}" has no text` });
      }
    } else {
      const placed = drill.steps.some((s) => s.positions[e.id]);
      if (!placed) {
        issues.push({ level: "warning", message: `${e.kind} "${e.id}" never appears (no pose in any step)` });
      }
    }
  }
  return issues;
}

/**
 * Parse + sanitize a drill loaded from disk. Throws with a readable message on
 * structural failure; silently drops position keys that reference unknown
 * entities (the documented forgiving behavior for agent-written files).
 */
export function parseDrill(raw: unknown): Drill {
  const result = DrillSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }
  const drill = result.data as Drill;
  const ids = new Set(drill.entities.map((e) => e.id));
  for (const step of drill.steps) {
    for (const key of Object.keys(step.positions)) {
      if (!ids.has(key)) delete step.positions[key];
    }
  }
  return drill;
}
