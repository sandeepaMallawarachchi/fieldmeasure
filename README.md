# FieldMeasure

**Measure land by walking.** A mobile-first Progressive Web App that measures land area and perimeter by walking around a boundary with your phone's GPS. No account, no server-side storage.

Results are estimates from consumer GPS. They are not a substitute for a professional land survey.

## Quick start

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local   # optional: the app runs without any configuration
npm run dev                  # http://localhost:3000
```

| Command                                   | Purpose                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                             | Development server (service worker disabled)                                |
| `npm run build` / `npm start`             | Production build and server                                                 |
| `npm run lint` / `npm run typecheck`      | ESLint / TypeScript strict checks                                           |
| `npm run format` / `npm run format:check` | Prettier                                                                    |
| `npm test`                                | Unit and integration tests (Vitest)                                         |
| `npm run test:e2e`                        | End-to-end tests (Playwright, builds the app first)                         |
| `./scripts/generate-icons.sh`             | Regenerate favicon and PWA icons from `public/logo.png` (needs ImageMagick) |

The first Playwright run needs `npx playwright install chromium`.

## Environment and map providers

All variables are optional and are read at build time. See [.env.example](.env.example).

| Variable                             | Purpose                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME`               | Display name                                                                                  |
| `NEXT_PUBLIC_MAP_STYLE_URL`          | Street style. Empty uses [OpenFreeMap](https://openfreemap.org); `none` disables network maps |
| `NEXT_PUBLIC_SATELLITE_STYLE_URL`    | Satellite style. No option appears until this is set. `{key}` is replaced by the key below    |
| `NEXT_PUBLIC_MAP_API_KEY`            | Public token for the provider                                                                 |
| `NEXT_PUBLIC_SATELLITE_ALLOW_EXPORT` | `true` only if the provider's terms allow imagery in downloaded images                        |

**Satellite imagery needs a licensed provider**, so it is off until you configure one. For example, with [MapTiler](https://www.maptiler.com):

```env
NEXT_PUBLIC_SATELLITE_STYLE_URL=https://api.maptiler.com/maps/hybrid/style.json?key={key}
NEXT_PUBLIC_MAP_API_KEY=your-public-key
```

Browser-exposed tokens are public. Restrict them to your domain in the provider's dashboard, and check the provider's terms for caching and export before setting `NEXT_PUBLIC_SATELLITE_ALLOW_EXPORT`.

If a map fails to load, the app switches to a built-in plain view that needs no network. Recording and calculations do not depend on the map.

## Using the app

GPS needs a **secure context**: HTTPS, or `localhost` in development. To test on a phone during development, use an HTTPS tunnel or deploy a preview, since a LAN address such as `http://192.168.x.x` won't get location access.

Location permission is requested only when the user taps **Find My Location** or starts measuring, never on page load. If it is blocked, the app explains how to allow it and still offers marking corners on the map.

### Install

- **Android (Chrome):** browser menu, then _Install app_ or _Add to Home screen_.
- **iPhone/iPad (Safari):** Share, then _Add to Home Screen_.
- **Desktop (Chrome/Edge):** the install icon in the address bar.

### Offline

After one successful online visit, the service worker has cached the app. Offline you can then open the app, record with GPS, calculate and edit, and export a PNG. Without tiles, the map uses the plain view and the report shows the boundary to scale on a plain background.

Map tiles are never cached by the service worker, because provider terms commonly restrict it, and GPS data never enters any service worker cache.

### Session data

Measurements live only in the browser's `sessionStorage`, with checkpoints at most every 10 seconds while recording and immediately on meaningful changes. After a reload the app offers to continue; a recording comes back **paused**, since GPS did not run in between. Corrupt data is rejected and removed.

`sessionStorage` is temporary, and browsers differ in when they clear it, so **download the result before closing the app**. The _Clear Session_ button in Settings deletes the local data.

### PNG export

Exports are 1600 x 1200 PNGs, composed on a canvas rather than screenshotted, named `fieldmeasure-YYYY-MM-DD-HH-mm.png`. Map imagery is included only if it fully loads and the provider's terms allow it; otherwise the report uses a plain background and says so. On iOS, the image opens in the share sheet, where _Save Image_ stores it.

## Measurement model and limitations

**Calculations** ([lib/geometry](lib/geometry)):

- Area and perimeter are geodesic on the **WGS84 ellipsoid**, using [GeographicLib](https://geographiclib.sourceforge.io/). Turf's area is spherical and reads about 0.4% high around Sri Lanka's latitude, so it is used only as an independent cross-check in tests.
- The GPS filter uses Turf's spherical distance and bearing. It compares short steps to thresholds, where the difference is far below GPS noise.
- Area is the horizontal projection: altitude is ignored, so sloping land measures as its flat footprint.
- Full precision is kept internally. Display precision is limited on purpose ([config/units.ts](config/units.ts)).

**GPS filtering** ([lib/gps/gpsFiltering.ts](lib/gps/gpsFiltering.ts), thresholds in [config/gps.ts](config/gps.ts)): fixes are kept or dropped, never moved or smoothed. It rejects invalid, stale, repeated and low-accuracy fixes and implausible speeds; holds long jumps until a second fix agrees; ignores stationary drift; and keeps short steps when the walker turns, so corners aren't cut. Raw observations, the accepted boundary and the edited boundary are stored separately.

**The thresholds are starting values and need tuning from real walks.**

**Boundary rules:** a large gap between the last point and the start is only closed with the user's confirmation, and it is recorded on the result. Self-intersecting boundaries are never silently repaired: they block confirmation until edited, or until the user chooses _Remove Crossing Loops_, which is undoable.

**Known limitations:**

- Accuracy depends on the device, sky view and how closely the boundary is followed. The "±" figure is the device's own estimate, not a guaranteed limit. Expect metres of error on any point, which matters most on small plots.
- Web apps only get reliable GPS in the foreground. The app keeps the screen awake where supported and warns if it was backgrounded, but it can't record while hidden.
- Editing is by map gesture. Vertex editing isn't currently available by keyboard.
- English only for now. Text is centralised in [lib/i18n](lib/i18n); Sinhala needs a reviewed translation and a font with Sinhala glyphs.

## Project layout

```text
app/          Next.js routes, manifest, global styles
components/   UI: layout, map, measurement panels, dialogs, shadcn-style primitives
config/       GPS thresholds, units, app settings
hooks/        Browser integration: geolocation, persistence, wake lock, service worker
lib/gps/      Validation, filtering, quality, geolocation service
lib/geometry/ Area, perimeter, polygon validation, conversions
lib/measurement/  State machine (reducer) and selectors
lib/map/      MapLibre controller, styles, helpers
lib/export/   PNG report composition and download
lib/storage/  Session persistence with runtime validation
store/        Small external store, so GPS fixes don't re-render React
public/sw.js  Service worker
```

## Testing

```bash
npm test
npm run test:e2e
```

Unit tests check geometry against independent reference values, including near the equator. End-to-end tests drive a production build in Chromium with emulated geolocation and the plain map.

**Emulated coordinates only test the app's flow, not GPS accuracy.** Before relying on results, test on real Android and iOS hardware with different plot sizes, sky conditions, walking speeds and irregular boundaries, comparing against a known area.

## Deploying to Vercel

1. Import the repository in Vercel. The Next.js defaults work as they are.
2. Add any environment variables above, then deploy. Because they are read at build time, redeploy after changing them.
3. Restrict your map token to the deployed domain.

The service worker's `Cache-Control` and the security headers are set in [next.config.ts](next.config.ts). If you add a map provider, the CSP already allows `https:` for tiles.
