import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { downloadBlob, saveExportBlob } from "../saveExport";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("browser export saving", () => {
  it("downloads with the requested filename and revokes the object URL", () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const remove = vi.fn();
    const link = { href: "", download: "", hidden: false, click, remove };
    const appendChild = vi.fn();
    vi.stubGlobal("document", {
      createElement: vi.fn(() => link),
      body: { appendChild },
    });
    vi.stubGlobal("window", { setTimeout });
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const blob = new Blob(["media"]);

    expect(downloadBlob(blob, "passing-pattern.gif")).toEqual({
      name: "passing-pattern.gif",
      bytes: blob.size,
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(link.download).toBe("passing-pattern.gif");
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
  });

  it("does not upload an ordinary export to the repository", async () => {
    const postAsset = vi.spyOn(api, "postAsset");
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({ href: "", download: "", hidden: false, click: vi.fn(), remove: vi.fn() })),
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal("window", { setTimeout });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const result = await saveExportBlob("drill-1", "drill-1.png", new Blob(["png"]));

    expect(result.name).toBe("drill-1.png");
    expect(result.path).toBeUndefined();
    expect(postAsset).not.toHaveBeenCalled();
  });

  it("uploads only when a repository artifact is requested", async () => {
    vi.spyOn(api, "postAsset").mockResolvedValue({
      ok: true,
      path: "C:\\project\\exports\\drill-1\\drill-1.png",
      bytes: 3,
    });

    const result = await saveExportBlob(
      "drill-1",
      "drill-1.png",
      new Blob(["png"]),
      "repository"
    );

    expect(result.path).toContain("exports");
    expect(api.postAsset).toHaveBeenCalledOnce();
  });
});
