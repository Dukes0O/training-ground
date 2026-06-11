import { useEffect } from "react";
import { getTimeline } from "../model/resolve";
import { useEditor } from "../state/store";

/**
 * Advances timeMs while playing. requestAnimationFrame drives smooth frames
 * when the tab is visible; a watchdog interval keeps the clock moving (and the
 * animation finishing) when the browser throttles rAF in hidden tabs.
 */
export function usePlaybackClock() {
  const playing = useEditor((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let stopped = false;

    const advance = (now: number) => {
      if (stopped) return;
      const dt = now - last;
      if (dt <= 0) return;
      last = now;
      const s = useEditor.getState();
      const total = getTimeline(s.drill).totalMs;
      let t = s.timeMs + dt * s.speed;
      if (t >= total) {
        if (s.loop && total > 0) {
          t = t % total;
        } else {
          stopped = true;
          useEditor.setState({ timeMs: total, playing: false });
          return;
        }
      }
      useEditor.setState({ timeMs: t });
    };

    const tick = (now: number) => {
      advance(now);
      if (!stopped) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const watchdog = window.setInterval(() => advance(performance.now()), 100);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearInterval(watchdog);
    };
  }, [playing]);
}
