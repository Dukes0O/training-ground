import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DEFAULT_BOARD_DISPLAY, sceneWithDisplay, stepWithDisplay } from "../boardDisplay";
import type { BoardDisplayOptions } from "../boardDisplay";
import { normalizePlayerSize, resolvePlayerDisplay, withPlayerDisplayPreset } from "../playerDisplay";
import { normalizeBoardDisplayOptions, useBoardDisplay, BOARD_DISPLAY_STORAGE_KEY } from "../../state/boardDisplay";
import { useEditor } from "../../state/store";
import { BoardSvg } from "../../board/BoardSvg";
import { PlayerToken } from "../../board/entities/PlayerToken";
import { VisionCones } from "../../board/VisionCones";
import { visionBearing } from "../vision";
import type { Drill } from "../types";

const drill: Drill = {
  schemaVersion: 1, id: "selective", title: "Selective display", pitch: "9v9",
  entities: [
    { id: "p", kind: "player", team: "home", number: 9, position: "ST" },
    { id: "q", kind: "player", team: "home", number: 10, position: "CAM" },
    { id: "r", kind: "player", team: "away", number: 4 },
    { id: "ball", kind: "ball" },
  ],
  steps: [
    { durationMs: 500, positions: { p: { x: 10, y: 12 }, q: { x: 8, y: 20 }, r: { x: 40, y: 30 }, ball: { x: 10, y: 13 } } },
    { durationMs: 3000, pauseAfterMs: 500, ease: "linear", positions: { p: { x: 30, y: 12 }, q: { x: 28, y: 20 }, r: { x: 35, y: 30 }, ball: { x: 30, y: 13 } } },
  ],
};

function focused(): BoardDisplayOptions {
  return {
    ...DEFAULT_BOARD_DISPLAY,
    playerTrails: true, ballTrail: true, vision: true, scan: true,
    appearanceScope: "involved", trailScope: "involved", visionScope: "involved", scanScope: "involved",
    drillPlayers: { selective: { p: { role: "involved" }, q: { role: "supporting" } } },
  };
}

const originalState = useBoardDisplay.getState();
afterEach(() => { useBoardDisplay.setState(originalState); vi.unstubAllGlobals(); });

