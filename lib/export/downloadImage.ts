export type DownloadOutcome = "downloaded" | "shared" | "cancelled";

function isAppleMobile(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, but Macs have no touch points.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * iOS ignores or mishandles the download attribute, especially in Home Screen
 * apps, so it gets the share sheet with "Save Image". Everywhere else gets a
 * normal download.
 */
export async function downloadImage(blob: Blob, filename: string): Promise<DownloadOutcome> {
  if (isAppleMobile()) {
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return "shared";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
        // Any other share failure falls through to the download path.
      }
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return "downloaded";
}
