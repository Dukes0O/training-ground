import { useEffect, useState } from "react";
import type { AppSettings } from "../api/client";
import { saveAppSettings } from "../api/persistence";
import { PITCH_FORMATS } from "../pitch/formats";
import type { PitchFormatId } from "../model/types";
import { Modal } from "./Modal";
import { useEditor } from "../state/store";

const selectCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-700/40";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

export function SettingsDialog() {
  const open = useEditor((s) => s.settingsOpen);
  const setSettingsOpen = useEditor((s) => s.setSettingsOpen);
  const appSettings = useEditor((s) => s.appSettings);
  const [draft, setDraft] = useState<AppSettings>({});

  useEffect(() => {
    if (open) setDraft(JSON.parse(JSON.stringify(appSettings)) as AppSettings);
  }, [open, appSettings]);

  return (
    <Modal open={open} onClose={() => setSettingsOpen(false)} title="Settings" width={420}>
      <div className="space-y-3">
        <Row label="Default pitch for new drills">
          <select
            value={draft.defaultPitch ?? "9v9"}
            onChange={(e) => setDraft((d) => ({ ...d, defaultPitch: e.target.value as PitchFormatId }))}
            className={selectCls}
          >
            {Object.values(PITCH_FORMATS).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="Video width">
            <select
              value={draft.video?.width ?? 1280}
              onChange={(e) =>
                setDraft((d) => ({ ...d, video: { ...d.video, width: Number(e.target.value) } }))
              }
              className={selectCls}
            >
              <option value={1280}>1280 px</option>
              <option value={1920}>1920 px</option>
              <option value={3840}>3840 px</option>
            </select>
          </Row>
          <Row label="Video fps">
            <select
              value={draft.video?.fps ?? 30}
              onChange={(e) =>
                setDraft((d) => ({ ...d, video: { ...d.video, fps: Number(e.target.value) } }))
              }
              className={selectCls}
            >
              <option value={25}>25</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </Row>
          <Row label="GIF width">
            <select
              value={draft.gif?.width ?? 720}
              onChange={(e) =>
                setDraft((d) => ({ ...d, gif: { ...d.gif, width: Number(e.target.value) } }))
              }
              className={selectCls}
            >
              <option value={480}>480 px</option>
              <option value={720}>720 px</option>
            </select>
          </Row>
          <Row label="GIF fps">
            <select
              value={draft.gif?.fps ?? 12}
              onChange={(e) =>
                setDraft((d) => ({ ...d, gif: { ...d.gif, fps: Number(e.target.value) } }))
              }
              className={selectCls}
            >
              <option value={10}>10</option>
              <option value={12}>12</option>
              <option value={15}>15</option>
            </select>
          </Row>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3">
          <button
            onClick={() => setSettingsOpen(false)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              void saveAppSettings(draft);
              setSettingsOpen(false);
            }}
            className="rounded-md bg-blue-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-900"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
