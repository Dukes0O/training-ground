// Region Capture (Chromium) — not yet in the bundled DOM lib.
interface CropTarget {
  readonly __brand?: "CropTarget";
}

declare const CropTarget:
  | {
      fromElement(element: Element): Promise<CropTarget>;
    }
  | undefined;

interface BrowserCaptureMediaStreamTrack extends MediaStreamTrack {
  cropTo(target: CropTarget | null): Promise<void>;
}
