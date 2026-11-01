import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  START,
  offset,
  setPosition,
  shot,
  skipInstallGuide,
  startGrantedSession,
  walkSquare,
} from "./helpers";

test("walks a boundary from start to downloaded report", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await startGrantedSession(page, context);
  await expect(page.getByTestId("gps-status")).toContainText("GPS: Good");
  await expect(page.getByTestId("gps-status")).toContainText("Accuracy ±4.0 m");
  await expect(page.getByText("Copyright © 2026. All rights reserved.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sandeepa Mallawarachchi" })).toHaveAttribute(
    "target",
    "_blank",
  );
  await page.waitForTimeout(800);
  await shot(page, "1-ready");

  await page.getByRole("button", { name: "Start Measuring", exact: true }).click();
  await expect(page.getByText("Recording…")).toBeVisible();

  // The map must actually fill the screen behind the panels.
  const mapBox = await page.locator(".maplibregl-canvas").boundingBox();
  expect(Math.abs((mapBox?.height ?? 0) - (page.viewportSize()?.height ?? 0))).toBeLessThan(1);
  expect(Math.abs((mapBox?.width ?? 0) - (page.viewportSize()?.width ?? 0))).toBeLessThan(1);

  await walkSquare(context);
  await shot(page, "2-recording");
  await expect(page.getByTestId("walked")).toContainText(/1[12]\d m/);

  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("heading", { name: "Review & Edit" })).toBeVisible();
  await expect(page.getByTestId("review-area")).toContainText("0.22");
  await page.waitForTimeout(800);
  await shot(page, "3-review");
  await expect(page.locator(".fm-area-label")).toBeVisible();
  await expect(page.locator(".fm-area-label")).toContainText("0.222 acres");
  // The boundary must be drawn, not just calculated: bright green fills the fitted polygon.
  const labelBox = await page.locator(".fm-area-label").boundingBox();
  if (!labelBox) throw new Error("No area label");
  const pixel = await page.evaluate(
    async ({ base64, x, y }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const buffer = document.createElement("canvas");
      buffer.width = image.width;
      buffer.height = image.height;
      const context2d = buffer.getContext("2d");
      if (!context2d) return [0, 0, 0];
      context2d.drawImage(image, 0, 0);
      return [...context2d.getImageData(x, y, 1, 1).data];
    },
    {
      base64: (await page.screenshot()).toString("base64"),
      x: Math.round((labelBox.x + labelBox.width / 2) * 2.625),
      y: Math.round((labelBox.y - 30) * 2.625),
    },
  );
  // Plain background is #E9F0EA; the polygon's green fill lowers red and blue well below it.
  expect(pixel[0]).toBeLessThan(200);

  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("heading", { name: "Measurement Result" })).toBeVisible();
  // A 30 m square is 900 m², or 0.222 acres. Emulated positions are exact.
  await expect(page.getByTestId("result-area")).toHaveText("0.222 acres");
  await expect(page.getByTestId("result-perimeter")).toContainText("120 m");
  await page.waitForTimeout(800);
  await shot(page, "4-result");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Result (PNG)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^fieldmeasure-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.png$/);

  const path = test.info().outputPath("report.png");
  await download.saveAs(path);
  const png = readFileSync(path);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1600);
  expect(png.readUInt32BE(20)).toBe(1200);
  await download.saveAs("test-results/screens/report.png");
  await expect(page.getByText("Image saved")).toBeVisible();

  await page.getByRole("button", { name: "New Measurement" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("will be replaced");
  await page.getByRole("button", { name: "Replace Measurement" }).click();
  await expect(page.getByRole("button", { name: "Start Measuring" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("recovers a measurement after a page reload", async ({ page, context }) => {
  await startGrantedSession(page, context);
  await page.getByRole("button", { name: "Start Measuring", exact: true }).click();
  await walkSquare(context, 20, 5, 700);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const walked = await page.getByTestId("walked").textContent();

  await page.reload();
  await expect(page.getByRole("alertdialog")).toContainText("Continue your measurement?");
  await page.getByRole("button", { name: "Continue Measurement" }).click();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await expect(page.getByTestId("walked")).toHaveText(walked ?? "");
});

test("rejects corrupt session data without crashing", async ({ page, context }) => {
  await startGrantedSession(page, context);
  await page.evaluate(() => sessionStorage.setItem("fieldmeasure.session", '{"bad":true'));
  await page.reload();
  await expect(page.getByRole("button", { name: "Start Measuring" })).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("fieldmeasure.session"))).toBeNull();
});

test("asks before closing a large gap", async ({ page, context }) => {
  await startGrantedSession(page, context);
  await page.getByRole("button", { name: "Start Measuring", exact: true }).click();
  for (const [east, north] of [
    [6, 0],
    [12, 0],
    [18, 0],
    [24, 0],
    [24, 6],
    [24, 12],
    [24, 18],
    [24, 24],
  ]) {
    await setPosition(context, offset(east, north));
    await page.waitForTimeout(900);
  }
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Connect the boundary?");
  await shot(page, "closure-dialog");
  await page.getByRole("button", { name: "Keep Walking" }).click();
  await expect(page.getByText("Recording…")).toBeVisible();
});

test("edits the boundary by touch-dragging, and can undo and reset", async ({ page, context }) => {
  await startGrantedSession(page, context);
  await page.getByRole("button", { name: "Start Measuring", exact: true }).click();
  await walkSquare(context, 20, 5, 700);
  await page.getByRole("button", { name: "Finish" }).click();
  await page.waitForTimeout(1000);
  const area = page.getByTestId("review-area");
  const before = await area.textContent();

  // Vertices have no DOM element. The start vertex is the square's south-west
  // corner, so it's found on screen by colour: the dark start marker's pixels.
  const canvas = page.locator(".maplibregl-canvas");
  const panelTop = (await page.locator("[data-map-panel]").boundingBox())?.y ?? 0;
  const headerBottom = (await page.locator("[data-map-topbar]").boundingBox())?.height ?? 0;
  const png = await canvas.screenshot();
  const startVertex = await page.evaluate(
    async ({ base64, top, bottom }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const buffer = document.createElement("canvas");
      buffer.width = image.width;
      buffer.height = image.height;
      const context2d = buffer.getContext("2d");
      if (!context2d) return null;
      context2d.drawImage(image, 0, 0);
      const { data } = context2d.getImageData(0, 0, image.width, image.height);
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (
          Math.abs(data[i] - 8) < 12 &&
          Math.abs(data[i + 1] - 117) < 12 &&
          Math.abs(data[i + 2] - 46) < 12
        ) {
          // Only between the header and panel, whose buttons share this colour.
          const y = Math.floor(i / 4 / image.width);
          if (y / image.height < top || y / image.height > bottom) continue;
          sumX += (i / 4) % image.width;
          sumY += y;
          count += 1;
        }
      }
      return count ? { x: sumX / count, y: sumY / count, count, width: image.width } : null;
    },
    {
      base64: png.toString("base64"),
      top: headerBottom / (page.viewportSize()?.height ?? 1),
      bottom: panelTop / (page.viewportSize()?.height ?? 1),
    },
  );
  if (!startVertex) throw new Error("Start marker not found on the map");

  const box = await canvas.boundingBox();
  if (!box) throw new Error("Map has no size");
  const scale = box.width / startVertex.width;
  const from = { x: box.x + startVertex.x * scale, y: box.y + startVertex.y * scale };

  const session = await context.newCDPSession(page);
  const touch = (type: string, points: { x: number; y: number }[]) =>
    session.send("Input.dispatchTouchEvent", { type, touchPoints: points } as never);
  await touch("touchStart", [from]);
  for (let i = 1; i <= 5; i += 1) {
    await touch("touchMove", [{ x: from.x - i * 8, y: from.y + i * 6 }]);
    await page.waitForTimeout(30);
  }
  await touch("touchEnd", []);

  await expect(area).not.toHaveText(before ?? "");
  await shot(page, "3b-edited");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(area).toHaveText(before ?? "");

  await touch("touchStart", [from]);
  await touch("touchMove", [{ x: from.x - 40, y: from.y + 30 }]);
  await touch("touchEnd", []);
  await expect(area).not.toHaveText(before ?? "");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(area).toHaveText(before ?? "");
});

test("explains blocked GPS and still offers map marking", async ({ page, context }) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    const denied = (_: PositionCallback, error?: PositionErrorCallback | null) => {
      error?.({
        code: 1,
        message: "denied",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
      return 1;
    };
    navigator.geolocation.watchPosition = denied;
  });
  await skipInstallGuide(page);
  await page.goto("/");
  // Nothing is tapped: the app asks for location as soon as it opens.
  await expect(page.getByText("Location access is blocked")).toBeVisible();
  await expect(page.getByTestId("gps-status")).toContainText("GPS: Blocked");
  await shot(page, "1b-denied");
  await page.getByRole("button", { name: "Mark Corners on the Map" }).click();
  await expect(page.getByText("Recording…")).toBeVisible();

  const canvas = page.locator(".maplibregl-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Map has no size");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.35;
  for (const [dx, dy] of [
    [-80, -60],
    [80, -60],
    [80, 60],
    [-80, 60],
  ]) {
    await canvas.click({ position: { x: cx + dx - box.x, y: cy + dy - box.y } });
  }
  await expect(page.getByTestId("point-count")).toHaveText("4");
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Connect with Straight Line" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Placed on map")).toBeVisible();
  await expect(page.getByText("GPS not used")).toBeVisible();
});

