// MapLibre runs its tile worker from a separate file. Serving it from a fixed
// same-origin path keeps it compatible with the CSP and lets the service worker
// cache it for offline use.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "maplibre");
mkdirSync(target, { recursive: true });
copyFileSync(
  join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs"),
  join(target, "maplibre-gl-worker.mjs"),
);
