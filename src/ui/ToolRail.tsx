import { useState } from "react";
import { MousePointer2, Type, Users } from "lucide-react";
import type { Tool } from "../state/store";
import { useEditor } from "../state/store";
import { DEFAULT_TEAM_STYLES } from "../model/types";
import { EQUIPMENT_LABELS } from "../board/entities/EquipmentGlyph";

function railBtnCls(active: boolean) {
  return `flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
    active ? "bg-blue-800/10 text-blue-800 ring-1 ring-blue-800/30" : "text-zinc-600 hover:bg-zinc-100"
  }`;
}

function ToolButton({ tool, title, children }: { tool: Tool; title: string; children: React.ReactNode }) {
  const active = useEditor((s) => s.tool === tool);
  const setTool = useEditor((s) => s.setTool);
  return (
    <button title={title} onClick={() => setTool(tool)} className={railBtnCls(active)}>
      {children}
    </button>
  );
}

function PlayerDot({ fill }: { fill: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="6.5" fill={fill} stroke="white" strokeWidth="1.5" />
      <path d="M9 6.2v5.6 M6.2 9h5.6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BallDot() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="6.5" fill="white" stroke="#1f2937" strokeWidth="1.3" />
      <polygon points="9,6.4 11.4,8.2 10.5,11 7.5,11 6.6,8.2" fill="#1f2937" />
    </svg>
  );
}

const EQUIPMENT_ICONS: Record<string, React.ReactNode> = {
  "add-cone": (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <polygon points="9,3.5 13,13 5,13" fill="#f97316" stroke="#c2410c" strokeWidth="1" strokeLinejoin="round" />
      <rect x="4" y="12.6" width="10" height="1.8" rx="0.9" fill="#f97316" />
    </svg>
  ),
  "add-flat": (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="5.5" fill="#facc15" stroke="#a16207" strokeWidth="1" />
    </svg>
  ),
  "add-minigoal": (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <rect x="3" y="6" width="12" height="6" fill="rgba(0,0,0,0.06)" stroke="#52525b" strokeWidth="1.4" />
      <line x1="3" y1="12" x2="15" y2="12" stroke="#52525b" strokeWidth="2" />
    </svg>
  ),
  "add-ladder": (
    <svg width="18" height="18" viewBox="0 0 18 18" stroke="#52525b" strokeWidth="1.2">
      <line x1="3" y1="6" x2="15" y2="6" />
      <line x1="3" y1="12" x2="15" y2="12" />
      <line x1="5" y1="6" x2="5" y2="12" />
      <line x1="9" y1="6" x2="9" y2="12" />
      <line x1="13" y1="6" x2="13" y2="12" />
    </svg>
  ),
  "add-mannequin": (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="4.5" fill="#2563eb" />
      <circle cx="9" cy="9" r="1.8" fill="white" />
      <line x1="3" y1="9" x2="15" y2="9" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  "add-pole": (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="3.4" fill="#f87171" stroke="#b91c1c" strokeWidth="1" />
      <circle cx="9" cy="9" r="1.1" fill="white" />
    </svg>
  ),
  "add-hurdle": (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <rect x="3" y="7.5" width="12" height="3" rx="1.2" fill="#52525b" />
      <circle cx="4.5" cy="12.5" r="1.1" fill="#52525b" />
      <circle cx="13.5" cy="12.5" r="1.1" fill="#52525b" />
    </svg>
  ),
};

function ArrowIcon({ style }: { style: string }) {
  const head = <polygon points="14,9 10.4,6.8 10.4,11.2" fill="currentColor" />;
  if (style === "draw-run")
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" className="text-zinc-700">
        <line x1="3" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.4 1.8" />
        {head}
      </svg>
    );
  if (style === "draw-dribble")
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" className="text-zinc-700">
        <path d="M3 9 q 1.2 -2.4 2.4 0 t 2.4 0 t 2.4 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {head}
      </svg>
    );
  if (style === "draw-shot")
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" className="text-zinc-700">
        <line x1="3" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="3" />
        {head}
      </svg>
    );
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="text-zinc-700">
      <line x1="3" y1="9" x2="10.6" y2="9" stroke="currentColor" strokeWidth="1.6" />
      {head}
    </svg>
  );
}