test("clears the session from settings", async ({ page, context }) => {
  await startGrantedSession(page, context);
  await page.getByRole("button", { name: "Start Measuring", exact: true }).click();
  await setPosition(context, offset(6, 0));
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Discard It" }).click();
  await expect(page.getByRole("button", { name: "Start Measuring" })).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog")).toContainText("temporarily stored on this device");
  const credit = page.getByRole("link", { name: "Sandeepa Mallawarachchi" });
  await expect(page.getByRole("dialog")).toContainText("Copyright © 2026. All rights reserved.");
  await expect(credit).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/sandeepa-mallawarachchi",
  );
  await expect(credit).toHaveAttribute("target", "_blank");
  await credit.scrollIntoViewIfNeeded();
  await shot(page, "settings");
  await page.getByRole("button", { name: "Clear Session" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Clear Session" }).click();
  await expect(page.getByText("Session cleared")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("fieldmeasure.session"))).toBeNull();
});

test("installs a manifest and works offline after the first visit", async ({ page, context }) => {
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body.display).toBe("standalone");
  expect(body.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);

  await startGrantedSession(page, context);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The worker takes control and caches already-loaded assets a moment after activating.
  await page.waitForTimeout(3500);
  await page.reload();
  await page.getByRole("button", { name: "Start Measuring" }).waitFor();
  await page.waitForTimeout(2500);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start Measuring" })).toBeVisible();

  await page.getByRole("button", { name: "Start Measuring", exact: true }).click();
  await walkSquare(context, 20, 5, 700);
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("result-area")).toHaveText("0.099 acres");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Result (PNG)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  await download.saveAs("test-results/screens/report-offline.png");
  await context.setOffline(false);
});

