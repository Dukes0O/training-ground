import { afterEach, describe, expect, it, vi } from "vitest";
import { billboardLabelOffset, boardExportDimensions, getBoardProjection, invertMatrix, PITCH_PALETTES, playerVisualBounds, projectPoint, projectedHeading } from "../boardCamera";
import type { AffineMatrix, BoardView } from "../boardCamera";
import { APRON, PITCH_FORMATS, resolvePitch } from "../../pitch/formats";
import { svgPoint } from "../../board/svgPoint";
import { exportDimensions } from "../../export/renderFrames";
import { DEFAULT_BOARD_DISPLAY, sceneWithDisplay } from "../boardDisplay";
import { makeDefaultDrill } from "../../state/store";

const views: BoardView[] = ["landscape", "portrait", "angled"];
afterEach(() => vi.unstubAllGlobals());

describe("board camera", () => {
  it("keeps long miniature captions inside full-pitch bounds at every legal apron corner", () => {
    const spec = resolvePitch("9v9");
    for (const view of views) for (const size of [0.45, 0.7, 1.1]) {
      const projection = getBoardProjection(spec, view, "miniatures", "none", size);
      const captionScale = spec.tokenScale * Math.max(size, 0.85);
      const halfCaption = (9 / 2 + 0.035) * captionScale;
      for (const point of [{ x: -APRON, y: -APRON }, { x: spec.length + APRON, y: spec.width + APRON }]) {
        const anchor = projectPoint(projection.matrix, point);
        expect(anchor.x - halfCaption).toBeGreaterThanOrEqual(projection.bounds.x);
        expect(anchor.x + halfCaption).toBeLessThanOrEqual(projection.bounds.x + projection.bounds.width);
      }
    }
  });

  it("pads simple players and mixed-board captions, including selected outlines", () => {
    const spec = resolvePitch("9v9");
    const size = 0.7, actor = spec.tokenScale * size, caption = spec.tokenScale * 0.85;
    for (const appearance of ["miniatures", "classic"] as const) {
      const extent = playerVisualBounds(spec.tokenScale, size, appearance);
      // The simple selected circle is radius 1.62 with a 0.12-wide stroke.
      expect(extent.left).toBeGreaterThanOrEqual(1.68 * actor);
      expect(extent.above).toBeGreaterThanOrEqual(1.68 * actor);
      expect(extent.below).toBeGreaterThanOrEqual(2.15 * actor + 0.505 * caption);
      const projection = getBoardProjection(spec, "landscape", appearance, "none", size);
      expect(-APRON - 1.68 * actor).toBeGreaterThanOrEqual(projection.bounds.x);
      expect(spec.width + APRON + 2.15 * actor + 0.505 * caption).toBeLessThanOrEqual(projection.bounds.y + projection.bounds.height);
    }
  });

  for (const view of views) {
    it(`${view}: round trips all pitch formats, including apron coordinates`, () => {
      for (const spec of Object.values(PITCH_FORMATS)) {
        const projection = getBoardProjection(spec, view);
        for (const point of [{ x: -APRON, y: -APRON }, { x: spec.length + APRON, y: spec.width + APRON }, { x: 12.5, y: 9.4 }, { x: spec.length / 2, y: spec.width / 2 }]) {
          const screen = projectPoint(projection.matrix, point);
          const recovered = projectPoint(projection.inverse, screen);
          expect(recovered.x).toBeCloseTo(point.x, 10);
          expect(recovered.y).toBeCloseTo(point.y, 10);
          expect(screen.x).toBeGreaterThanOrEqual(projection.bounds.x);
          expect(screen.y).toBeGreaterThanOrEqual(projection.bounds.y);
          expect(screen.x).toBeLessThanOrEqual(projection.bounds.x + projection.bounds.width);
          expect(screen.y).toBeLessThanOrEqual(projection.bounds.y + projection.bounds.height);
        }
      }
    });

    it(`${view}: cancels camera rotation/shear around a miniature's feet`, () => {
      const projection = getBoardProjection(resolvePitch("9v9"), view);
      const feet = { x: 28, y: 19 };
      const screenFeet = projectPoint(projection.matrix, feet);
      const offset = { x: 1.2, y: -4.05 };
      const worldOffset = projectPoint({ ...projection.inverse, e: 0, f: 0 }, offset);
      const billboardTop = projectPoint(projection.matrix, { x: feet.x + worldOffset.x, y: feet.y + worldOffset.y });
      expect(billboardTop.x - screenFeet.x).toBeCloseTo(offset.x, 10);
      expect(billboardTop.y - screenFeet.y).toBeCloseTo(offset.y, 10);
    });

    it(`${view}: exported frames use the SVG aspect ratio and even codec dimensions`, () => {
      const drill = makeDefaultDrill("camera-check");
      for (const appearance of ["miniatures", "classic"] as const) {
        const spec = resolvePitch(drill.pitch);
        const projection = getBoardProjection(spec, view, appearance);
        const options = { ...DEFAULT_BOARD_DISPLAY, view, appearance };
        const size = exportDimensions(drill, 1279, options);
        expect(size).toEqual(boardExportDimensions(spec, 1279, view, appearance));
        expect(size.width % 2).toBe(0);
        expect(size.height % 2).toBe(0);
        expect(Math.abs(size.height - size.width * projection.bounds.height / projection.bounds.width)).toBeLessThanOrEqual(1);
      }
    });
  }

  it("turns portrait into a taller image without altering any drill positions", () => {
    const drill = makeDefaultDrill("portrait-check");
    const original = structuredClone(drill);
    const landscape = boardExportDimensions(resolvePitch(drill.pitch), 1280, "landscape", "classic");
    const portrait = boardExportDimensions(resolvePitch(drill.pitch), 1280, "portrait", "classic");
    expect(landscape.height).toBeLessThan(landscape.width);
    expect(portrait.height).toBeGreaterThan(portrait.width);
    const displayed = sceneWithDisplay(drill, 500, false, { ...DEFAULT_BOARD_DISPLAY, view: "portrait", pitchStyle: "light" });
    expect(displayed.view).toBe("portrait");
    expect(displayed.pitchStyle).toBe("light");
    expect(drill).toEqual(original);
  });

  it("keeps stadium stands and small players in matching live and exported frames", () => {
    const drill = makeDefaultDrill("stadium-check");
    for (const view of views) {
      const options = { ...DEFAULT_BOARD_DISPLAY, view, surroundings: "stadium" as const, playerSize: 0.5 };
      const projection = getBoardProjection(resolvePitch(drill.pitch), view, "miniatures", "stadium", 0.5);
      const size = exportDimensions(drill, 1920, options);
      expect(Math.abs(size.height - size.width * projection.bounds.height / projection.bounds.width)).toBeLessThanOrEqual(1);
      const plain = getBoardProjection(resolvePitch(drill.pitch), view, "miniatures", "none", 0.5);
      expect(projection.bounds.width).toBeGreaterThan(plain.bounds.width);
      expect(projection.bounds.height).toBeGreaterThan(plain.bounds.height);
    }
  });

  it("preserves field-facing directions through a portrait camera", () => {
    const projection = getBoardProjection(resolvePitch("9v9"), "portrait");
    expect(projectedHeading(projection, 0)).toBeCloseTo(90);
    expect(Math.abs(projectedHeading(projection, 90))).toBeCloseTo(180);
  });

  it("keeps an upright touchline label inside portrait exports without moving its drill position", () => {
    const spec = resolvePitch("9v9");
    const projection = getBoardProjection(spec, "portrait");
    const pose = { x: spec.length / 2, y: -APRON };
    const original = { ...pose };
    const width = ("1 / WATCH THE PLAY".length * 0.62 * 1.1 + 0.8) * spec.tokenScale;
    const height = 1.7 * spec.tokenScale;
    const point = projectPoint(projection.matrix, pose);
    const offset = billboardLabelOffset(projection, pose, width, height, 0.4 * spec.tokenScale);
    const { bounds } = projection;
    expect(offset.x).toBeLessThan(0);
    expect(point.x + offset.x + width / 2).toBeLessThan(bounds.x + bounds.width);
    expect(point.x + offset.x - width / 2).toBeGreaterThan(bounds.x);
    expect(offset.y).toBe(0);
    expect(pose).toEqual(original);
    const center = { x: spec.length / 2, y: spec.width / 2 };
    expect(billboardLabelOffset(projection, center, width, height, 0.4 * spec.tokenScale)).toEqual({ x: 0, y: 0 });
  });

  it("uses the ground group's inverse CTM for zoomed and panned pointer coordinates", () => {
    vi.stubGlobal("DOMPoint", class {
      constructor(public x: number, public y: number) {}
      matrixTransform(matrix: AffineMatrix) { return projectPoint(matrix, this); }
    });
    for (const view of views) {
      const projection = getBoardProjection(resolvePitch("9v9"), view);
      const camera = projection.matrix;
      // Real getScreenCTM includes root viewBox scale, BoardViewport zoom,
      // screen position and pan; invert all of those in one operation.
      const screen: AffineMatrix = { a: camera.a * 7, b: camera.b * 7, c: camera.c * 7, d: camera.d * 7, e: camera.e * 7 + 145, f: camera.f * 7 + 80 };
      const rootOnly: AffineMatrix = { a: 7, b: 0, c: 0, d: 7, e: 145, f: 80 };
      const svg = {
        querySelector: () => ({ getScreenCTM: () => ({ inverse: () => invertMatrix(screen) }) }),
        getScreenCTM: () => ({ inverse: () => invertMatrix(rootOnly) }),
      } as unknown as SVGSVGElement;
      const point = { x: 22.75, y: 16.4 };
      const client = projectPoint(screen, point);
      const recovered = svgPoint(svg, client.x, client.y);
      expect(recovered.x).toBeCloseTo(point.x, 10);
      expect(recovered.y).toBeCloseTo(point.y, 10);
    }
  });

  it("supplies four complete pitch palettes with contrasting Light board ink", () => {
    expect(Object.keys(PITCH_PALETTES)).toEqual(["grass", "stadium", "light", "dark"]);
    expect(PITCH_PALETTES.light.ink).not.toBe(PITCH_PALETTES.grass.ink);
    for (const palette of Object.values(PITCH_PALETTES)) {
      expect(palette.line).not.toBe(palette.stripeA);
      expect(palette.playerTrail).not.toBe(palette.stripeA);
      expect(palette.ballTrail).not.toBe(palette.stripeA);
    }
  });
});
