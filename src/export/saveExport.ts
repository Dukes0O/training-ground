import { api } from "../api/client";

export type ExportDestination = "download" | "repository";

export interface SavedExport {
  name: string;
  bytes: number;
  path?: string;
}

/** Start a browser download and release its temporary object URL after navigation begins. */
export function downloadBlob(blob: Blob, name: string): SavedExport {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return { name, bytes: blob.size };
}

export async function saveExportBlob(
  drillId: string,
  name: string,
  blob: Blob,
  destination: ExportDestination = "download",
  signal?: AbortSignal
): Promise<SavedExport> {
  signal?.throwIfAborted();
  if (destination === "download") return downloadBlob(blob, name);
  const saved = await api.postAsset(drillId, name, blob, signal);
  return { name, bytes: saved.bytes, path: saved.path };
}