test("switches to Sinhala everywhere, keeping the measurement @responsive", async ({
  page,
  context,
}, testInfo) => {
  await startGrantedSession(page, context);
  await page.setViewportSize(
    testInfo.project.name === "desktop"
      ? { width: 1440, height: 900 }
      : { width: 360, height: 740 },
  );
  const headingSize = () =>
    page
      .getByRole("heading", { level: 2 })
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  const englishSize = await headingSize();

  await page.getByRole("radio", { name: "සිංහල" }).click();
  await expect(page.getByRole("button", { name: "මැනීම අරඹන්න" })).toBeVisible();

  // Slightly smaller, not dramatically so, and the switch's thumb slides across.
  const sinhalaSize = await headingSize();
  expect(sinhalaSize).toBeLessThan(englishSize);
  expect(sinhalaSize).toBeGreaterThan(englishSize * 0.9);
  const thumb = page.getByTestId("language-thumb");
  expect(await thumb.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
    "0.2s",
  );
  await expect(thumb).toHaveClass(/translate-x-full/);
  await expect(page.getByTestId("gps-status")).toContainText("GPS: හොඳයි");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("si");
  await page.evaluate(() => document.fonts.ready);
  const shotName = `si-${testInfo.project.name}`;
  await shot(page, `${shotName}-1-ready`);

  // No button text may spill out of its button at this width.
  const overflowing = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter((button) => button.scrollWidth > button.clientWidth + 1)
        .map((button) => button.textContent),
    );
  expect(await overflowing()).toEqual([]);

  await page.reload();
  await expect(page.getByRole("button", { name: "මැනීම අරඹන්න" })).toBeVisible();

  await page.getByRole("button", { name: "මැනීම අරඹන්න" }).click();
  await expect(page.getByText("මනිමින්…")).toBeVisible();
  await walkSquare(context, 30, 5, 800);
  await shot(page, `${shotName}-2-recording`);
  expect(await overflowing()).toEqual([]);

  await page.getByRole("button", { name: "අවසන්", exact: true }).click();
  await expect(page.locator(".fm-area-label")).toContainText("0.222 අක්කර");
  await page.waitForTimeout(600);
  await shot(page, `${shotName}-3-review`);
  expect(await overflowing()).toEqual([]);

  await page.getByRole("button", { name: "තහවුරු කරන්න" }).click();
  await expect(page.getByTestId("result-area")).toHaveText("0.222 අක්කර");
  await page.waitForTimeout(600);
  await shot(page, `${shotName}-4-result`);
  expect(await overflowing()).toEqual([]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ප්‍රතිඵලය බාගන්න (PNG)" }).click();
  const download = await downloadPromise;
  await download.saveAs(`test-results/screens/${shotName}-report.png`);
});

