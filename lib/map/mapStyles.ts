import type { StyleSpecification } from "maplibre-gl";
import type { MapStyleId } from "@/types/map";

/**
 * Street map: OpenFreeMap needs no key and permits this use with attribution.
 * Satellite: there is no default, because imagery needs a licensed provider.
 * Plain: built in, makes no network requests, and is what keeps the app working
 * offline or when a provider fails.
 *
 * Tile requests reveal the viewed area to whichever provider is configured.
 */
const DEFAULT_STREET_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export const PLAIN_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#E9F0EA" } }],
};

export interface MapStyleOption {
  id: MapStyleId;
  /** Null means the built-in style. */
  url: string | null;
  /** Whether the provider's terms allow this imagery in a downloaded image. */
  allowExport: boolean;
}

function resolveUrl(url: string | undefined, apiKey: string): string | null {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === "none") return null;
  if (trimmed.includes("{key}") && !apiKey) return null;
  return trimmed.replaceAll("{key}", encodeURIComponent(apiKey));
}

export function buildStyleOptions(env: {
  streetUrl?: string;
  satelliteUrl?: string;
  apiKey?: string;
  satelliteAllowExport?: string;
}): MapStyleOption[] {
  const apiKey = env.apiKey?.trim() ?? "";
  const satelliteUrl = resolveUrl(env.satelliteUrl, apiKey);
  const streetUrl =
    env.streetUrl?.trim() === "none"
      ? null
      : (resolveUrl(env.streetUrl, apiKey) ?? DEFAULT_STREET_STYLE_URL);

  const options: MapStyleOption[] = [];
  if (satelliteUrl) {
    options.push({
      id: "satellite",
      url: satelliteUrl,
      allowExport: env.satelliteAllowExport === "true",
    });
  }
  if (streetUrl) options.push({ id: "street", url: streetUrl, allowExport: true });
  options.push({ id: "plain", url: null, allowExport: true });
  return options;
}

export const MAP_STYLE_OPTIONS = buildStyleOptions({
  streetUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  satelliteUrl: process.env.NEXT_PUBLIC_SATELLITE_STYLE_URL,
  apiKey: process.env.NEXT_PUBLIC_MAP_API_KEY,
  satelliteAllowExport: process.env.NEXT_PUBLIC_SATELLITE_ALLOW_EXPORT,
});

export const DEFAULT_MAP_STYLE: MapStyleId = MAP_STYLE_OPTIONS[0].id;

export function isStyleAvailable(id: MapStyleId): boolean {
  return MAP_STYLE_OPTIONS.some((option) => option.id === id);
}

export function getStyleDefinition(id: MapStyleId): string | StyleSpecification {
  return MAP_STYLE_OPTIONS.find((option) => option.id === id)?.url ?? PLAIN_MAP_STYLE;
}

/** The chosen map if its licence allows export; otherwise the next permitted network map. */
export function getExportStyleUrl(selected: MapStyleId): string | null {
  const chosen = MAP_STYLE_OPTIONS.find((option) => option.id === selected);
  if (chosen?.allowExport) return chosen.url;
  return MAP_STYLE_OPTIONS.find((option) => option.allowExport && option.url)?.url ?? null;
}
