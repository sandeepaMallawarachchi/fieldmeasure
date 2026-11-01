import type { GPSErrorKind, GPSQuality, GPSSignal } from "@/types/gps";
import type { AreaUnit, WarningCode } from "@/types/measurement";
import type { MapStyleId } from "@/types/map";
import type { PolygonIssue } from "@/lib/geometry/validatePolygon";
import type { MeasurementMethod } from "@/lib/measurement/selectors";

export const en = {
  appTagline: "Measure land by walking.",
  common: {
    cancel: "Cancel",
    close: "Close",
    back: "Back",
    undo: "Undo",
    reset: "Reset",
    dismiss: "Dismiss",
    area: "Area",
    perimeter: "Perimeter",
  },
  header: { settings: "Settings" },
  gps: {
    signal: {
      off: "GPS: Off",
      searching: "GPS: Searching…",
      good: "GPS: Good",
      moderate: "GPS: Moderate",
      poor: "GPS: Weak",
      denied: "GPS: Blocked",
      unavailable: "GPS: Unavailable",
    } satisfies Record<GPSSignal, string>,
    accuracy: (meters: string) => `Accuracy ±${meters} m`,
    accuracyHelp:
      "This is the device's own estimate of its accuracy, not a guaranteed limit on the measurement error.",
    errors: {
      "permission-denied":
        "Location access is blocked. Allow location for this site in your browser settings, then try again.",
      "position-unavailable":
        "Your device can't get a location right now. Check that location services are on and move to open sky.",
      timeout: "Still looking for a GPS signal. Moving to open sky usually helps.",
      unsupported:
        "This browser doesn't support GPS location. You can still mark corners on the map.",
      "insecure-context":
        "GPS needs a secure (https) connection. Open the app using its https address.",
    } satisfies Record<GPSErrorKind, string>,
    quality: {
      good: "Good conditions",
      moderate: "Moderate conditions",
      poor: "Poor conditions",
      unavailable: "GPS not used",
    } satisfies Record<GPSQuality, string>,
  },
  ready: {
    title: "Ready to measure?",
    description: "Start at the edge of your land and walk around its boundary.",
    start: "Start Measuring",
    startWeak: "Start anyway (weak GPS)",
    findLocation: "Find My Location",
    searching: "Finding your location…",
    searchingDetail: "Stay outdoors with a clear view of the sky.",
    manual: "Manual Mark (Add Corners)",
    tryAgain: "Try Again",
    markOnMap: "Mark Corners on the Map",
    errorTitle: "GPS isn't available",
    tempWarning:
      "Keep this app open while measuring. Download your result before leaving because measurements are only stored temporarily.",
  },
  recording: {
    recording: "Recording…",
    paused: "Paused",
    pauseLabel: "Pause measuring",
    resumeLabel: "Resume measuring",
    liveArea: "Live Area (approx.)",
    walked: "Walked",
    points: "Points",
    pause: "Pause",
    resume: "Resume",
    finish: "Finish",
    markCorner: "Mark Corner",
    manualHint: "Stand at each corner and tap Mark Corner, or tap the map to place a corner.",
    pausedHint: "Paused. Points aren't recorded. Return to where you stopped before resuming.",
    undoPoint: "Undo Last Point",
    cornerMarked: "Corner marked",
    cornerNoFix: "No recent GPS position yet. Wait for a signal, then mark the corner.",
    hiddenWarning:
      "The app was in the background, so GPS may not have recorded that part of the walk. Check the boundary when you finish.",
  },
  review: {
    title: "Review & Edit",
    fineTune: "Fine-tune the boundary",
    fineTuneDetail: "Drag the points to adjust. Area and perimeter update automatically.",
    addPoint: "Add Point",
    addPointActive: "Tap near the boundary",
    removePoint: "Remove Point",
    confirm: "Confirm",
    fixCrossings: "Remove Crossing Loops",
    fixedCrossings: (area: string) =>
      `Crossing loops removed. Area is now ${area}. Tap Undo to restore.`,
    issues: {
      "invalid-coordinate": "This boundary contains an invalid position.",
      "too-few-points": "A boundary needs at least 3 separate points.",
      "self-intersection":
        "The boundary crosses itself at the red marks. Move the points, or remove the loops, before confirming.",
      degenerate: "This boundary is too small or too narrow to be measured as an area.",
    } satisfies Record<PolygonIssue, string>,
    edited: "Edited",
    discardEditsTitle: "Discard your edits?",
    discardEditsBody: "Going back to recording removes the changes you made to the boundary.",
    discardEdits: "Discard Edits",
  },
  closure: {
    title: "Connect the boundary?",
    body: (meters: string) =>
      `Your last point is ${meters} m from where you started. Connecting them adds a straight line you didn't walk, which may not match your boundary.`,
    keepWalking: "Keep Walking",
    connect: "Connect with Straight Line",
  },
  tooFewPoints: {
    title: "Not enough points yet",
    body: "A boundary needs at least 3 separate points. Keep measuring, or discard this measurement.",
    keepMeasuring: "Keep Measuring",
    discard: "Discard Measurement",
  },
  result: {
    title: "Measurement Result",
    measuredOn: "Measured on",
    gpsQuality: "GPS conditions",
    medianAccuracy: (meters: string) => `Median reported accuracy ±${meters} m`,
    method: "Method",
    points: "Boundary points",
    recordedFixes: (count: number) => `${count.toLocaleString("en-US")} GPS readings`,
    edited: "Manually corrected",
    notes: "Notes on this measurement",
    download: "Download Result (PNG)",
    downloading: "Preparing image…",
    downloaded: "Image saved. Check your downloads.",
    shared: "Image ready to share or save.",
    exportFailed: "Couldn't create the image. Close other apps and try again.",
    editBoundary: "Edit Boundary",
    newMeasurement: "New Measurement",
    methods: {
      "gps-walk": "GPS walking",
      "gps-corners": "GPS corner marking",
      "map-placed": "Placed on map",
      "mixed-manual": "GPS corners and map placement",
    } satisfies Record<MeasurementMethod, string>,
    disclaimer:
      "Measurements are estimates based on device GPS and are not a substitute for a professional land survey.",
  },
  warnings: {
    "weak-start": () => "GPS signal was weak when the measurement started.",
    "long-gap": (meters: string | null, count: number) =>
      `GPS lost contact ${count} time${count === 1 ? "" : "s"}${meters ? ` (longest gap ${meters} m)` : ""}, leaving straight lines that weren't tracked.`,
    background: (_meters: string | null, count: number) =>
      `The app was in the background ${count} time${count === 1 ? "" : "s"} during recording.`,
    "closing-gap": (meters: string | null) =>
      `A ${meters ?? "?"} m straight line, which wasn't walked, closes the boundary.`,
    "paused-gap": (meters: string | null) =>
      `You moved ${meters ?? "?"} m while paused; that part is a straight line.`,
    "poor-corner": () => "At least one corner was marked with a weak GPS signal.",
    "storage-unavailable": () => "Recovery storage was unavailable for part of this session.",
  } satisfies Record<WarningCode, (meters: string | null, count: number) => string>,
  units: {
    acres: { long: "acres", short: "ac", label: "Acres" },
    squareMeters: { long: "m²", short: "m²", label: "Square meters" },
    hectares: { long: "ha", short: "ha", label: "Hectares" },
    squareKilometers: { long: "km²", short: "km²", label: "Square kilometers" },
    perches: { long: "perches", short: "P", label: "Perches" },
    squareFeet: { long: "sq ft", short: "sq ft", label: "Square feet" },
  } satisfies Record<AreaUnit, { long: string; short: string; label: string }>,
  length: { meters: "m", kilometers: "km" },
  settings: {
    title: "Settings",
    areaUnit: "Main area unit",
    session: "This measurement",
    sessionWarning:
      "Your measurement is temporarily stored on this device. Download your result before closing the app. Your data may be lost when the session ends.",
    clear: "Clear Session",
    clearTitle: "Clear this session?",
    clearBody: "This deletes the current measurement from this device. It can't be undone.",
    aboutTitle: "About accuracy",
    about:
      "Results are estimates from your phone's GPS. Accuracy depends on your device, sky view and how closely you follow the boundary. Area is calculated on the WGS84 Earth model.",
    install: "Install the app",
    installAndroid:
      "Android: in Chrome, open the ⋮ menu and choose Install app or Add to Home screen.",
    installIos: "iPhone and iPad: in Safari, tap Share, then Add to Home Screen.",
    cleared: "Session cleared",
    copyright: "Copyright © 2026. All rights reserved.",
    credit: "Designed and Developed by",
    creditName: "Sandeepa Mallawarachchi",
    creditUrl: "https://www.linkedin.com/in/sandeepa-mallawarachchi",
  },
  map: {
    layers: "Change map type",
    locate: "Go to my location",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fit: "Show the whole boundary",
    styles: {
      satellite: "Satellite",
      street: "Street",
      plain: "Plain (no internet needed)",
    } satisfies Record<MapStyleId, string>,
    styleFailed:
      "That map couldn't load, so the plain view is showing. Your measurement isn't affected.",
    tilesFailed: "Some map tiles couldn't load. Your measurement isn't affected.",
    loading: "Loading map…",
    unsupported: "This device can't display the map, but measuring still works.",
  },
  recovery: {
    title: "Continue your measurement?",
    body: (points: number) =>
      `A measurement with ${points.toLocaleString("en-US")} points was found on this device.`,
    resume: "Continue Measurement",
    discard: "Discard It",
    restoredPaused:
      "Measurement restored and paused. Tap Resume when you're back at the last point.",
  },
  newMeasurement: {
    title: "Start a new measurement?",
    body: "The current measurement will be replaced and you haven't downloaded it yet.",
    bodyDownloaded: "The current measurement will be replaced.",
    confirm: "Replace Measurement",
  },
  install: {
    title: "Install FieldMeasure",
    description:
      "Add it to your home screen to open it like an app. After your first visit, it can also open without internet.",
    installNow: "Install App",
    notNow: "Not Now",
    ios: [
      "Open this page in Safari.",
      "Tap the Share button.",
      "Choose Add to Home Screen.",
      "Tap Add.",
    ],
    android: [
      "Open this page in Chrome.",
      "Tap the ⋮ menu.",
      "Choose Install app or Add to Home screen.",
    ],
  },
  update: {
    available: "A new version of FieldMeasure is ready.",
    action: "Update",
  },
  storageFailed:
    "Recovery storage is full or blocked. Your measurement continues, but won't survive a page reload.",
  report: {
    heading: "Land Measurement Report",
    totalArea: "Total area",
    perimeter: "Perimeter",
    method: "Method",
    gpsConditions: "GPS conditions",
    measured: "Measured",
    plainMap: "Map imagery unavailable. Boundary shown to scale.",
    north: "N",
    meters: "Meters",
    kilometers: "Kilometers",
  },
  errorBoundary: {
    title: "Something went wrong",
    body: "Your measurement is stored on this device. Reload to try restoring it.",
    reload: "Reload",
  },
  offline: "You're offline. Measuring still works, but map imagery may not load.",
};

export type Messages = typeof en;
