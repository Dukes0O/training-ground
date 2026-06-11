import type { Drill, PitchRef } from "../model/types";

export interface DrillSummary {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  pitch?: PitchRef;
  stepCount?: number;
  entityCount?: number;
  updatedAt?: string | null;
  rev?: number;
  invalid?: boolean;
  error?: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const api = {
  listDrills: () => j<DrillSummary[]>("/api/drills"),

  getDrill: (id: string) => j<unknown>(`/api/drills/${encodeURIComponent(id)}`),

  putDrill: (id: string, drill: Drill, ifMatchRev?: number | null) =>
    j<{ ok: true; rev: number; updatedAt: string }>(`/api/drills/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(ifMatchRev != null ? { "If-Match": String(ifMatchRev) } : {}),
      },
      body: JSON.stringify(drill),
    }),

  deleteDrill: (id: string) =>
    j<{ ok: true }>(`/api/drills/${encodeURIComponent(id)}`, { method: "DELETE" }),

  getRosters: () => j<RostersFile>("/api/rosters"),
  putRosters: (rosters: RostersFile) =>
    j<{ ok: true }>("/api/rosters", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rosters),
    }),

  getSettings: () => j<AppSettings>("/api/settings"),
  putSettings: (settings: AppSettings) =>
    j<{ ok: true }>("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),

  postAsset: (id: string, name: string, blob: Blob) =>
    j<{ ok: true; path: string; bytes: number }>(
      `/api/exports/${encodeURIComponent(id)}/asset?name=${encodeURIComponent(name)}`,
      { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob }
    ),

  postBundle: (
    id: string,
    body: { title: string; description: string; themeColor: string; assets: string[] }
  ) =>
    j<{ ok: true; path: string }>(`/api/exports/${encodeURIComponent(id)}/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  reveal: (path: string) =>
    j<{ ok: true }>("/api/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }),
};

export interface RosterPlayer {
  id: string;
  name: string;
  number?: number;
  position?: string;
}

export interface RosterTeam {
  id: string;
  name: string;
  players: RosterPlayer[];
}

export interface RostersFile {
  teams: RosterTeam[];
}

export interface AppSettings {
  lastOpenId?: string | null;
}

export interface DrillChangeEvent {
  id: string;
  fsEvent: string;
}

/** Subscribe to server-pushed drill file changes. Returns an unsubscribe fn. */
export function subscribeDrillEvents(onChange: (ev: DrillChangeEvent) => void): () => void {
  const source = new EventSource("/api/events");
  const handler = (e: MessageEvent) => {
    try {
      onChange(JSON.parse(e.data) as DrillChangeEvent);
    } catch {
      // ignore malformed frames
    }
  };
  source.addEventListener("drills-changed", handler);
  return () => {
    source.removeEventListener("drills-changed", handler);
    source.close();
  };
}
