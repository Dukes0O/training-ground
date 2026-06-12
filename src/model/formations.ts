import type { PitchFormatId } from "./types";
import type { PitchSpec } from "../pitch/formats";

// Formation presets for one-click team placement. Lines are listed from
// defense to attack (GK is implicit). Slot labels follow broadcast-style
// orientation: the team's left side is the top of the screen when it
// defends the left goal.

export interface Formation {
  id: string;
  label: string;
  /** Outfield lines, defense first, e.g. [4, 4, 2]. */
  lines: number[];
}

export const FORMATIONS: Partial<Record<PitchFormatId, Formation[]>> = {
  "11v11": [
    { id: "4-4-2", label: "4-4-2", lines: [4, 4, 2] },
    { id: "4-3-3", label: "4-3-3", lines: [4, 3, 3] },
    { id: "4-2-3-1", label: "4-2-3-1", lines: [4, 2, 3, 1] },
    { id: "3-5-2", label: "3-5-2", lines: [3, 5, 2] },
  ],
  "9v9": [
    { id: "3-3-2", label: "3-3-2", lines: [3, 3, 2] },
    { id: "3-2-3", label: "3-2-3", lines: [3, 2, 3] },
    { id: "2-4-2", label: "2-4-2", lines: [2, 4, 2] },
  ],
  "8v8": [
    { id: "3-3-1", label: "3-3-1", lines: [3, 3, 1] },
    { id: "2-3-2", label: "2-3-2", lines: [2, 3, 2] },
    { id: "3-2-2", label: "3-2-2", lines: [3, 2, 2] },
  ],
};

const LABELS_BY_LINE: Record<"def" | "mid" | "fwd", Record<number, string[]>> = {
  def: {
    1: ["CB"],
    2: ["LCB", "RCB"],
    3: ["LB", "CB", "RB"],
    4: ["LB", "LCB", "RCB", "RB"],
    5: ["LWB", "LCB", "CB", "RCB", "RWB"],
  },
  mid: {
    1: ["CM"],
    2: ["LCM", "RCM"],
    3: ["LM", "CM", "RM"],
    4: ["LM", "LCM", "RCM", "RM"],
    5: ["LM", "LCM", "CM", "RCM", "RM"],
  },
  fwd: {
    1: ["ST"],
    2: ["LS", "RS"],
    3: ["LW", "ST", "RW"],
    4: ["LW", "LS", "RS", "RW"],
  },
};

function lineKind(index: number, total: number): "def" | "mid" | "fwd" {
  if (index === 0) return "def";
  if (index === total - 1) return "fwd";
  return "mid";
}

export interface FormationSlot {
  x: number;
  y: number;
  position: string;
  number: number;
}

/**
 * Compute placement slots for a formation. `defending` is which goal the team
 * protects; the shape occupies that half of the pitch, GK first. Numbers run
 * 1 (GK), then 2..N through the lines defense-to-attack, left-to-right.
 */
export function buildFormationSlots(
  spec: PitchSpec,
  formation: Formation,
  defending: "left" | "right"
): FormationSlot[] {
  const L = spec.length;
  const W = spec.width;
  const slots: FormationSlot[] = [];
  const mirrorX = (x: number) => (defending === "left" ? x : L - x);

  slots.push({ x: mirrorX(0.055 * L), y: W / 2, position: "GK", number: 1 });

  const lineCount = formation.lines.length;
  const firstX = 0.17;
  const lastX = 0.44;
  let number = 2;
  formation.lines.forEach((count, li) => {
    const xFrac = lineCount === 1 ? (firstX + lastX) / 2 : firstX + ((lastX - firstX) * li) / (lineCount - 1);
    const kind = lineKind(li, lineCount);
    const labels = LABELS_BY_LINE[kind][count] ?? Array.from({ length: count }, () => kind.toUpperCase());
    for (let i = 0; i < count; i++) {
      // Spread the line across the width with a margin; index 0 = team's left
      // = top of screen when defending left, mirrored otherwise.
      const margin = count >= 4 ? 0.14 : count === 3 ? 0.2 : count === 2 ? 0.3 : 0.5;
      const yFrac = count === 1 ? 0.5 : margin + ((1 - 2 * margin) * i) / (count - 1);
      const y = defending === "left" ? yFrac * W : (1 - yFrac) * W;
      slots.push({ x: mirrorX(xFrac * L), y, position: labels[i], number: number++ });
    }
  });
  return slots;
}

export interface RosterFillPlayer {
  id: string;
  name: string;
  number?: number;
  position?: string;
}

/**
 * Pair formation slots with roster players: exact position-label matches
 * first, the rest in roster order. Returns, per slot, the roster player to
 * stamp onto it (or null). Roster name/number win over slot defaults.
 */
export function matchRosterToSlots(
  slots: FormationSlot[],
  roster: RosterFillPlayer[]
): (RosterFillPlayer | null)[] {
  const remaining = roster.filter((p) => p.name);
  const out: (RosterFillPlayer | null)[] = new Array(slots.length).fill(null);
  for (let i = 0; i < slots.length; i++) {
    const idx = remaining.findIndex(
      (p) => p.position && p.position.toUpperCase() === slots[i].position.toUpperCase()
    );
    if (idx >= 0) out[i] = remaining.splice(idx, 1)[0];
  }
  for (let i = 0; i < slots.length; i++) {
    if (!out[i] && remaining.length > 0) out[i] = remaining.shift()!;
  }
  return out;
}