describe("selective player display", () => {
  it("defaults to smaller figures with no role guesses or coaching aids", () => {
    const snapshot = sceneWithDisplay(drill, 1700, false);
    expect(snapshot.playerSize).toBe(0.7);
    expect(snapshot.playerLabels).toBe("number-role");
    for (const item of snapshot.items.filter((item) => item.entity.kind === "player")) {
      expect(item.playerDisplay).toEqual({ role: undefined, appearance: "miniatures", trail: false, vision: false, scan: false });
    }
    expect(normalizePlayerSize(NaN)).toBe(0.7);
    expect(normalizePlayerSize(0.1)).toBe(0.45);
    expect(normalizePlayerSize(5)).toBe(1.1);
  });

  it("applies explicit Involved/Supporting scopes and leaves unassigned players out", () => {
    const options = focused();
    expect(resolvePlayerDisplay(options, drill.id, "p")).toMatchObject({ appearance: "miniatures", trail: true, vision: true, scan: true });
    expect(resolvePlayerDisplay(options, drill.id, "q")).toMatchObject({ appearance: "classic", trail: false, vision: false, scan: false });
    expect(resolvePlayerDisplay(options, drill.id, "r")).toMatchObject({ role: undefined, appearance: "classic", trail: false, vision: false, scan: false });
    const supporting = { ...options, appearanceScope: "supporting", trailScope: "supporting", visionScope: "supporting", scanScope: "supporting" } as const;
    expect(resolvePlayerDisplay(supporting, drill.id, "q")).toMatchObject({ appearance: "miniatures", trail: true, vision: true, scan: true });
    expect(resolvePlayerDisplay(supporting, drill.id, "p").trail).toBe(false);
    expect(resolvePlayerDisplay({ ...options, trailScope: "all" }, drill.id, "r").trail).toBe(true);
  });

  it("lets player choices override scope, but never a disabled master or missing cone", () => {
    const options = focused();
    options.drillPlayers.selective.q = { role: "supporting", appearance: "miniatures", trail: "on", vision: "on", scan: "on" };
    options.drillPlayers.selective.p = { role: "involved", appearance: "classic", trail: "off", vision: "off", scan: "on" };
    expect(resolvePlayerDisplay(options, drill.id, "q")).toMatchObject({ appearance: "miniatures", trail: true, vision: true, scan: true });
    expect(resolvePlayerDisplay(options, drill.id, "p")).toMatchObject({ appearance: "classic", trail: false, vision: false, scan: false });
    const mastersOff = { ...options, appearance: "classic", playerTrails: false, vision: false, scan: false } as const;
    expect(resolvePlayerDisplay(mastersOff, drill.id, "q")).toMatchObject({ appearance: "classic", trail: false, vision: false, scan: false });
    expect(resolvePlayerDisplay(options, "another-drill", "q")).toMatchObject({ role: undefined, appearance: "classic", trail: false, vision: false, scan: false });
  });

  it("renders only chosen trails, cones and figures through the shared export renderer", () => {
    const snapshot = sceneWithDisplay(drill, 1700, false, focused());
    expect(snapshot.trails?.map((trail) => trail.id)).toEqual(["p", "ball"]);
    const svg = renderToStaticMarkup(createElement(BoardSvg, { snapshot }));
    expect(svg.match(/<use href="#tg-miniature-(home|away|neutral)-(run|idle)"/g)).toHaveLength(1);
    expect(svg).toContain('data-vision-for="p"');
    expect(svg).not.toContain('data-vision-for="q"');
    expect(svg).not.toContain('data-vision-for="r"');
    expect(svg).toContain('data-trail-for="p"');
    expect(svg).not.toContain('data-trail-for="q"');
    expect(sceneWithDisplay(drill, 1700, false, focused())).toEqual(snapshot);
    const edit = stepWithDisplay(drill, 1, false, focused());
    const exported = sceneWithDisplay(drill, edit.timeMs!, false, focused());
    expect(edit.items.map((item) => item.playerDisplay)).toEqual(exported.items.map((item) => item.playerDisplay));
    expect(edit.trails).toEqual(exported.trails);
  });

  it("honors per-player scanning choices while keeping static cones visible", () => {
    const options = focused();
    options.visionScope = "all";
    options.scanScope = "all";
    options.drillPlayers.selective.q.scan = "off";
    const snapshot = sceneWithDisplay(drill, 1700, false, options);
    const svg = renderToStaticMarkup(createElement(VisionCones, { snapshot }));
    const p = snapshot.items.find((item) => item.entity.id === "p")!;
    const q = snapshot.items.find((item) => item.entity.id === "q")!;
    expect(svg).toContain(`rotate(${visionBearing(p, 1700, true)})`);
    expect(svg).toContain(`translate(${q.pose.x} ${q.pose.y}) rotate(${visionBearing(q, 1700, false)})`);
    expect(q.playerDisplay?.vision).toBe(true);
    expect(q.playerDisplay?.scan).toBe(false);
  });

  it("keeps edit framing full while preview and video sampling use camera tracking", () => {
    const options = { ...focused(), cameraMode: "ball" as const };
    const preview = sceneWithDisplay(drill, 1700, false, options);
    expect(preview.cameraBounds).toBeDefined();
    expect(stepWithDisplay(drill, 1, false, options).cameraBounds).toBeUndefined();
  });

  it("shrinks the body to 70% while retaining legible captions and optional labels", () => {
    const player = { id: "p", kind: "player" as const, team: "home" as const, number: 9, position: "STRIKER WITH A LONG ROLE NAME" };
    const props = { player, pose: { x: 10, y: 12 }, scale: 1, style: { label: "Home", fill: "#3080e0", text: "#fff" } };
    const svg = renderToStaticMarkup(createElement(PlayerToken, props));
    expect(Number(svg.match(/<use[^>]+width="([^"]+)"/)?.[1])).toBeCloseTo(3.6 * 0.7);
    expect(Number(svg.match(/<text[^>]+font-size="([^"]+)"/)?.[1])).toBeCloseTo(0.78 * 0.85);
    expect(svg).toContain("STRIKER WITH A LONG ROLE NAME"); // accessible title remains complete
    expect(svg).toContain("…</text>");
    expect(Number(svg.match(/textLength="([^"]+)"/)?.[1])).toBeLessThanOrEqual(8.05 * 0.85);
    const simple = renderToStaticMarkup(createElement(PlayerToken, { ...props, appearance: "classic" }));
    expect(simple).toContain("STRIKER WITH A LONG ROLE NAME"); // complete accessible title
    expect(simple).toContain("…</text>");
    expect(Number(simple.match(/textLength="([^"]+)"/)?.[1])).toBeCloseTo(8.05 * 0.85);
    const numberOnly = renderToStaticMarkup(createElement(PlayerToken, { ...props, labels: "number" }));
    expect(numberOnly).toContain(">9</text>");
    expect(numberOnly).not.toContain("…</text>");
    expect(renderToStaticMarkup(createElement(PlayerToken, { ...props, labels: "hidden" }))).not.toContain("<text");
    expect(renderToStaticMarkup(createElement(PlayerToken, { ...props, appearance: "classic", labels: "hidden" }))).not.toContain("<text");
  });

  it("presets preserve roles and other drills while clearing this drill's overrides", () => {
    const options = focused();
    options.drillPlayers.selective.q = { role: "supporting", appearance: "miniatures", vision: "on" };
    options.drillPlayers.other = { p: { role: "involved", trail: "on" } };
    const focus = withPlayerDisplayPreset(options, drill.id, "involved");
    expect(focus.drillPlayers.selective.q).toEqual({ role: "supporting" });
    expect(focus.drillPlayers.other).toEqual(options.drillPlayers.other);
    expect(resolvePlayerDisplay(focus, drill.id, "q").appearance).toBe("classic");
    const simple = withPlayerDisplayPreset(options, drill.id, "simple");
    expect(simple).toMatchObject({ appearance: "classic", playerTrails: false, ballTrail: false, vision: false, scan: false, surroundings: "none", cameraMode: "full" });
    expect(simple.drillPlayers.selective.p.role).toBe("involved");
    expect(options.drillPlayers.selective.q.vision).toBe("on");
  });
});

describe("browser-local player preferences", () => {
  it("migrates old preferences and rejects malformed sizes/scopes/overrides", () => {
    const old = normalizeBoardDisplayOptions({ playerTrails: true, appearance: "classic" });
    expect(old.playerSize).toBe(0.7);
    expect(old.playerLabels).toBe("number-role");
    expect(old.trailScope).toBe("all");
    expect(old.drillPlayers).toEqual({});
    const normalized = normalizeBoardDisplayOptions({ playerSize: "huge", trailScope: "nobody", stadiumAccent: "red", drillPlayers: { selective: { p: { role: "guess", vision: "yes", scan: "off", appearance: "classic" }, q: null }, invalid: [] } });
    expect(normalized.playerSize).toBe(0.7);
    expect(normalized.trailScope).toBe("all");
    expect(normalized.stadiumAccent).toBe("#406a84");
    expect(normalized.drillPlayers.selective).toEqual({ p: { scan: "off", appearance: "classic" }, q: {} });
    expect(normalized.drillPlayers.invalid).toEqual({});
  });

  it("persists explicit roles and leaves the drill and captured export options unchanged", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    const editorBefore = useEditor.getState();
    useBoardDisplay.setState({ options: focused() });
    const captured = { ...useBoardDisplay.getState().options };
    const beforeExport = sceneWithDisplay(drill, 1700, false, captured);
    useBoardDisplay.getState().assignInvolvedPlayers(drill.id, ["p", "q", "r"], ["q"]);
    useBoardDisplay.getState().setPlayerOptions(drill.id, ["r"], { trail: "on", vision: "off" });
    const current = useBoardDisplay.getState().options;
    expect(current.drillPlayers.selective.p.role).toBe("supporting");
    expect(current.drillPlayers.selective.q.role).toBe("involved");
    expect(current.drillPlayers.selective.r).toEqual({ role: "supporting", trail: "on", vision: "off" });
    expect(sceneWithDisplay(drill, 1700, false, captured)).toEqual(beforeExport);
    expect(sceneWithDisplay(drill, 1700, false, current).trails?.map((trail) => trail.id)).toEqual(["q", "r", "ball"]);
    expect(normalizeBoardDisplayOptions(JSON.parse(storage.get(BOARD_DISPLAY_STORAGE_KEY)!))).toEqual(current);
    expect(useEditor.getState()).toBe(editorBefore);
  });
});
