import { APP_CONFIG } from "@/config/app";
import { boundsOf, type Projector } from "@/lib/map/mapHelpers";
import { getExportStyleUrl } from "@/lib/map/mapStyles";
import type { MapStyleId } from "@/types/map";
import type { LngLat } from "@/types/measurement";

export interface MapImage {
  /** Null for the plain report map, which is drawn entirely by the report. */
  canvas: HTMLCanvasElement | null;
  project: Projector;
  metersPerPixel: number;
  attribution: string;
}

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

function mercatorY(latitude: number): number {
  const radians = (latitude * Math.PI) / 180;
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
}

/** Web Mercator fit used without imagery, so the shape matches the map view in the app. */
export function createPlainProjection(
  positions: readonly LngLat[],
  width: number,
  height: number,
  padding: number,
): { project: Projector; metersPerPixel: number } {
  const bounds = boundsOf(positions);
  const [[west, south], [east, north]] = bounds ?? [
    [0, 0],
    [0, 0],
  ];
  const xOf = (longitude: number) => (longitude + 180) / 360;
  const spanX = Math.max(xOf(east) - xOf(west), 1e-9);
  const spanY = Math.max(mercatorY(south) - mercatorY(north), 1e-9);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  const centerLat = (south + north) / 2;
  return {
    project: ([longitude, latitude]) => ({
      x: offsetX + (xOf(longitude) - xOf(west)) * scale,
      y: offsetY + (mercatorY(latitude) - mercatorY(north)) * scale,
    }),
    metersPerPixel: (EARTH_CIRCUMFERENCE_M * Math.cos((centerLat * Math.PI) / 180)) / scale,
  };
}

function plainMap(
  positions: readonly LngLat[],
  width: number,
  height: number,
  padding: number,
): MapImage {
  return {
    canvas: null,
    attribution: "",
    ...createPlainProjection(positions, width, height, padding),
  };
}

/** Providers supply attribution as HTML, with links and entities such as &copy;. */
function attributionToText(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
}

/** Rejects the blank results WebGL can produce after context loss or low memory. */
function hasVisibleContent(canvas: HTMLCanvasElement): boolean {
  const sample = document.createElement("canvas");
  sample.width = 16;
  sample.height = 16;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(canvas, 0, 0, 16, 16);
  const { data } = context.getImageData(0, 0, 16, 16); // Throws if the imagery is CORS-tainted.
  let bright = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && data[i] + data[i + 1] + data[i + 2] > 30) bright += 1;
  }
  return bright > 16;
}

async function renderImagery(
  styleUrl: string,
  positions: readonly LngLat[],
  width: number,
  height: number,
  padding: number,
): Promise<MapImage> {
  const { LngLatBounds, Map: MapLibreMap, setWorkerUrl } = await import("maplibre-gl");
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  const bounds = boundsOf(positions);
  if (!bounds) throw new Error("A report needs a boundary");

  // A separate map at the report's own size: the visible phone viewport has the
  // wrong shape and resolution, and it would show the live interface state.
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-${width * 2}px;top:0;width:${width}px;height:${height}px;`;
  document.body.append(host);

  const map = new MapLibreMap({
    container: host,
    style: styleUrl,
    bounds: new LngLatBounds(bounds[0], bounds[1]),
    fitBoundsOptions: { padding, maxZoom: 20 },
    interactive: false,
    attributionControl: false,
    pixelRatio: 1,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Map tiles did not finish loading")),
        APP_CONFIG.exportMapTimeoutMs,
      );
      map.once("idle", () => {
        clearTimeout(timer);
        resolve();
      });
      map.on("error", (event) => {
        // A partial map would be misleading, so any load failure means no imagery.
        clearTimeout(timer);
        reject(event.error);
      });
    });

    const canvas = map.getCanvas();
    if (!hasVisibleContent(canvas)) throw new Error("Map rendered blank");

    const copy = document.createElement("canvas");
    copy.width = width;
    copy.height = height;
    const context = copy.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(canvas, 0, 0, width, height);

    const attributions = new Set<string>();
    for (const id of Object.keys(map.getStyle().sources)) {
      const text = (map.getSource(id) as { attribution?: string } | undefined)?.attribution;
      if (text) attributions.add(attributionToText(text));
    }

    const positionsOnMap = new Map(
      positions.map((position) => [position, map.project(position)] as const),
    );
    const center = map.getCenter();
    const metersPerPixel =
      (EARTH_CIRCUMFERENCE_M * Math.cos((center.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
    return {
      canvas: copy,
      metersPerPixel,
      attribution: [...attributions].join(" "),
      project: (position) => positionsOnMap.get(position) ?? { x: 0, y: 0 },
    };
  } finally {
    map.remove();
    host.remove();
  }
}

/**
 * Returns imagery only if it fully loaded and the provider's terms allow it.
 * Otherwise the report shows the true boundary on a plain background: never a
 * partial, blank or substitute map.
 */
export async function renderMapImage(
  positions: readonly LngLat[],
  selectedStyle: MapStyleId,
  width: number,
  height: number,
  padding: number,
): Promise<MapImage> {
  const styleUrl = getExportStyleUrl(selectedStyle);
  if (!styleUrl || (typeof navigator !== "undefined" && navigator.onLine === false)) {
    return plainMap(positions, width, height, padding);
  }
  try {
    return await renderImagery(styleUrl, positions, width, height, padding);
  } catch {
    return plainMap(positions, width, height, padding);
  }
}
