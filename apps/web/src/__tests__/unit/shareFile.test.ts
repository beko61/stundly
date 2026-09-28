import { describe, it, expect, vi, afterEach } from "vitest";
import { shareOrDownload, dataUrlToFile } from "@/lib/share/shareFile";

const file = new File(["%PDF"], "Notdienst-Bericht_2026-09-27.pdf", { type: "application/pdf" });

function stubNavigator(share?: (d: ShareData) => Promise<void>, canShare?: (d: ShareData) => boolean) {
  vi.stubGlobal("navigator", { ...navigator, share, canShare });
}
function captureDownloads(): string[] {
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }));
  return names;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("shareOrDownload", () => {
  it("Handy: Teilen-Menü mit der PDF als Datei", async () => {
    const share = vi.fn(async () => {});
    stubNavigator(share, () => true);
    const downloads = captureDownloads();
    expect(await shareOrDownload(file, { title: "Bericht", text: "Hallo" })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], title: "Bericht", text: "Hallo" });
    expect(downloads).toEqual([]);
  });

  it("mehrere Dateien (PDF + Fotos) gehen gemeinsam ins Teilen-Menü bzw. werden alle geladen", async () => {
    const foto = new File(["x"], "Notdienst_2026-09-27_Foto-1.jpg", { type: "image/jpeg" });
    const share = vi.fn(async () => {});
    stubNavigator(share, () => true);
    expect(await shareOrDownload([file, foto], { title: "Bericht" })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file, foto], title: "Bericht" });

    stubNavigator(undefined, undefined);
    const downloads = captureDownloads();
    expect(await shareOrDownload([file, foto], { title: "Bericht" })).toBe("downloaded");
    expect(downloads).toEqual(["Notdienst-Bericht_2026-09-27.pdf", "Notdienst_2026-09-27_Foto-1.jpg"]);
  });

  it("dataUrlToFile: MIME-Typ, Name und Bytes korrekt", async () => {
    const f = dataUrlToFile("data:image/jpeg;base64," + btoa("JPEGDATA"), "a.jpg");
    expect(f.name).toBe("a.jpg");
    expect(f.type).toBe("image/jpeg");
    expect(await f.text()).toBe("JPEGDATA");
  });

  it("Teilen abgebrochen → kein Download", async () => {
    stubNavigator(async () => { throw new DOMException("x", "AbortError"); }, () => true);
    const downloads = captureDownloads();
    expect(await shareOrDownload(file, { title: "Bericht" })).toBe("cancelled");
    expect(downloads).toEqual([]);
  });

  it("Browser kann keine Dateien teilen (Desktop) → Download mit Dateinamen", async () => {
    stubNavigator(undefined, undefined);
    const downloads = captureDownloads();
    expect(await shareOrDownload(file, { title: "Bericht" })).toBe("downloaded");
    expect(downloads).toEqual(["Notdienst-Bericht_2026-09-27.pdf"]);
  });

  it("Teilen verweigert (z.B. NotAllowedError) → Download als Rückfall", async () => {
    stubNavigator(async () => { throw new DOMException("x", "NotAllowedError"); }, () => true);
    const downloads = captureDownloads();
    expect(await shareOrDownload(file, { title: "Bericht" })).toBe("downloaded");
    expect(downloads).toHaveLength(1);
  });
});
