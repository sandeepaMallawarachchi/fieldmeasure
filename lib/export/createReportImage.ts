import { LOGO_SRC } from "@/lib/brand";
import { APP_CONFIG, APP_NAME } from "@/config/app";
import { t } from "@/lib/i18n";
import { formatDateTime, type ReportData } from "./reportData";
import { renderMapImage, type MapImage } from "./renderMapImage";

const COLORS = {
  primary: "#08752E",
  accent: "#32D758",
  foreground: "#172B21",
  muted: "#5B6B62",
  border: "#E2E8E4",
  surface: "#FFFFFF",
  soft: "#F3F8F4",
  plainMap: "#E9F0EA",
  grid: "#D9E4DB",
};

const MARGIN = 48;
const HEADER_H = 112;
const FOOTER_H = 92;
const MAP_W = 980;
const MAP_PADDING = 90;

function setFont(context: CanvasRenderingContext2D, size: number, weight: number, family: string) {
  context.font = `${weight} ${size}px ${family}`;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shrinks text to fit, because values such as large areas must never be cut off. */
function fitFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight: number,
  family: string,
): number {
  let current = size;
  setFont(context, current, weight, family);
  while (current > 12 && context.measureText(text).width > maxWidth) {
    current -= 2;
    setFont(context, current, weight, family);
  }
  return current;
}

/** Same-origin, so it can't taint the canvas, and cached by the service worker for offline use. */
function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    // A report without its logo is still correct, so this never fails the export.
    image.onerror = () => resolve(null);
    image.src = LOGO_SRC;
  });
}

function drawHeader(
  context: CanvasRenderingContext2D,
  width: number,
  data: ReportData,
  logo: HTMLImageElement | null,
  family: string,
) {
  context.textBaseline = "middle";
  context.textAlign = "left";
  if (logo) {
    const logoHeight = HEADER_H - 16;
    context.drawImage(
      logo,
      MARGIN - 8,
      2,
      (logo.naturalWidth / logo.naturalHeight) * logoHeight,
      logoHeight,
    );
  } else {
    context.fillStyle = COLORS.primary;
    setFont(context, 40, 700, family);
    context.fillText(APP_NAME, MARGIN, 58);
  }

  context.textAlign = "right";
  context.fillStyle = COLORS.foreground;
  setFont(context, 28, 600, family);
  context.fillText(t.report.heading, width - MARGIN, 42);
  context.fillStyle = COLORS.muted;
  setFont(context, 22, 400, family);
  context.fillText(formatDateTime(data.measuredAt), width - MARGIN, 76);
  context.textAlign = "left";

  context.fillStyle = COLORS.primary;
  context.fillRect(MARGIN, HEADER_H - 8, width - MARGIN * 2, 3);
}

function niceScaleLength(maxMeters: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(maxMeters));
  for (const step of [5, 2, 1]) {
    if (step * magnitude <= maxMeters) return step * magnitude;
  }
  return magnitude;
}

