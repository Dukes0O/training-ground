import { useEffect, useMemo } from "react";
import { initPersistence } from "./api/persistence";
import { BoardSvg } from "./board/BoardSvg";
import { BoardViewport } from "./board/BoardViewport";
import { EditorOverlay } from "./board/EditorOverlay";
import { useBoardInteraction } from "./board/useBoardInteraction";
import { sceneAt, snapshotAtStep } from "./model/resolve";
import { InspectorPanel } from "./inspector/InspectorPanel";
import { LibraryPanel } from "./library/LibraryPanel";
import { RosterDialog } from "./roster/RosterDialog";
import { Timeline } from "./timeline/Timeline";
import { usePlaybackClock } from "./timeline/usePlaybackClock";
import { ConflictModal } from "./ui/ConflictModal";
import { ExportProgressModal } from "./ui/ExportProgressModal";
import { PlaceTeamDialog } from "./ui/PlaceTeamDialog";
import { RecordDialog } from "./ui/RecordDialog";
import { SettingsDialog } from "./ui/SettingsDialog";
import { ToastHost } from "./ui/ToastHost";
import { TrashDialog } from "./ui/TrashDialog";
import { ToolRail } from "./ui/ToolRail";
import { TopBar } from "./ui/TopBar";
import { useHotkeys } from "./ui/useHotkeys";
import { useEditor } from "./state/store";

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

export default function App() {
  useHotkeys();
  usePlaybackClock();
  useEffect(() => {
    void initPersistence();
  }, []);

  const drill = useEditor((s) => s.drill);
  const currentStep = useEditor((s) => s.currentStep);
  const gridOn = useEditor((s) => s.gridOn);
  const selection = useEditor((s) => s.selection);
  const mode = useEditor((s) => s.mode);
  const timeMs = useEditor((s) => s.timeMs);
  const recordingActive = useEditor((s) => s.recordingActive);
  const snapshot = useMemo(
    () =>
      mode === "playback"
        ? sceneAt(drill, timeMs, gridOn)
        : snapshotAtStep(drill, currentStep, gridOn),
    [drill, currentStep, gridOn, mode, timeMs]
  );
  const interaction = useBoardInteraction(snapshot);
  const selectionSet = useMemo(() => new Set(selection), [selection]);
  const editing = mode === "edit";

  return (
    <div className="flex h-full flex-col bg-zinc-100 text-zinc-900">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LibraryPanel />
        <main className="relative min-w-0 flex-1 p-4">
          <div
            data-board-root
            className={`relative h-full w-full select-none overflow-hidden rounded-xl border bg-zinc-50 shadow-sm ${
              recordingActive ? "border-red-400 ring-4 ring-red-500/60" : "border-zinc-200"
            }`}
          >
            <BoardViewport>
              <BoardSvg
                snapshot={snapshot}
                selection={editing ? selectionSet : EMPTY_SELECTION}
                onEntityPointerDown={editing ? interaction.onEntityPointerDown : undefined}
                onBoardPointerDown={editing ? interaction.onBoardPointerDown : undefined}
                onBoardPointerMove={editing ? interaction.onBoardPointerMove : undefined}
                onBoardPointerUp={editing ? interaction.onBoardPointerUp : undefined}
              >
                {editing && (
                  <EditorOverlay
                    snapshot={snapshot}
                    selection={selectionSet}
                    preview={interaction.preview}
                    onHandlePointerDown={interaction.onHandlePointerDown}
                  />
                )}
              </BoardSvg>
            </BoardViewport>
            {editing && <ToolRail />}
          </div>
        </main>
        <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-zinc-200 bg-white">
          <InspectorPanel />
        </aside>
      </div>
      <Timeline />
      <RosterDialog />
      <PlaceTeamDialog />
      <ConflictModal />
      <ExportProgressModal />
      <RecordDialog />
      <TrashDialog />
      <SettingsDialog />
      <ToastHost />
    </div>
  );
}
