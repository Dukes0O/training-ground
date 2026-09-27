import { ApiError, api, subscribeDrillEvents } from "./client";
import type { AppSettings } from "./client";
import { parseDrill } from "../model/schema";
import { drillContentSignature, serializeDense } from "../model/serialize";
import type { Drill } from "../model/types";
import { makeDefaultDrill, useEditor } from "../state/store";

// Async orchestration around the store: explicit save/discard, SSE-driven
// reloads, and conflict handling. The store itself stays synchronous.

/** The drill object reference that matches what's on disk. */
let savedRef: Drill | null = null;
let savingPromise: Promise<void> | null = null;
let refreshTimer: number | null = null;
let settings: AppSettings = {};
let initialized = false;
/**
 * Our latest successful PUT may echo through the watcher after further edits.
 * Match its file, revision, and content, then consume it once. Content matters:
 * a watcher can coalesce our write with an agent edit that keeps the same rev.
 */
let expectedWriteEcho: { id: string; rev: number; content: string } | null = null;

function expectWriteEcho(id: string, rev: number, payload: Drill) {
  expectedWriteEcho = { id, rev, content: drillContentSignature(payload) };
}

function toast(kind: "info" | "success" | "error", text: string) {
  useEditor.getState().addToast(kind, text);
}

export async function initPersistence(): Promise<void> {
  if (initialized) return;
  initialized = true;

  useEditor.subscribe((state, prev) => {
    if (state.drill === prev.drill) return;
    if (state.drill === savedRef) return; // change came from a load, not an edit
    if (state.gestureBase) return; // wait for endGesture so a drag is checked once
    const dirty =
      state.newDraft || drillContentSignature(state.drill) !== state.savedContentSignature;
    if (state.dirty !== dirty) useEditor.setState({ dirty });
  });

  subscribeDrillEvents((ev) => void onDrillChangedOnDisk(ev.id, ev.fsEvent));

  try {
    const [library, loadedSettings, rosters] = await Promise.all([
      api.listDrills(),
      api.getSettings(),
      api.getRosters(),
    ]);
    settings = loadedSettings ?? {};
    const state = useEditor.getState();
    state.setAppSettings(settings);
    state.setLibrary(library);
    state.setRosters(rosters ?? { teams: [] });
    const usable = library.filter((d) => !d.invalid);
    const preferred = usable.find((d) => d.id === settings.lastOpenId);
    const candidates = preferred ? [preferred, ...usable.filter((d) => d !== preferred)] : usable;
    // A summary can look healthy while the full file fails the schema — keep
    // trying candidates so boot never strands the editor unbound.
    for (const candidate of candidates) {
      await openDrill(candidate.id);
      if (useEditor.getState().drillId === candidate.id) break;
    }
    if (!useEditor.getState().drillId) await newDrill();
  } catch (err) {
    toast("error", `Could not reach the local server: ${(err as Error).message}`);
  }
}

function loadIntoEditor(drill: Drill, rev: number, opts?: { preserveCursor?: boolean }) {
  savedRef = drill;
  useEditor.getState().applyLoadedDrill(drill, rev, opts);
  useEditor.temporal.getState().clear();
}

function loadDraftIntoEditor(drill: Drill) {
  // Mark the initial draft reference as a load so the subscription does not
  // create an undo entry or mistake draft creation for a user edit.
  savedRef = drill;
  useEditor.getState().applyLoadedDrill(drill, 0);
  useEditor.setState({ dirty: true, newDraft: true, savedAt: null });
  useEditor.temporal.getState().clear();
}

/**
 * True when it's safe to swap the open drill out. If the pre-switch save
 * failed (offline server, conflict pending), switching would silently discard
 * the coach's edits — refuse instead.
 */
function readyToSwitch(): boolean {
  const s = useEditor.getState();
  if (!s.drillId) return true;
  if (s.dirty || s.conflict) {
    toast(
      "error",
      s.conflict
        ? "Resolve the conflict dialog before switching drills."
        : "Save or discard your changes before switching drills."
    );
    return false;
  }
  return true;
}