function drawMapDecorations(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  image: MapImage,
  family: string,
) {
  // Scale bar. Derived from the same projection as the polygon.
  const meters = niceScaleLength(image.metersPerPixel * 220);
  const barWidth = meters / image.metersPerPixel;
  const barX = x + 24;
  const barY = y + h - 34;
  const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  context.fillStyle = "rgba(255,255,255,0.9)";
  context.beginPath();
  context.roundRect(barX - 12, barY - 34, barWidth + 24, 52, 8);
  context.fill();
  context.fillStyle = COLORS.foreground;
  context.fillRect(barX, barY, barWidth, 6);
  setFont(context, 20, 600, family);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(label, barX, barY - 10);

  // North arrow: the export map is never rotated.
  const arrowX = x + w - 44;
  const arrowY = y + 44;
  context.fillStyle = "rgba(255,255,255,0.9)";
  context.beginPath();
  context.arc(arrowX, arrowY, 28, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = COLORS.foreground;
  context.beginPath();
  context.moveTo(arrowX, arrowY - 20);
  context.lineTo(arrowX + 9, arrowY - 4);
  context.lineTo(arrowX - 9, arrowY - 4);
  context.closePath();
  context.fill();
  setFont(context, 20, 700, family);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(t.report.north, arrowX, arrowY + 11);
  context.textAlign = "left";

  const footnote = image.canvas ? image.attribution : t.report.plainMap;
  if (footnote) {
    setFont(context, 16, 400, family);
    const textWidth = Math.min(context.measureText(footnote).width, w - 32);
    context.fillStyle = "rgba(255,255,255,0.88)";
    context.fillRect(x + w - textWidth - 16, y + h - 30, textWidth + 16, 30);
    context.fillStyle = COLORS.foreground;
    context.textBaseline = "middle";
    context.fillText(footnote, x + w - textWidth - 8, y + h - 15, w - 32);
  }
}

function drawMap(
  context: CanvasRenderingContext2D,
  data: ReportData,
  image: MapImage,
  x: number,
  y: number,
  w: number,
  h: number,
  family: string,
) {
  context.save();
  const frame = new Path2D();
  frame.roundRect(x, y, w, h, 20);
  context.clip(frame);

  if (image.canvas) {
    context.drawImage(image.canvas, x, y, w, h);
  } else {
    context.fillStyle = COLORS.plainMap;
    context.fillRect(x, y, w, h);
    context.strokeStyle = COLORS.grid;
    context.lineWidth = 1;
    for (let gx = x + 70; gx < x + w; gx += 70) {
      context.beginPath();
      context.moveTo(gx, y);
      context.lineTo(gx, y + h);
      context.stroke();
    }
    for (let gy = y + 70; gy < y + h; gy += 70) {
      context.beginPath();
      context.moveTo(x, gy);
      context.lineTo(x + w, gy);
      context.stroke();
    }
  }

  const ring = new Path2D();
  data.positions.forEach((position, index) => {
    const point = image.project(position);
    if (index === 0) ring.moveTo(x + point.x, y + point.y);
    else ring.lineTo(x + point.x, y + point.y);
  });
  ring.closePath();
  context.fillStyle = "rgba(50, 215, 88, 0.32)";
  context.fill(ring);
  context.lineJoin = "round";
  context.strokeStyle = "rgba(8, 117, 46, 0.65)";
  context.lineWidth = 9;
  context.stroke(ring);
  context.strokeStyle = COLORS.accent;
  context.lineWidth = 5;
  context.stroke(ring);

  drawMapDecorations(context, x, y, w, h, image, family);
  context.restore();

  context.strokeStyle = COLORS.border;
  context.lineWidth = 2;
  context.stroke(frame);
}

function drawRows(
  context: CanvasRenderingContext2D,
  rows: ReportData["areaRows"],
  x: number,
  startY: number,
  w: number,
  family: string,
): number {
  let y = startY;
  context.textBaseline = "alphabetic";
  for (const row of rows) {
    context.textAlign = "left";
    context.fillStyle = COLORS.muted;
    setFont(context, 22, 400, family);
    context.fillText(row.label, x, y);
    const labelWidth = context.measureText(row.label).width;
    context.textAlign = "right";
    context.fillStyle = COLORS.foreground;
    fitFontSize(context, row.value, w - labelWidth - 16, 26, 600, family);
    context.fillText(row.value, x + w, y);
    y += 40;
  }
  context.textAlign = "left";
  return y;
}

function drawSectionTitle(
  context: CanvasRenderingContext2D,
  title: string,
  x: number,
  y: number,
  family: string,
) {
  context.fillStyle = COLORS.primary;
  setFont(context, 20, 700, family);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(title.toUpperCase(), x, y);
}

function drawResults(
  context: CanvasRenderingContext2D,
  data: ReportData,
  x: number,
  top: number,
  w: number,
  bottom: number,
  family: string,
) {
  context.fillStyle = COLORS.soft;
  context.beginPath();
  context.roundRect(x, top, w, 186, 20);
  context.fill();

  context.fillStyle = COLORS.muted;
  setFont(context, 24, 500, family);
  context.textBaseline = "alphabetic";
  context.fillText(t.report.totalArea, x + 28, top + 46);

  const unit = t.units.acres.long;
  setFont(context, 36, 600, family);
  const unitWidth = context.measureText(unit).width;
  const size = fitFontSize(context, data.acres, w - 76 - unitWidth - 16, 88, 700, family);
  context.fillStyle = COLORS.primary;
  context.fillText(data.acres, x + 28, top + 142);
  const valueWidth = context.measureText(data.acres).width;
  setFont(context, Math.min(36, size), 600, family);
  context.fillText(unit, x + 28 + valueWidth + 16, top + 142);

  let y = top + 232;
  y = drawRows(context, data.areaRows, x, y, w, family);

  y += 18;
  drawSectionTitle(context, t.report.perimeter, x, y, family);
  y = drawRows(context, data.perimeterRows, x, y + 40, w, family);

  context.fillStyle = COLORS.border;
  context.fillRect(x, y - 12, w, 2);
  y += 28;

  for (const row of data.metadataRows) {
    context.fillStyle = COLORS.muted;
    setFont(context, 20, 500, family);
    context.fillText(row.label, x, y);
    y += 28;
    context.fillStyle = COLORS.foreground;
    setFont(context, 22, 500, family);
    for (const line of wrapText(context, row.value, w)) {
      context.fillText(line, x, y);
      y += 28;
    }
    y += 10;
  }

  // Notes get whatever height remains; the last line says so if some don't fit.
  setFont(context, 19, 400, family);
  const lineHeight = 25;
  const lines = data.notes.flatMap((note) => wrapText(context, `• ${note}`, w));
  const available = Math.floor((bottom - y) / lineHeight);
  const visible = lines.length > available ? lines.slice(0, Math.max(0, available - 1)) : lines;
  context.fillStyle = "#92400E";
  for (const line of visible) {
    context.fillText(line, x, y);
    y += lineHeight;
  }
  if (visible.length < lines.length && available > 0) {
    context.fillText(`+ ${lines.length - visible.length} more lines`, x, y);
  }
}

function drawFooter(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  family: string,
) {
  const top = height - FOOTER_H;
  context.fillStyle = COLORS.border;
  context.fillRect(MARGIN, top, width - MARGIN * 2, 2);
  context.fillStyle = COLORS.muted;
  context.textBaseline = "middle";
  context.textAlign = "center";
  fitFontSize(context, t.result.disclaimer, width - MARGIN * 2, 24, 500, family);
  context.fillText(t.result.disclaimer, width / 2, top + FOOTER_H / 2);
  context.textAlign = "left";
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be encoded"))),
      "image/png",
    );
  });
}

