import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrillChangeEvent } from "../client";
import type { Drill } from "../../model/types";

const client = vi.hoisted(() => ({
  listDrills: vi.fn(),
  getDrill: vi.fn(),
  putDrill: vi.fn(),
  getSettings: vi.fn(),
  putSettings: vi.fn(),
  getRosters: vi.fn(),
  subscribeDrillEvents: vi.fn(),
}));

vi.mock("../client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../client")>();
  return {
    ...original,
    api: { ...original.api, ...client },
    subscribeDrillEvents: client.subscribeDrillEvents,
  };
});

let persistence: typeof import("../persistence");
let editor: typeof import("../../state/store").useEditor;
let undo: typeof import("../../state/store").undo;
let onChange: (event: DrillChangeEvent) => void;
let disk: Map<string, Drill>;

function fixture(id: string, rev = 1): Drill {
  return {
    schemaVersion: 1,
    id,
    title: id,
    rev,
    pitch: "9v9",
    entities: [{ kind: "ball", id: "ball" }],
    steps: [{ name: "Setup", positions: { ball: { x: 35, y: 25 } } }],
  };
}

async function emit(id: string, fsEvent = "change") {
  onChange({ id, fsEvent });
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  disk = new Map([["source", fixture("source")]]);
  client.listDrills.mockImplementation(async () => [...disk.values()].map((drill) => ({
    id: drill.id, title: drill.title, rev: drill.rev, stepCount: drill.steps.length,
  })));
  client.getDrill.mockImplementation(async (id: string) => {
    if (!disk.has(id)) throw new Error(`Missing fixture: ${id}`);
    return structuredClone(disk.get(id));
  });
  client.putDrill.mockImplementation(async (id: string, payload: Drill) => {
    const rev = (disk.get(id)?.rev ?? 0) + 1;
    const updatedAt = new Date().toISOString();
    disk.set(id, { ...structuredClone(payload), id, rev, updatedAt, createdAt: updatedAt });
    return { ok: true, rev, updatedAt };
  });
  client.getSettings.mockResolvedValue({ lastOpenId: "source" });
  client.getRosters.mockResolvedValue({ teams: [] });
  client.putSettings.mockResolvedValue({ ok: true });
  client.subscribeDrillEvents.mockImplementation((callback: typeof onChange) => {
    onChange = callback;
    return () => undefined;
  });
  ({ useEditor: editor, undo } = await import("../../state/store"));
  persistence = await import("../persistence");
  await persistence.initPersistence();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("file watcher echoes", () => {
  it("keeps a new drill temporary until an explicit save", async () => {
    await persistence.newDrill();
    editor.getState().setTitle("Pass, move, support");

    expect(editor.getState().conflict).toBeNull();
    expect(editor.getState().dirty).toBe(true);
    expect(editor.getState().newDraft).toBe(true);
    expect(editor.getState().drill.title).toBe("Pass, move, support");
    expect(disk.has("untitled")).toBe(false);

    await vi.advanceTimersByTimeAsync(1100);
    expect(disk.has("untitled")).toBe(false);

    await persistence.saveNow();
    expect(disk.get("untitled")?.title).toBe("Pass, move, support");
    expect(editor.getState().dirty).toBe(false);
    expect(editor.getState().newDraft).toBe(false);
  });

  it("keeps a duplicate temporary until an explicit save", async () => {
    await persistence.duplicateDrill("source");
    editor.getState().setTitle("A harder variation");

    expect(editor.getState().drillId).toBe("source-copy");
    expect(editor.getState().drill.title).toBe("A harder variation");
    expect(editor.getState().dirty).toBe(true);
    expect(editor.getState().newDraft).toBe(true);
    expect(editor.getState().conflict).toBeNull();
    expect(disk.has("source-copy")).toBe(false);

    await persistence.saveNow();
    expect(disk.get("source-copy")?.title).toBe("A harder variation");
  });

  it("discards edits by restoring the last saved version", async () => {
    editor.getState().setTitle("Temporary title");

    expect(editor.getState().drill.title).toBe("Temporary title");
    expect(disk.get("source")?.title).toBe("source");

    await persistence.discardChanges();

    expect(editor.getState().drill.title).toBe("source");
    expect(editor.getState().dirty).toBe(false);
  });

  it("returns to a clean state when undo restores the saved content", () => {
    editor.getState().setTitle("Temporary title");
    expect(editor.getState().dirty).toBe(true);

    undo();

    expect(editor.getState().drill.title).toBe("source");
    expect(editor.getState().dirty).toBe(false);
  });

  it.each([false, true])("handles a same-revision external edit after consuming an echo (dirty=%s)", async (dirty) => {
    await persistence.newDrill();
    await persistence.saveNow();
    await emit("untitled", "add");
    if (dirty) editor.getState().setTitle("My local idea");
    disk.get("untitled")!.title = "An agent's idea";
    await emit("untitled");

    if (dirty) {
      expect(editor.getState().conflict).toEqual({ diskRev: 1 });
      expect(editor.getState().drill.title).toBe("My local idea");
    } else {
      expect(editor.getState().conflict).toBeNull();
      expect(editor.getState().drill.title).toBe("An agent's idea");
    }
  });

  it("detects a same-revision agent edit coalesced with the first creation echo", async () => {
    await persistence.newDrill();
    await persistence.saveNow();
    editor.getState().setTitle("My local idea");
    disk.get("untitled")!.notes = "New instructions written by an agent";
    await emit("untitled", "add");

    expect(editor.getState().conflict).toEqual({ diskRev: 1 });
    expect(editor.getState().drill.title).toBe("My local idea");
  });

  it("does not use one drill's save echo to hide changes to another drill with the same revision", async () => {
    disk.set("other", fixture("other", 2));
    editor.getState().setTitle("Source revised");
    await persistence.saveNow();
    await persistence.openDrill("other");
    editor.getState().setTitle("Unsaved other drill");
    disk.get("other")!.title = "External other drill";
    await emit("other");

    expect(editor.getState().conflict).toEqual({ diskRev: 2 });
    expect(editor.getState().drill.title).toBe("Unsaved other drill");
  });

  it("consumes a normal save echo once while preserving newer local edits", async () => {
    editor.getState().setTitle("First edit");
    await persistence.saveNow();
    editor.getState().setTitle("Second edit");
    await emit("source");

    expect(editor.getState().conflict).toBeNull();
    expect(editor.getState().dirty).toBe(true);
    expect(editor.getState().drill.title).toBe("Second edit");

    disk.get("source")!.title = "Agent edit at the same revision";
    await emit("source");
    expect(editor.getState().conflict).toEqual({ diskRev: 2 });
    expect(editor.getState().drill.title).toBe("Second edit");
  });
});
