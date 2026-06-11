import { MousePointer2 } from "lucide-react";
import type { Tool } from "../state/store";
import { useEditor } from "../state/store";
import { DEFAULT_TEAM_STYLES } from "../model/types";

function ToolButton({
  tool,
  title,
  children,
}: {
  tool: Tool;
  title: string;
  children: React.ReactNode;
}) {
  const active = useEditor((s) => s.tool === tool);
  const setTool = useEditor((s) => s.setTool);
  return (
    <button
      title={title}
      onClick={() => setTool(tool)}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-blue-800/10 text-blue-800 ring-1 ring-blue-800/30"
          : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
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

function ConeDot() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <polygon points="9,3.5 13,13 5,13" fill="#f97316" stroke="#c2410c" strokeWidth="1" strokeLinejoin="round" />
      <rect x="4" y="12.6" width="10" height="1.8" rx="0.9" fill="#f97316" />
    </svg>
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
      <ToolButton tool="add-cone" title="Add cone">
        <ConeDot />
      </ToolButton>
    </div>
  );
}
