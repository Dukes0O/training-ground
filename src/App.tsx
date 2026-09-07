import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  ChevronRight,
  CircleHelp,
  ClipboardPenLine,
  Goal,
  LayoutGrid,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import {
  deleteDrillById,
  duplicateDrill,
  initPersistence,
  newDrill,
  openDrill,
} from "./api/persistence";
import { BoardSvg } from "./board/BoardSvg";
import { BoardViewport } from "./board/BoardViewport";
import { EditorOverlay } from "./board/EditorOverlay";
import { useBoardInteraction } from "./board/useBoardInteraction";
import {
  getTimeline,
  sceneAt,
  snapshotAtStep,
  stepAtTime,
} from "./model/resolve";
import { InspectorPanel } from "./inspector/InspectorPanel";
import { LibraryPanel } from "./library/LibraryPanel";
import { RosterDialog } from "./roster/RosterDialog";
import { Timeline } from "./timeline/Timeline";
import { usePlaybackClock } from "./timeline/usePlaybackClock";
import { ConflictModal } from "./ui/ConflictModal";
import { ExportProgressModal } from "./ui/ExportProgressModal";
import { HelpDialog } from "./ui/HelpDialog";
import { PlaceTeamDialog } from "./ui/PlaceTeamDialog";
import { RecordDialog } from "./ui/RecordDialog";
import { SettingsDialog } from "./ui/SettingsDialog";
import { ToastHost } from "./ui/ToastHost";
import { TrashDialog } from "./ui/TrashDialog";
import { ToolRail } from "./ui/ToolRail";
import { TopBar } from "./ui/TopBar";
import { CoachBriefDialog } from "./ui/CoachBriefDialog";
import { useHotkeys } from "./ui/useHotkeys";
import { useEditor } from "./state/store";

const EMPTY_SELECTION: ReadonlySet<string> = new Set();
type View = "library" | "saved" | "board";

