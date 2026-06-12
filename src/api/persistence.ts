import { ApiError, api, subscribeDrillEvents } from "./client";
import type { AppSettings } from "./client";
import { parseDrill } from "../model/schema";
import { serializeDense } from "../model/serialize";
import type { Drill } from "../model/types";
import { makeDefaultDrill, useEditor } from "../state/store";

// Async orchestration around the store: boot, autosave, SSE-driven reloads,
// and conflict handling. The store itself stays synchronous.

/** The drill object reference that matches what's on disk. */
let savedRef: Drill | null = null;
let saveTimer: number | null = null;
let savingPromise: Promise<void> | null = null;
let refreshTimer: number | null = null;
let settings: AppSettings = {};
let initialized = false;

function toast(kind: "info" | "success" | "error", text: string) {
  useEditor.getState().addToast(kind, text);
}

export async function initPersistence(): Promise<void> {
  if (initialized) return;
  initialized = true;

  useEditor.subscribe((state, prev) => {
    if (state.drill === prev.drill) return;
    if (state.drill === savedRef) return; // change came from a load, not an edit
    if (!state.dirty) useEditor.setState({ dirty: true });
    if (state.gestureBase) return; // mid-drag; endGesture produces one more change
    scheduleSave();
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
    const target = usable.find((d) => d.id === settings.lastOpenId) ?? usable[0];
    if (target) await openDrill(target.id);
    else await newDrill();
  } catch (err) {
    toast("error", `Could not reach the local server: ${(err as Error).message}`);
  }
}

function loadIntoEditor(drill: Drill, rev: number) {
  savedRef = drill;
  useEditor.getState().applyLoadedDrill(drill, rev);
  useEditor.temporal.getState().clear();
}

export function scheduleSave(delayMs = 800): void {
  if (saveTimer != null) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void saveNow();
  }, delayMs);
}

export async function saveNow(force = false): Promise<void> {
  if (saveTimer != null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (savingPromise) await savingPromise;
  const state = useEditor.getState();
  const { drill, drillId } = state;
  if (!drillId) return;
  if (!state.dirty && !force) return;
  if (state.conflict && !force) return; // wait for the user's conflict decision

  useEditor.setState({ saving: true });
  savingPromise = (async () => {
    try {
      const r = await api.putDrill(drillId, serializeDense(drill), force ? null : state.lastSavedRev);
      savedRef = drill;
      const stillDirty = useEditor.getState().drill !== drill;
      useEditor.setState({
        saving: false,
        dirty: stillDirty,
        lastSavedRev: r.rev,
        savedAt: r.updatedAt,
        conflict: null,
      });
      if (stillDirty) scheduleSave();
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
  const { drillId, dirty, lastSavedRev } = useEditor.getState();
  if (id !== drillId) return;
  if (fsEvent === "unlink") {
    toast("info", `"${id}" was deleted on disk — your open copy is kept; saving will recreate it.`);
    return;
  }
  try {
    const raw = (await api.getDrill(id)) as { rev?: number };
    const rev = raw.rev ?? 0;
    if (lastSavedRev != null && rev === lastSavedRev) return; // our own write echoing back
    const drill = parseDrill(raw);
    if (!dirty) {
      loadIntoEditor(drill, rev);
      toast("info", `"${drill.title}" was updated on disk — reloaded.`);
    } else {
      useEditor.getState().setConflict({ diskRev: rev });
    }
  } catch (err) {
    toast("error", `"${id}" changed on disk but can't be loaded: ${(err as Error).message}`);
  }
}

export async function openDrill(id: string): Promise<void> {
  await saveNow();
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
  await saveNow();
  const library = useEditor.getState().library ?? (await api.listDrills().catch(() => []));
  const taken = new Set(library.map((d) => d.id));
  let id = "untitled";
  let i = 2;
  while (taken.has(id)) id = `untitled-${i++}`;
  const drill = makeDefaultDrill(id, undefined, useEditor.getState().appSettings.defaultPitch ?? "9v9");
  try {
    const r = await api.putDrill(id, serializeDense(drill), null);
    loadIntoEditor(drill, r.rev);
    settings = { ...settings, lastOpenId: id };
    void api.putSettings(settings).catch(() => undefined);
    refreshLibrarySoon(0);
  } catch (err) {
    toast("error", `Could not create a new drill: ${(err as Error).message}`);
  }
}

export async function duplicateDrill(id: string): Promise<void> {
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
    await api.putDrill(copyId, serializeDense(drill), null);
    refreshLibrarySoon(0);
    await openDrill(copyId);
    toast("success", `Duplicated as "${drill.title}".`);
  } catch (err) {
    toast("error", `Duplicate failed: ${(err as Error).message}`);
  }
}

export async function deleteDrillById(id: string): Promise<void> {
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
