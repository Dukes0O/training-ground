import { useEffect, useRef, useState } from "react";
import { useEditor } from "../state/store";
import { useBoardDisplay } from "../state/boardDisplay";

const MIN_SCALE = 0.6;
const MAX_SCALE = 6;

interface View {
  scale: number;
  tx: number;
  ty: number;
}

const HOME: View = { scale: 1, tx: 0, ty: 0 };

/**
 * Editor-only zoom/pan shell around the board. Works by CSS-transforming a
 * wrapper div — getScreenCTM() folds ancestor transforms into pointer math,
 * so BoardSvg and every drag/draw interaction keep working untouched, and
 * exports (which render their own BoardSvg) never see it.
 * Wheel zooms toward the cursor; middle-drag or Alt+drag pans.
 */
export function BoardViewport({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(HOME);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const drillId = useEditor((s) => s.drillId);
  const cameraMode = useBoardDisplay((s) => s.options.cameraMode);
  const boardView = useBoardDisplay((s) => s.options.view);
  const mode = useEditor((s) => s.mode);

  useEffect(() => {
    setView(HOME); // fresh drill, fresh framing
  }, [drillId, cameraMode, boardView, mode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const scale = Math.min(Math.max(v.scale * factor, MIN_SCALE), MAX_SCALE);
        const f = scale / v.scale;
        return { scale, tx: px - (px - v.tx) * f, ty: py - (py - v.ty) * f };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const panButton = e.button === 1 || (e.button === 0 && e.altKey);
    if (!panButton) return;
    e.preventDefault();
    e.stopPropagation();
    panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    setView((v) => ({ ...v, tx: pan.tx + (e.clientX - pan.x), ty: pan.ty + (e.clientY - pan.y) }));
  };
  const onPointerUp = () => {
    panRef.current = null;
  };

  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    const px = (rect?.width ?? 0) / 2;
    const py = (rect?.height ?? 0) / 2;
    setView((v) => {
      const scale = Math.min(Math.max(v.scale * factor, MIN_SCALE), MAX_SCALE);
      const f = scale / v.scale;
      return { scale, tx: px - (px - v.tx) * f, ty: py - (py - v.ty) * f };
    });
  };

  const zoomed = view.scale !== 1 || view.tx !== 0 || view.ty !== 0;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      onPointerDownCapture={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onAuxClick={(e) => e.preventDefault()}
    >
      <div
        className="h-full w-full"
        style={{
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
      <div className="absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white/95 shadow-sm backdrop-blur">
        <button
          onClick={() => zoomBy(1.25)}
          title="Zoom in (scroll wheel)"
          className="px-2.5 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(1 / 1.25)}
          title="Zoom out"
          className="border-t border-zinc-100 px-2.5 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
        >
          −
        </button>
        {zoomed && (
          <button
            onClick={() => setView(HOME)}
            title="Reset view (pan with middle-drag or Alt+drag)"
            className="border-t border-zinc-100 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
          >
            ⟲
          </button>
        )}
      </div>
    </div>
  );
}
