export type InstallPlatform = "ios" | "android";

const DISMISSED_KEY = "fieldmeasure.installGuideDismissed";

/** Phones and tablets only. Touch-screen laptops and desktops are deliberately excluded. */
export function detectInstallPlatform(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): InstallPlatform | null {
  if (/Android/i.test(userAgent)) return "android";
  if (/iPad|iPhone|iPod/.test(userAgent)) return "ios";
  // iPadOS reports itself as a Mac, but Macs have no touch points.
  if (platform === "MacIntel" && maxTouchPoints > 1) return "ios";
  return null;
}

function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

export function getCurrentInstallPlatform(): InstallPlatform | null {
  return detectInstallPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    return false; // Blocked storage only means the guide may appear again.
  }
}

export function dismissInstallGuide(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Without storage the guide can't be remembered as dismissed; it still closes.
  }
}

/** The platform to show the guide for, or null if it shouldn't appear on this device. */
export function getInstallGuidePlatform(): InstallPlatform | null {
  if (isInstalled() || wasDismissed()) return null;
  return getCurrentInstallPlatform();
}
