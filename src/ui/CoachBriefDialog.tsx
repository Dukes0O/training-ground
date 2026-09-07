import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Clipboard, Mic, Sprout, X } from "lucide-react";
import "./coach-brief.css";

type CoachBrief = {
  objective: string;
  ageGroup: string;
  players: string;
  space: string;
  time: string;
  progression: string;
};

const DRAFT_KEY = "training-ground:coach-brief:v1";
const DEFAULT_BRIEF: CoachBrief = {
  objective: "",
  ageGroup: "U11–U13",
  players: "12 players",
  space: "30 × 20 metres",
  time: "15 minutes",
  progression: "",
};

const STARTERS = [
  {
    label: "Play out of pressure",
    objective:
      "Help players scan before receiving, open their body and find a teammate when pressed.",
  },
  {
    label: "Win it back",
    objective:
      "Help the nearest players react together after losing the ball while teammates protect the space behind them.",
  },
  {
    label: "Combine to finish",
    objective:
      "Help players use a wall pass or an overlapping run to create a chance and finish.",
  },
];

function loadDraft(): CoachBrief {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(DRAFT_KEY) ?? "null",
    );
    if (!saved || typeof saved !== "object" || Array.isArray(saved))
      return { ...DEFAULT_BRIEF };
    const draft = { ...DEFAULT_BRIEF };
    for (const key of Object.keys(DEFAULT_BRIEF) as (keyof CoachBrief)[]) {
      const value = (saved as Record<string, unknown>)[key];
      if (typeof value === "string") draft[key] = value.slice(0, 6000);
    }
    return draft;
  } catch {
    return { ...DEFAULT_BRIEF };
  }
}

function makePrompt(brief: CoachBrief): string {
  return [
    "Create a new animated soccer drill in this Training Ground repository.",
    "",
    "What I want players to achieve:",
    brief.objective.trim() || "[Describe what you want players to improve.]",
    "",
    "Session context:",
    `- Age group: ${brief.ageGroup.trim() || "Choose a suitable age group and explain the assumption."}`,
    `- Players: ${brief.players.trim() || "Choose a practical group size."}`,
    `- Available space: ${brief.space.trim() || "Choose suitable dimensions."}`,
    `- Practice time: ${brief.time.trim() || "Suggest a practice duration."}`,
    ...(brief.progression.trim()
      ? ["", "Progression or other requests:", brief.progression.trim()]
      : []),
    "",
    "Read AGENTS.md and docs/drill-authoring.md, then use an existing drill as a format reference.",
    "Create a new JSON file in drills/ with a unique filename matching its id and the drill schema reference. Keep existing drills intact.",
    "Include a clear setup, realistic player and ball movement, named animation steps, coaching points, and a simpler and harder variation. Keep the description concise; put the practice rules, coaching guide and player rotation in the drill's notes. Use metres for pitch coordinates and give each coaching beat time to be seen.",
    "Run npm run validate -- drills/<your-file>.json and resolve any errors. Tell me the drill title, how to run it, and any assumptions you made.",
  ].join("\n");
}