/** Composes the report itself rather than screenshotting the phone's viewport. */
export async function createReportImage(data: ReportData): Promise<Blob> {
  const { width, height } = APP_CONFIG.exportSize;
  await document.fonts?.ready;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";

  const mapTop = HEADER_H + 16;
  const mapHeight = height - mapTop - FOOTER_H - 16;
  const [image, logo] = await Promise.all([
    renderMapImage(data.positions, data.mapStyle, MAP_W, mapHeight, MAP_PADDING),
    loadLogo(),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  context.fillStyle = COLORS.surface;
  context.fillRect(0, 0, width, height);
  drawHeader(context, width, data, logo, family);
  drawMap(context, data, image, MARGIN, mapTop, MAP_W, mapHeight, family);
  const columnX = MARGIN + MAP_W + 36;
  drawResults(
    context,
    data,
    columnX,
    mapTop,
    width - columnX - MARGIN,
    height - FOOTER_H - 16,
    family,
  );
  drawFooter(context, width, height, family);

  try {
    return await canvasToBlob(canvas);
  } finally {
    // Releases the backing store promptly on memory-constrained phones.
    canvas.width = 0;
    canvas.height = 0;
    if (image.canvas) {
      image.canvas.width = 0;
      image.canvas.height = 0;
    }
  }
}