test("asks for location on opening, without being tapped", async ({ page }) => {
  await skipInstallGuide(page);
  await page.addInitScript(() => {
    (window as unknown as { watchCalls: number }).watchCalls = 0;
    navigator.geolocation.watchPosition = () => {
      (window as unknown as { watchCalls: number }).watchCalls += 1;
      return 1;
    };
  });
  await page.goto("/");
  await expect(page.getByTestId("gps-status")).toContainText("GPS: Searching");
  expect(await page.evaluate(() => (window as unknown as { watchCalls: number }).watchCalls)).toBe(
    1,
  );
});

test("offers Android install steps once, and remembers dismissal", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await setPosition(context, START);
  await page.goto("/");
  const guide = page.getByTestId("install-guide");
  await expect(guide).toContainText("Install FieldMeasure");
  await expect(guide).toContainText("Open this page in Chrome");
  await expect(guide).toContainText("Install app or Add to Home screen");
  await shot(page, "install-android");
  await page.getByRole("button", { name: "Not Now" }).click();
  await expect(guide).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start Measuring" })).toBeVisible();
  await expect(guide).toHaveCount(0);
});

test.describe("on an iPhone", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });

  test("shows the Add to Home Screen steps", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await setPosition(context, START);
    await page.goto("/");
    await expect(page.getByTestId("install-guide")).toContainText("Open this page in Safari");
    await expect(page.getByTestId("install-guide")).toContainText("Add to Home Screen");
    await shot(page, "install-ios");
  });
});

test("doesn't offer installation on desktop @responsive", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only");
  await context.grantPermissions(["geolocation"]);
  await setPosition(context, START);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start Measuring" })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("install-guide")).toHaveCount(0);
});

test("has no page overflow at any screen size @responsive", async ({ page, context }) => {
  await skipInstallGuide(page);
  await context.grantPermissions(["geolocation"]);
  await setPosition(context, START);
  await page.goto("/");
  await page.getByRole("button", { name: "Start Measuring" }).waitFor();
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    // The GPS status must not end up underneath a panel at any size.
    const statusOnTop = await page.getByTestId("gps-status").evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(x + width / 2, y + height / 2));
    });
    expect(statusOnTop).toBe(true);
    await shot(page, `responsive-${size.width}`);
  }
});
