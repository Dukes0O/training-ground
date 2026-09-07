import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, MousePointer2, SlidersHorizontal, Type, Users, X } from "lucide-react";
import type { Tool } from "../state/store";
import { useEditor } from "../state/store";
import { resolveTeamStyles } from "../model/types";
import { EQUIPMENT_LABELS } from "../board/entities/EquipmentGlyph";
import "./editor-workspace.css";

function railBtnCls(active: boolean) {
  return `tg-tool-button${active ? " is-active" : ""}`;
}

function ToolButton({ tool, title, label, onSelect, children }: { tool: Tool; title: string; label: string; onSelect: () => void; children: React.ReactNode }) {
  const active = useEditor((s) => s.tool === tool);
  const setTool = useEditor((s) => s.setTool);
  return (
    <button title={title} aria-label={title} aria-pressed={active} onClick={() => { setTool(tool); onSelect(); }} className={railBtnCls(active)}>
      {children}
      <span>{label}</span>
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
  label,
  onSelect,
}: {
  options: { tool: Tool; label: string; icon: React.ReactNode }[];
  groupTools: Tool[];
  title: string;
  label: string;
  onSelect: () => void;
}) {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<Tool>(options[0].tool);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const activeInGroup = groupTools.includes(tool);
  const shown = options.find((o) => o.tool === (activeInGroup ? tool : last)) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    (menu?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? menu?.querySelector("button"))?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="tg-tool-flyout"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={railBtnCls(activeInGroup)}
      >
        {shown.icon}
        <span>{label}</span>
        <ChevronDown size={9} className="tg-tool-chevron" />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={title}
          className="tg-tool-menu"
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
              : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
          }}
        >
          <div className="tg-tool-menu-title">{label === "Arrows" ? "Show the movement" : "Set up the pitch"}</div>
          {options.map((o) => (
            <button
              key={o.tool}
              role="menuitemradio"
              aria-checked={tool === o.tool}
              onClick={() => {
                setTool(o.tool);
                setLast(o.tool);
                setOpen(false);
                triggerRef.current?.focus();
                onSelect();
              }}
              className={`tg-tool-menu-option${tool === o.tool ? " is-active" : ""}`}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ToolRail() {
  // Select the stable drill reference; derive styles outside the selector.
  const drill = useEditor((s) => s.drill);
  const tool = useEditor((s) => s.tool);
  const teams = resolveTeamStyles(drill);
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 800px)").matches);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const paletteId = useId();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const sync = () => { setCompact(media.matches); setPaletteOpen(false); };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!compact) return;
    if (paletteOpen) closeRef.current?.focus();
    else if (restoreFocus.current) {
      launcherRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [compact, paletteOpen]);

  const collapse = (focusLauncher = true) => {
    if (!compact) return;
    restoreFocus.current = focusLauncher;
    setPaletteOpen(false);
  };
  const chooseTool = () => collapse();
  const activeLabel = tool === "select" ? "Select and move" : tool.replaceAll("-", " ");

  return (
    <>
    {compact && <button
      ref={launcherRef}
      className={`tg-tools-launcher${tool !== "select" ? " has-active-tool" : ""}`}
      title={`Board tools. Current tool: ${activeLabel}`}
      aria-expanded={paletteOpen}
      aria-controls={paletteOpen ? paletteId : undefined}
      onClick={() => paletteOpen ? collapse() : setPaletteOpen(true)}
      onKeyDown={(event) => { if (event.key === " ") event.stopPropagation(); }}
    ><SlidersHorizontal size={15} aria-hidden="true" />Tools</button>}
    {(!compact || paletteOpen) &&
    <div
      id={paletteId}
      className={`tg-tool-rail${compact ? " is-compact" : ""}`}
      role="region"
      aria-label="Board tools"
      onKeyDown={(event) => {
        if (event.key === " " || event.key.startsWith("Arrow")) event.stopPropagation();
        if (compact && event.key === "Escape") { event.stopPropagation(); collapse(); }
      }}
    >
      {compact && <div className="tg-tools-panel-heading"><span>Board tools</span><button ref={closeRef} onClick={() => collapse()} aria-label="Close board tools" title="Close board tools"><X size={15} aria-hidden="true" /></button></div>}
      <ToolButton tool="select" title="Select and move (Esc)" label="Select & move" onSelect={chooseTool}>
        <MousePointer2 size={17} />
      </ToolButton>
      <div className="tg-tool-group" role="group" aria-label="Add players">
        <div className="tg-tool-group-label">Players</div>
        <div className="tg-tool-grid tg-tool-grid-three">
          <ToolButton tool="add-home" title={`Add ${teams.home.label.toLowerCase()} player`} label={teams.home.label} onSelect={chooseTool}>
            <PlayerDot fill={teams.home.fill} />
          </ToolButton>
          <ToolButton tool="add-away" title={`Add ${teams.away.label.toLowerCase()} player`} label={teams.away.label} onSelect={chooseTool}>
            <PlayerDot fill={teams.away.fill} />
          </ToolButton>
          <ToolButton tool="add-neutral" title={`Add ${teams.neutral.label.toLowerCase()} player`} label={teams.neutral.label} onSelect={chooseTool}>
            <PlayerDot fill={teams.neutral.fill} />
          </ToolButton>
        </div>
      </div>
      <div className="tg-tool-group" role="group" aria-label="Pitch setup">
        <div className="tg-tool-group-label">Setup</div>
        <div className="tg-tool-grid">
          <ToolButton tool="add-ball" title="Add ball" label="Ball" onSelect={chooseTool}>
            <BallDot />
          </ToolButton>
          <Flyout
            title="Equipment"
            label="Gear"
            onSelect={chooseTool}
            groupTools={EQUIPMENT_OPTIONS}
            options={EQUIPMENT_OPTIONS.map((tool) => ({
              tool,
              label: EQUIPMENT_LABELS[tool.slice(4)] ?? tool,
              icon: EQUIPMENT_ICONS[tool],
            }))}
          />
        </div>
      </div>
      <div className="tg-tool-group" role="group" aria-label="Draw on the pitch">
        <div className="tg-tool-group-label">Draw</div>
        <div className="tg-tool-grid tg-tool-grid-three">
          <Flyout
            title="Choose an arrow, then drag on the board"
            label="Arrows"
            onSelect={chooseTool}
            groupTools={ARROW_OPTIONS.map((o) => o.tool)}
            options={ARROW_OPTIONS.map((o) => ({ ...o, icon: <ArrowIcon style={o.tool} /> }))}
          />
          <ToolButton tool="draw-zone" title="Zone — drag a rectangle" label="Zone" onSelect={chooseTool}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <rect x="3" y="4" width="12" height="10" rx="1" fill="rgba(250,204,21,0.25)" stroke="#ca8a04" strokeWidth="1.3" strokeDasharray="2.6 1.8" />
            </svg>
          </ToolButton>
          <ToolButton tool="add-label" title="Add a text label" label="Text" onSelect={chooseTool}>
            <Type size={16} />
          </ToolButton>
        </div>
      </div>
      <PlaceTeamButton onSelect={() => collapse(false)} />
    </div>}
    </>
  );
}

function PlaceTeamButton({ onSelect }: { onSelect: () => void }) {
  const setPlaceTeamOpen = useEditor((s) => s.setPlaceTeamOpen);
  return (
    <button
      title="Place a full team (formation preset)"
      aria-label="Place a full team using a formation preset"
      onClick={() => { setPlaceTeamOpen(true); onSelect(); }}
      className="tg-tool-button tg-formation-button"
    >
      <Users size={17} />
      <span>Formation</span>
    </button>
  );
}