export default function App() {
  const [view, setView] = useState<View>("library");
  const [briefOpen, setBriefOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(
    () => window.matchMedia("(min-width: 801px)").matches,
  );
  const switching = useRef(false);
  const [inspectorTab, setInspectorTab] = useState<"notes" | "edit">("notes");
  useHotkeys(view === "board" && !briefOpen);
  usePlaybackClock();
  useEffect(() => {
    void initPersistence();
  }, []);
  const drill = useEditor((s) => s.drill);
  const drillId = useEditor((s) => s.drillId);
  const currentStep = useEditor((s) => s.currentStep);
  const gridOn = useEditor((s) => s.gridOn);
  const selection = useEditor((s) => s.selection);
  const mode = useEditor((s) => s.mode);
  const timeMs = useEditor((s) => s.timeMs);
  const recordingActive = useEditor((s) => s.recordingActive);
  const timeline = useMemo(() => getTimeline(drill), [drill]);
  const visibleStep =
    mode === "playback" ? stepAtTime(timeline, timeMs) : currentStep;
  const snapshot = useMemo(
    () =>
      mode === "playback"
        ? sceneAt(drill, timeMs, gridOn)
        : snapshotAtStep(drill, currentStep, gridOn),
    [drill, currentStep, gridOn, mode, timeMs],
  );
  const interaction = useBoardInteraction(snapshot);
  const selectionSet = useMemo(() => new Set(selection), [selection]);
  const editing = mode === "edit";
  useEffect(() => {
    if (selection.length) {
      setInspectorTab("edit");
      if (window.matchMedia("(min-width: 801px)").matches)
        setInspectorOpen(true);
    }
  }, [selection]);
  const navigate = (next: View) => {
    if (switching.current) return;
    if (next !== "board" && useEditor.getState().recordingActive) {
      useEditor
        .getState()
        .addToast(
          "info",
          "Stop and save the recording before leaving the board.",
        );
      return;
    }
    if (next !== "board") useEditor.getState().pause();
    setView(next);
  };
  const open = async (id: string) => {
    if (switching.current || !useEditor.getState().drillId) return;
    switching.current = true;
    try {
      if (id !== useEditor.getState().drillId) await openDrill(id);
      if (useEditor.getState().drillId === id) {
        setInspectorTab("notes");
        setView("board");
      }
    } finally {
      switching.current = false;
    }
  };
  const create = async () => {
    if (switching.current || !useEditor.getState().drillId) return;
    switching.current = true;
    try {
      const previous = useEditor.getState().drillId;
      await newDrill();
      if (useEditor.getState().drillId !== previous) {
        setInspectorTab("edit");
        setView("board");
      }
    } finally {
      switching.current = false;
    }
  };
  const duplicate = async (id: string) => {
    if (switching.current || !useEditor.getState().drillId) return;
    switching.current = true;
    try {
      const previous = useEditor.getState().drillId;
      await duplicateDrill(id);
      if (useEditor.getState().drillId !== previous) {
        setInspectorTab("edit");
        setView("board");
      }
    } finally {
      switching.current = false;
    }
  };
  const trash = async (id: string) => {
    if (switching.current || !useEditor.getState().drillId) return;
    switching.current = true;
    try {
      await deleteDrillById(id);
    } finally {
      switching.current = false;
    }
  };
  return (
    <div className={`app-shell ${view === "board" ? "is-board" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="app-sidebar">
        <button
          className="app-brand"
          onClick={() => navigate("library")}
          aria-label="Training Ground home"
        >
          <span className="brand-mark">
            <Goal size={25} strokeWidth={1.7} />
          </span>
          <span>
            TRAINING
            <br />
            <strong>GROUND</strong>
          </span>
        </button>
        <span className="sidebar-label">WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          <button
            className={view === "library" ? "selected" : ""}
            aria-current={view === "library" ? "page" : undefined}
            onClick={() => navigate("library")}
            title="Drill library"
          >
            <LayoutGrid size={19} />
            <span>Drill library</span>
          </button>
          <button
            className={view === "board" ? "selected" : ""}
            aria-current={view === "board" ? "page" : undefined}
            onClick={() => navigate("board")}
            disabled={!drillId}
            title="Tactics board"
          >
            <ClipboardPenLine size={19} />
            <span>Tactics board</span>
          </button>
          <button
            className={view === "saved" ? "selected" : ""}
            aria-current={view === "saved" ? "page" : undefined}
            onClick={() => navigate("saved")}
            title="Saved drills"
          >
            <Bookmark size={19} />
            <span>Saved drills</span>
          </button>
          <button
            onClick={() => useEditor.getState().setRosterOpen(true)}
            title="Team roster"
          >
            <Users size={19} />
            <span>Team roster</span>
          </button>
        </nav>
        <div className="sidebar-brief">
          <span className="brief-icon">
            <Sparkles size={20} />
          </span>
          <h3>Your idea. Next session.</h3>
          <p>Describe what you want your players to learn.</p>
          <button onClick={() => setBriefOpen(true)}>
            Describe a drill <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            onClick={() => useEditor.getState().setTrashOpen(true)}
            title="Recently deleted"
          >
            <ArchiveRestore size={17} />
            <span>Recently deleted</span>
          </button>
          <button
            onClick={() => useEditor.getState().setHelpOpen(true)}
            title="Help and shortcuts"
          >
            <CircleHelp size={17} />
            <span>Help & shortcuts</span>
          </button>
          <button
            onClick={() => useEditor.getState().setSettingsOpen(true)}
            title="Settings"
          >
            <Settings size={17} />
            <span>Settings</span>
          </button>
          <div className="local-status">
            <span /> LOCAL WORKSPACE
          </div>
        </div>
      </aside>
      <div className="app-content">
        {view !== "board" ? (
          <header className="library-topbar">
            <span>
              Workspace <ChevronRight size={14} />{" "}
              <strong>
                {view === "saved" ? "Saved drills" : "Drill library"}
              </strong>
            </span>
            <div>
              <button
                className="button-quiet"
                onClick={() => setBriefOpen(true)}
              >
                <Sparkles size={16} />
                Describe a drill
              </button>
              <button
                className="button-primary"
                disabled={!drillId}
                onClick={() => {
                  void create();
                }}
              >
                <Plus size={16} />
                New drill
              </button>
            </div>
          </header>
        ) : (
          <TopBar />
        )}
        {view !== "board" ? (
          <LibraryPanel
            onDuplicate={(id) => {
              void duplicate(id);
            }}
            onTrash={(id) => {
              void trash(id);
            }}
            onOpen={(id) => {
              void open(id);
            }}
            onBrief={() => setBriefOpen(true)}
            savedOnly={view === "saved"}
          />
        ) : (
          <>
            <div className="board-heading">
              <button onClick={() => navigate("library")}>
                <ArrowLeft size={15} />
                Library
              </button>
              <span>
                <span className="live-dot" />
                {editing ? "DESIGN YOUR DRILL" : "WATCH THE PLAY UNFOLD"}
              </span>
              <button
                aria-expanded={inspectorOpen}
                onClick={() => setInspectorOpen((v) => !v)}
              >
                {inspectorOpen ? (
                  <PanelRightClose size={17} />
                ) : (
                  <PanelRightOpen size={17} />
                )}
                <span>Coaching panel</span>
              </button>
            </div>
            <div className="board-workspace">
              <main className="board-stage" id="main-content">
                <div
                  data-board-root
                  className={`board-canvas ${recordingActive ? "is-recording" : ""}`}
                >
                  <BoardViewport>
                    <BoardSvg
                      snapshot={snapshot}
                      selection={editing ? selectionSet : EMPTY_SELECTION}
                      onEntityPointerDown={
                        editing ? interaction.onEntityPointerDown : undefined
                      }
                      onBoardPointerDown={
                        editing ? interaction.onBoardPointerDown : undefined
                      }
                      onBoardPointerMove={
                        editing ? interaction.onBoardPointerMove : undefined
                      }
                      onBoardPointerUp={
                        editing ? interaction.onBoardPointerUp : undefined
                      }
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
                <div className="board-caption">
                  <span>
                    {editing
                      ? "Drag players to shape the play. Add a step to show what happens next."
                      : "Play the sequence, or select a step to talk it through."}
                  </span>
                  <span>Scroll to zoom · Alt + drag to pan</span>
                </div>
              </main>
              {inspectorOpen && (
                <aside className="coaching-panel" aria-label="Coaching panel">
                  <div className="coaching-tabs">
                    <button
                      className={inspectorTab === "notes" ? "active" : ""}
                      aria-pressed={inspectorTab === "notes"}
                      onClick={() => setInspectorTab("notes")}
                    >
                      <BookOpen size={15} />
                      Coach’s notes
                    </button>
                    <button
                      className={inspectorTab === "edit" ? "active" : ""}
                      aria-pressed={inspectorTab === "edit"}
                      onClick={() => setInspectorTab("edit")}
                    >
                      <Settings size={15} />
                      Edit details
                    </button>
                  </div>
                  {inspectorTab === "edit" ? (
                    <InspectorPanel />
                  ) : (
                    <div className="coach-notes">
                      <div className="eyebrow">THE SESSION IDEA</div>
                      <h2>{drill.title}</h2>
                      <p className="notes-description">
                        {drill.description ||
                          "Give this drill a clear purpose in Edit details."}
                      </p>
                      <div className="notes-metrics">
                        <span>
                          <strong>
                            {
                              drill.entities.filter((e) => e.kind === "player")
                                .length
                            }
                          </strong>{" "}
                          players shown
                        </span>
                        <span>
                          <strong>{drill.steps.length}</strong> animation steps
                        </span>
                      </div>
                      <h3>Coaching guide</h3>
                      <div className="notes-body">
                        {drill.notes ||
                          "No coaching notes yet. Describe what you want to achieve and use the brief to build out this drill with Codex."}
                      </div>
                      <div className="notes-step">
                        <span>
                          STEP {visibleStep + 1} OF {drill.steps.length}
                        </span>
                        <strong>
                          {drill.steps[visibleStep]?.name || "Untitled step"}
                        </strong>
                      </div>
                      <button
                        className="button-quiet"
                        onClick={() => setBriefOpen(true)}
                      >
                        <Sparkles size={15} />
                        Describe your next idea
                      </button>
                    </div>
                  )}
                </aside>
              )}
            </div>
            <Timeline />
          </>
        )}
      </div>
      <RosterDialog />
      <PlaceTeamDialog />
      <ConflictModal />
      <ExportProgressModal />
      <RecordDialog />
      <TrashDialog />
      <SettingsDialog />
      <HelpDialog />
      <ToastHost />
      {briefOpen && <CoachBriefDialog onClose={() => setBriefOpen(false)} />}
    </div>
  );
}