export function CoachBriefDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const objectiveRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLTextAreaElement>(null);
  const [brief, setBrief] = useState<CoachBrief>(loadDraft);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "select">(
    "idle",
  );
  const prompt = useMemo(() => makePrompt(brief), [brief]);
  const ready = brief.objective.trim().length > 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    objectiveRef.current?.focus();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(brief));
    } catch {
      // Writing a brief still works when browser storage is unavailable.
    }
  }, [brief]);

  function update(field: keyof CoachBrief, value: string) {
    setBrief((current) => ({ ...current, [field]: value }));
    setCopyState("idle");
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
    } catch {
      previewRef.current?.focus();
      previewRef.current?.select();
      setCopyState("select");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="coach-brief-dialog"
      aria-labelledby="coach-brief-title"
      aria-describedby="coach-brief-intro"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="coach-brief-shell">
        <header className="coach-brief-header">
          <div>
            <span className="coach-brief-eyebrow">
              <Sprout size={15} /> YOUR NEXT PRACTICE
            </span>
            <h2 id="coach-brief-title">Describe it. Build it. Coach it.</h2>
            <p id="coach-brief-intro">
              Start with what you want your players to learn. Take the brief to
              your Codex task for Training Ground to build the animated drill.
            </p>
          </div>
          <button
            type="button"
            className="coach-brief-close"
            onClick={onClose}
            aria-label="Close drill brief"
          >
            <X size={20} />
          </button>
        </header>

        <div className="coach-brief-body">
          <div className="coach-brief-form">
            <label className="coach-brief-label" htmlFor="coach-objective">
              What should your players get better at?
            </label>
            <textarea
              ref={objectiveRef}
              id="coach-objective"
              className="coach-brief-objective"
              value={brief.objective}
              maxLength={6000}
              onChange={(event) => update("objective", event.target.value)}
              placeholder="I want my players to look up before receiving, find space and play forward under pressure…"
              aria-describedby="coach-dictation-tip"
              rows={4}
            />
            <p className="coach-brief-hint" id="coach-dictation-tip">
              <Mic size={14} /> Type here, or use your device’s dictation.
            </p>
            <div
              className="coach-brief-starters"
              aria-label="Ideas to get started"
            >
              {STARTERS.map((starter) => (
                <button
                  type="button"
                  key={starter.label}
                  onClick={() => update("objective", starter.objective)}
                >
                  {starter.label}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>

            <div className="coach-brief-fields">
              {(
                [
                  ["ageGroup", "Age group", "e.g. U11–U13"],
                  ["players", "Players", "e.g. 12, including 2 keepers"],
                  ["space", "Available space", "e.g. 30 × 20 metres"],
                  ["time", "Practice time", "e.g. 15 minutes"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="coach-brief-label" htmlFor={`coach-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`coach-${key}`}
                    value={brief[key]}
                    maxLength={200}
                    placeholder={placeholder}
                    onChange={(event) => update(key, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <label className="coach-brief-label" htmlFor="coach-progression">
              Anything else? <span>Optional</span>
            </label>
            <textarea
              id="coach-progression"
              value={brief.progression}
              maxLength={6000}
              onChange={(event) => update("progression", event.target.value)}
              placeholder="Equipment, a progression, a match situation, or something that worked last week…"
              rows={3}
            />
            <p className="coach-brief-local-note">
              Your draft stays in this browser when storage is available.
            </p>
          </div>

          <aside className="coach-brief-preview">
            <div className="coach-brief-preview-heading">
              <span className="coach-brief-step">02</span>
              <div>
                <h3>Your coaching brief</h3>
                <p>Ready to take into Codex</p>
              </div>
            </div>
            <label className="coach-brief-sr-only" htmlFor="coach-prompt">
              Generated brief to copy into Codex
            </label>
            <textarea
              ref={previewRef}
              id="coach-prompt"
              className="coach-brief-prompt"
              readOnly
              value={prompt}
              spellCheck={false}
            />
            <div className="coach-brief-handoff">
              <ArrowUpRight size={18} />
              <p>
                Copy this brief and paste it into a Codex task opened in the{" "}
                <strong>Training Ground</strong> repository. Codex creates the
                drill there.
              </p>
            </div>
            <button
              type="button"
              className="coach-brief-copy"
              onClick={() => {
                void copyBrief();
              }}
              disabled={!ready}
            >
              {copyState === "copied" ? (
                <Check size={17} />
              ) : (
                <Clipboard size={17} />
              )}
              {copyState === "copied" ? "Brief copied" : "Copy brief for Codex"}
            </button>
            <p className="coach-brief-status" role="status" aria-live="polite">
              {copyState === "copied"
                ? "Now paste it into your Training Ground task."
                : copyState === "select"
                  ? "Clipboard access is unavailable. The brief is selected above; press Ctrl+C or ⌘C to copy."
                  : !ready
                    ? "Add a coaching objective to prepare your brief."
                    : "You can review the full brief above before copying."}
            </p>
          </aside>
        </div>
      </div>
    </dialog>
  );
}
