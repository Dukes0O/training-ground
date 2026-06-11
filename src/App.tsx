import { useMemo } from "react";
import { BoardSvg } from "./board/BoardSvg";
import { useBoardInteraction } from "./board/useBoardInteraction";
import { snapshotAtStep } from "./model/resolve";
import { InspectorPanel } from "./inspector/InspectorPanel";
import { ToolRail } from "./ui/ToolRail";
import { TopBar } from "./ui/TopBar";
import { useHotkeys } from "./ui/useHotkeys";
import { useEditor } from "./state/store";

export default function App() {
  useHotkeys();
  const drill = useEditor((s) => s.drill);
  const currentStep = useEditor((s) => s.currentStep);
  const gridOn = useEditor((s) => s.gridOn);
  const selection = useEditor((s) => s.selection);
  const interaction = useBoardInteraction();

  const snapshot = useMemo(
    () => snapshotAtStep(drill, currentStep, gridOn),
    [drill, currentStep, gridOn]
  );
  const selectionSet = useMemo(() => new Set(selection), [selection]);

  return (
    <div className="flex h-full flex-col bg-zinc-100 text-zinc-900">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 p-4">
          <div className="relative h-full w-full select-none overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm">
            <BoardSvg
              snapshot={snapshot}
              selection={selectionSet}
              onEntityPointerDown={interaction.onEntityPointerDown}
              onBoardPointerDown={interaction.onBoardPointerDown}
              onBoardPointerMove={interaction.onBoardPointerMove}
              onBoardPointerUp={interaction.onBoardPointerUp}
            />
            <ToolRail />
          </div>
        </main>
        <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-zinc-200 bg-white">
          <InspectorPanel />
        </aside>
      </div>
    </div>
  );
}