export async function saveNow(force = false): Promise<void> {
  // Several callers can queue behind one in-flight save; loop (not a single
  // await) so each runs against fresh state instead of issuing overlapping
  // PUTs with the same If-Match rev.
  while (savingPromise) await savingPromise;
  const state = useEditor.getState();
  const { drill, drillId, newDraft } = state;
  if (!drillId) return;
  if (!state.dirty && !force) return;
  if (state.conflict && !force) return; // wait for the user's conflict decision

  useEditor.setState({ saving: true });
  savingPromise = (async () => {
    try {
      const payload = serializeDense(drill);
      const r = await api.putDrill(
        drillId,
        payload,
        force || newDraft ? null : state.lastSavedRev,
        newDraft && !force,
      );
      savedRef = drill;
      const savedContentSignature = drillContentSignature(payload);
      expectWriteEcho(drillId, r.rev, payload);
      const current = useEditor.getState();
      const stillDirty = drillContentSignature(current.drill) !== savedContentSignature;
      useEditor.setState({
        saving: false,
        dirty: stillDirty,
        newDraft: false,
        savedContentSignature,
        lastSavedRev: r.rev,
        savedAt: r.updatedAt,
        conflict: null,
      });
      if (newDraft) {
        settings = { ...settings, lastOpenId: drillId };
        void api.putSettings(settings).catch(() => undefined);
      }
      toast("success", stillDirty ? "Saved. You have newer unsaved changes." : "Drill saved.");
      refreshLibrarySoon();
    } catch (err) {
      useEditor.setState({ saving: false });
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { currentRev?: number } | null;
        useEditor.getState().setConflict({ diskRev: body?.currentRev ?? null });
      } else {
        toast("error", `Save failed: ${(err as Error).message}`);
      }
    } finally {
      savingPromise = null;
    }
  })();
  await savingPromise;
}

/** Restore the disk version, or abandon an unsaved new/duplicated draft. */
export async function discardChanges(): Promise<boolean> {
  while (savingPromise) await savingPromise;
  const state = useEditor.getState();
  const { drillId, newDraft } = state;
  if (!drillId) return true;

  try {
    if (newDraft) {
      const library = await api.listDrills();
      useEditor.getState().setLibrary(library);
      const fallback = library.find((item) => !item.invalid && item.id !== drillId);
      if (fallback) {
        const raw = (await api.getDrill(fallback.id)) as { rev?: number };
        const drill = parseDrill(raw);
        loadIntoEditor(drill, raw.rev ?? 0);
        settings = { ...settings, lastOpenId: fallback.id };
        void api.putSettings(settings).catch(() => undefined);
      } else {
        loadDraftIntoEditor(
          makeDefaultDrill("untitled", undefined, state.appSettings.defaultPitch ?? "9v9"),
        );
      }
      toast("info", "Draft discarded.");
      return true;
    }

    const raw = (await api.getDrill(drillId)) as { rev?: number };
    const drill = parseDrill(raw);
    loadIntoEditor(drill, raw.rev ?? 0, { preserveCursor: true });
    toast("info", "Unsaved changes discarded.");
    return true;
  } catch (err) {
    toast("error", `Discard failed: ${(err as Error).message}`);
    return false;
  }
}

export function refreshLibrarySoon(delayMs = 300): void {
  if (refreshTimer != null) clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    void api
      .listDrills()
      .then((library) => useEditor.getState().setLibrary(library))
      .catch(() => undefined);
  }, delayMs);
}

async function onDrillChangedOnDisk(id: string, fsEvent: string): Promise<void> {
  refreshLibrarySoon();
  if (id !== useEditor.getState().drillId) return;
  if (fsEvent === "unlink") {
    toast("info", `"${id}" was deleted on disk — your open copy is kept; saving will recreate it.`);
    return;
  }
  try {
    const raw = (await api.getDrill(id)) as Drill;
    const rev = raw.rev ?? 0;
    const echo = expectedWriteEcho;
    if (echo?.id === id) {
      expectedWriteEcho = null;
      if (rev === echo.rev && drillContentSignature(raw) === echo.content) return;
    }
    // Re-read state after the await: the user may have typed or switched
    // drills while the GET was in flight.
    const state = useEditor.getState();
    if (id !== state.drillId) return;
    const drill = parseDrill(raw);
    if (!state.dirty) {
      loadIntoEditor(drill, rev, { preserveCursor: true });
      toast("info", `"${drill.title}" was updated on disk — reloaded.`);
    } else {
      state.setConflict({ diskRev: rev });
    }
  } catch (err) {
    toast("error", `"${id}" changed on disk but can't be loaded: ${(err as Error).message}`);
  }
}

