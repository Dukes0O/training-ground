import type { Drill } from "../model/types";

/**
 * Media filenames come from the drill's TITLE (what the coach actually named
 * it), not the id — otherwise everything created with the New button exports
 * as untitled-N.mp4. The folder under exports/ stays keyed by id.
 */
export function exportBaseName(drill: Drill): string {
  const slug = drill.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || drill.id;
}