const ARROW_OPTIONS: { tool: Tool; label: string }[] = [
  { tool: "draw-pass", label: "Pass (solid)" },
  { tool: "draw-run", label: "Run (dashed)" },
  { tool: "draw-dribble", label: "Dribble (wavy)" },
  { tool: "draw-shot", label: "Shot (thick)" },
];

const EQUIPMENT_OPTIONS: Tool[] = [
  "add-cone",
  "add-flat",
  "add-minigoal",
  "add-ladder",
  "add-mannequin",
  "add-pole",
  "add-hurdle",
];

function Flyout({
  options,
  groupTools,
  title,
}: {
  options: { tool: Tool; label: string; icon: React.ReactNode }[];
  groupTools: Tool[];
  title: string;
}) {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<Tool>(options[0].tool);
  const activeInGroup = groupTools.includes(tool);
  const shown = options.find((o) => o.tool === (activeInGroup ? tool : last)) ?? options[0];

  return (
    <div className="relative">
      <button
        title={`${title} — click again for options`}
        onClick={() => {
          if (activeInGroup) setOpen((o) => !o);
          else {
            setTool(shown.tool);
            setOpen(true);
          }
        }}
        className={railBtnCls(activeInGroup)}
      >
        {shown.icon}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-full top-0 z-20 ml-1.5 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
            {options.map((o) => (
              <button
                key={o.tool}
                onClick={() => {
                  setTool(o.tool);
                  setLast(o.tool);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                  tool === o.tool ? "bg-blue-800/10 text-blue-800" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {o.icon}
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ToolRail() {
  return (
    <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-xl border border-zinc-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
      <ToolButton tool="select" title="Select & move (Esc)">
        <MousePointer2 size={17} />
      </ToolButton>
      <div className="my-0.5 h-px w-6 bg-zinc-200" />
      <ToolButton tool="add-home" title="Add home player">
        <PlayerDot fill={DEFAULT_TEAM_STYLES.home.fill} />
      </ToolButton>
      <ToolButton tool="add-away" title="Add away player">
        <PlayerDot fill={DEFAULT_TEAM_STYLES.away.fill} />
      </ToolButton>
      <ToolButton tool="add-neutral" title="Add neutral player">
        <PlayerDot fill={DEFAULT_TEAM_STYLES.neutral.fill} />
      </ToolButton>
      <div className="my-0.5 h-px w-6 bg-zinc-200" />
      <ToolButton tool="add-ball" title="Add ball">
        <BallDot />
      </ToolButton>
      <Flyout
        title="Equipment"
        groupTools={EQUIPMENT_OPTIONS}
        options={EQUIPMENT_OPTIONS.map((tool) => ({
          tool,
          label: EQUIPMENT_LABELS[tool.slice(4)] ?? tool,
          icon: EQUIPMENT_ICONS[tool],
        }))}
      />
      <div className="my-0.5 h-px w-6 bg-zinc-200" />
      <Flyout
        title="Arrows — drag on the board"
        groupTools={ARROW_OPTIONS.map((o) => o.tool)}
        options={ARROW_OPTIONS.map((o) => ({ ...o, icon: <ArrowIcon style={o.tool} /> }))}
      />
      <ToolButton tool="draw-zone" title="Zone — drag a rectangle">
        <svg width="18" height="18" viewBox="0 0 18 18">
          <rect x="3" y="4" width="12" height="10" rx="1" fill="rgba(250,204,21,0.25)" stroke="#ca8a04" strokeWidth="1.3" strokeDasharray="2.6 1.8" />
        </svg>
      </ToolButton>
      <ToolButton tool="add-label" title="Text label">
        <Type size={16} />
      </ToolButton>
      <div className="my-0.5 h-px w-6 bg-zinc-200" />
      <PlaceTeamButton />
    </div>
  );
}

function PlaceTeamButton() {
  const setPlaceTeamOpen = useEditor((s) => s.setPlaceTeamOpen);
  return (
    <button
      title="Place a full team (formation preset)"
      onClick={() => setPlaceTeamOpen(true)}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100"
    >
      <Users size={17} />
    </button>
  );
}
