import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ZoneGlyph } from "../../board/annotations/ZoneGlyph";
import { parseDrill, semanticIssues } from "../schema";
import { serializeDense } from "../serialize";
import type { Annotation, Drill } from "../types";

const zone: Annotation = { kind: "zone", id: "area", rect: { x: 4, y: 4, w: 8, h: 4 }, text: "Press here" };

function fixture(annotation = zone): Drill {
  return { schemaVersion: 1, id: "zone-test", title: "Zones", pitch: "grid", entities: [annotation], steps: [{ positions: {} }] };
}

describe("zone shapes", () => {
  it("loads and saves polygon zones without requiring rectangle bounds", () => {
    const polygon: Annotation = { kind: "zone", id: "press", shape: "polygon", points: [{ x: 2, y: 2 }, { x: 9, y: 2 }, { x: 7, y: 6 }, { x: 3, y: 8 }] };
    const drill = parseDrill(serializeDense(fixture(polygon)));
    expect(drill.entities[0]).toEqual(polygon);
    expect(semanticIssues(drill)).toEqual([]);
    expect(renderToStaticMarkup(createElement(ZoneGlyph, { annotation: polygon, scale: 1 }))).toContain('<polygon points="2,2 9,2 7,6 3,8"');
  });

  it("keeps existing zone files rectangular and preserves ellipse shape through save/load", () => {
    const legacy = parseDrill(serializeDense(fixture()));
    expect(legacy.entities[0]).toEqual(zone);
    const ellipse = { ...zone, shape: "ellipse" as const };
    const roundTrip = parseDrill(serializeDense(fixture(ellipse)));
    expect(roundTrip.entities[0]).toEqual(ellipse);
    expect(semanticIssues(roundTrip)).toEqual([]);
  });

  it("rejects unsupported shapes and nonpositive ellipse dimensions", () => {
    expect(() => parseDrill({ ...fixture(), entities: [{ ...zone, shape: "triangle" }] })).toThrow();
    expect(() => parseDrill(fixture({ ...zone, shape: "ellipse", rect: { x: 4, y: 4, w: 0, h: 4 } }))).toThrow();
  });

  it("renders an ellipse inside the same bounds used by dragging and resizing", () => {
    const markup = renderToStaticMarkup(createElement(ZoneGlyph, { annotation: { ...zone, shape: "ellipse" }, scale: 1 }));
    expect(markup).toContain('<ellipse cx="8" cy="6" rx="4" ry="2"');
    expect(markup).toContain('fill-opacity="0.16"');
    expect(markup).toContain('text-anchor="middle"');
    const legacy = renderToStaticMarkup(createElement(ZoneGlyph, { annotation: zone, scale: 1 }));
    expect(legacy).toContain('<rect x="4" y="4" width="8" height="4"');
    expect(legacy).not.toContain("<ellipse");
  });
});
