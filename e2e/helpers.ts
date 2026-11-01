import type { BrowserContext, Page } from "@playwright/test";

export const START = { latitude: 6.9271, longitude: 79.8612 };

/** Local offset in metres. Only for driving emulated test coordinates. */
export function offset(east: number, north: number) {
  return {
    latitude: START.latitude + north / 110_574,
    longitude: START.longitude + east / (111_320 * Math.cos((START.latitude * Math.PI) / 180)),
  };
}

export async function setPosition(
  context: BrowserContext,
  position: { latitude: number; longitude: number },
  accuracy = 4,
) {
  await context.setGeolocation({ ...position, accuracy });
}

/** Emulated walk around a square, at a plausible pace, ending back at the start. */
export async function walkSquare(context: BrowserContext, size = 30, step = 5, pauseMs = 800) {
  const corners: [number, number][] = [
    [0, 0],
    [size, 0],
    [size, size],
    [0, size],
  ];
  for (let side = 0; side < 4; side += 1) {
    const [x1, y1] = corners[side];
    const [x2, y2] = corners[(side + 1) % 4];
    const steps = Math.round(size / step);
    for (let i = 1; i <= steps; i += 1) {
      await setPosition(
        context,
        offset(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps),
      );
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }
}

/** Stops the install popup covering the screen in tests about something else. */
export async function skipInstallGuide(page: Page) {
  await page.addInitScript(() =>
    window.localStorage.setItem("fieldmeasure.installGuideDismissed", "1"),
  );
}

export async function startGrantedSession(page: Page, context: BrowserContext) {
  await skipInstallGuide(page);
  await context.grantPermissions(["geolocation"]);
  await setPosition(context, START);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Start Measuring" }).waitFor();
}

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screens/${name}.png` });
}
