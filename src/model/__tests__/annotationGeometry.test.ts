import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArrowGlyph } from "../../board/annotations/ArrowGlyph";
import { isValidPolygon, pointsBounds, resizePolygon, samplePolyline } from "../annotationGeometry";

const concave = [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 3, y: 3 }, { x: 5, y: 5 }, { x: 1, y: 5 }];

describe("polygon coaching geometry", () => {
  it("accepts concave areas but rejects crossed, duplicate and collapsed corners", () => {
    expect(isValidPolygon(concave)).toBe(true);
    expect(isValidPolygon([{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 4, y: 0 }])).toBe(false);
    expect(isValidPolygon([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 0 }])).toBe(false);
    expect(isValidPolygon([...concave, concave[0]])).toBe(false);
  });

  it("resizes all corners together while keeping a concave shape valid", () => {
    const resized = resizePolygon(concave, { x: 10, y: 20, w: 8, h: 4 });
    expect(pointsBounds(resized)).toEqual({ x: 10, y: 20, w: 8, h: 4 });
    expect(resized[2]).toEqual({ x: 14, y: 22 });
    expect(isValidPolygon(resized)).toBe(true);
    expect(concave[0]).toEqual({ x: 1, y: 1 });
  });
});

describe("straight arrow paths", () => {
  const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  it("travels through sharp corners without spline overshoot", () => {
    expect(samplePolyline(points, 0.25)).toEqual({ x: 5, y: 0 });
    expect(samplePolyline(points, 0.5)).toEqual({ x: 10, y: 0 });
    expect(samplePolyline(points, 0.75)).toEqual({ x: 10, y: 5 });
  });
  it("renders straight segments and aligns the head with the final segment", () => {
    const markup = renderToStaticMarkup(createElement(ArrowGlyph, {
      annotation: { kind: "arrow", id: "a", pathMode: "straight", style: "pass", via: [points[1]] },
      from: points[0], to: points[2], scale: 1,
    }));
    expect(markup).toContain('d="M 0 0 L 10 0 L 10 10"');
    expect(markup).toContain('rotate(90)');
    expect(markup).not.toContain(" C ");
  });
});