export async function openDrill(id: string): Promise<void> {
  if (!readyToSwitch()) return;
  try {
    const raw = (await api.getDrill(id)) as { rev?: number };
    const drill = parseDrill(raw);
    loadIntoEditor(drill, raw.rev ?? 0);
    settings = { ...settings, lastOpenId: id };
    void api.putSettings(settings).catch(() => undefined);
  } catch (err) {
    toast("error", `Can't open "${id}": ${(err as Error).message}`);
  }
}

export async function newDrill(): Promise<void> {
  if (!readyToSwitch()) return;
  // Server truth, not the possibly-stale library snapshot: an agent may have
  // created a drill since the last refresh and PUT would overwrite it.
  const library =
    (await api.listDrills().catch(() => null)) ?? useEditor.getState().library ?? [];
  const taken = new Set(library.map((d) => d.id));
  let id = "untitled";
  let i = 2;
  while (taken.has(id)) id = `untitled-${i++}`;
  const drill = makeDefaultDrill(id, undefined, useEditor.getState().appSettings.defaultPitch ?? "9v9");
  loadDraftIntoEditor(drill);
  toast("info", "New drill is a temporary draft until you save it.");
}

export async function duplicateDrill(id: string): Promise<void> {
  if (!readyToSwitch()) return;
  try {
    const raw = await api.getDrill(id);
    const drill = parseDrill(raw);
    const library = useEditor.getState().library ?? (await api.listDrills().catch(() => []));
    const taken = new Set(library.map((d) => d.id));
    const base = id.slice(0, 50); // leave room for the -copy-N suffix within the 60-char slug cap
    let copyId = `${base}-copy`;
    let i = 2;
    while (taken.has(copyId)) copyId = `${base}-copy-${i++}`;
    drill.id = copyId;
    drill.title = `${drill.title} (copy)`;
    delete drill.rev;
    delete drill.createdAt;
    delete drill.updatedAt;
    loadDraftIntoEditor(drill);
    toast("info", `“${drill.title}” is a temporary draft until you save it.`);
  } catch (err) {
    toast("error", `Duplicate failed: ${(err as Error).message}`);
  }
}

export async function deleteDrillById(id: string): Promise<void> {
  if (useEditor.getState().drillId === id && !readyToSwitch()) return;
  try {
    await api.deleteDrill(id);
  } catch (err) {
    toast("error", `Delete failed: ${(err as Error).message}`);
    return;
  }
  toast("info", `"${id}" moved to data/trash.`);
  const library = (await api.listDrills().catch(() => null)) ?? [];
  useEditor.getState().setLibrary(library);
  if (useEditor.getState().drillId === id) {
    const next = library.find((d) => !d.invalid);
    if (next) await openDrill(next.id);
    else await newDrill();
  }
}

export async function resolveConflict(decision: "reload" | "keepMine"): Promise<void> {
  const { drillId } = useEditor.getState();
  if (!drillId) return;
  if (decision === "reload") {
    try {
      const raw = (await api.getDrill(drillId)) as { rev?: number };
      loadIntoEditor(parseDrill(raw), raw.rev ?? 0);
      toast("info", "Reloaded the version from disk.");
    } catch (err) {
      toast("error", `Reload failed: ${(err as Error).message}`);
    }
  } else {
    useEditor.getState().setConflict(null);
    await saveNow(true);
    toast("info", "Kept your version — disk file overwritten.");
  }
}

export async function saveAppSettings(patch: AppSettings): Promise<void> {
  settings = { ...settings, ...patch };
  useEditor.getState().setAppSettings(settings);
  try {
    await api.putSettings(settings);
    toast("success", "Settings saved.");
  } catch (err) {
    toast("error", `Settings save failed: ${(err as Error).message}`);
  }
}

export async function saveRosters(): Promise<void> {
  const { rosters } = useEditor.getState();
  try {
    await api.putRosters(rosters);
    toast("success", "Roster saved.");
  } catch (err) {
    toast("error", `Roster save failed: ${(err as Error).message}`);
  }
}
