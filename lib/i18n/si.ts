import type { Messages } from "./en";

/**
 * Written for everyday readers rather than translated word for word. English
 * phone menu names (Share, Add to Home Screen) are kept, since that is what
 * people see on their screens. Measurements read number-first, as they do on the
 * English screens; full sentences use the natural unit-first order.
 */
export const si: Messages = {
  intlLocale: "si-LK",
  reportTextScale: 0.94,
  appTagline: "ඇවිද ගොස් ඉඩම මනින්න.",
  common: {
    cancel: "අවලංගු කරන්න",
    close: "වසන්න",
    back: "ආපසු",
    undo: "අහෝසි",
    reset: "මුල් තත්ත්වයට",
    dismiss: "ඉවත් කරන්න",
    area: "වර්ගඵලය",
    perimeter: "වට ප්‍රමාණය",
  },
  header: { settings: "සැකසුම්", language: "භාෂාව" },
  gps: {
    signal: {
      off: "GPS: අක්‍රියයි",
      searching: "GPS: සොයමින්…",
      good: "GPS: හොඳයි",
      moderate: "GPS: සාමාන්‍යයි",
      poor: "GPS: දුර්වලයි",
      denied: "GPS: අවහිරයි",
      unavailable: "GPS: නොලැබේ",
    },
    accuracy: (meters) => `නිරවද්‍යතාව ±${meters} මී.`,
    accuracyHelp:
      "මෙය ඔබේ උපාංගය තමන්ම ගණන් බලා දක්වන නිරවද්‍යතාවයි. මිනුමේ දෝෂය මීට වඩා වැඩි නොවන බවට මෙය සහතිකයක් නොවේ.",
    errors: {
      "permission-denied":
        "ස්ථානය බැලීමේ අවසරය අවහිර කර ඇත. බ්‍රවුසරයේ සැකසුම්වලින් මෙම වෙබ් අඩවියට Location අවසරය දී නැවත උත්සාහ කරන්න.",
      "position-unavailable":
        "ඔබේ උපාංගයට දැන් ස්ථානය ලබාගත නොහැක. Location සේවාව ක්‍රියාත්මකදැයි බලා, අහස හොඳින් පෙනෙන තැනකට යන්න.",
      timeout: "තවමත් GPS සංඥාව සොයමින් සිටී. අහස හොඳින් පෙනෙන තැනකට ගියහොත් බොහෝ විට සංඥාව ලැබේ.",
      unsupported: "මෙම බ්‍රවුසරය GPS සඳහා සහාය නොදක්වයි. එහෙත් සිතියමේ කොන් ලකුණු කළ හැක.",
      "insecure-context":
        "GPS ක්‍රියා කිරීමට ආරක්ෂිත (https) සම්බන්ධතාවක් අවශ්‍යයි. https ලිපිනයෙන් යෙදුම විවෘත කරන්න.",
    },
    quality: {
      good: "හොඳ තත්ත්වයක්",
      moderate: "සාමාන්‍ය තත්ත්වයක්",
      poor: "දුර්වල තත්ත්වයක්",
      unavailable: "GPS භාවිත කර නැත",
    },
  },
  ready: {
    title: "මැනීමට සූදානම්ද?",
    description: "ඔබේ ඉඩමේ මායිමකින් පටන්ගෙන, මායිම දිගේ වටේටම ඇවිදින්න.",
    start: "මැනීම අරඹන්න",
    startWeak: "කෙසේ හෝ අරඹන්න (GPS දුර්වලයි)",
    findLocation: "මගේ ස්ථානය සොයන්න",
    searching: "ඔබේ ස්ථානය සොයමින්…",
    searchingDetail: "අහස හොඳින් පෙනෙන එළිමහන් තැනක සිටින්න.",
    manual: "අතින් කොන් ලකුණු කරන්න",
    tryAgain: "නැවත උත්සාහ කරන්න",
    markOnMap: "සිතියමේ කොන් ලකුණු කරන්න",
    errorTitle: "GPS ලබාගත නොහැක",
    tempWarning:
      "මනින අතරතුර මෙම යෙදුම විවෘතව තබාගන්න. මිනුම් තාවකාලිකව පමණක් ගබඩා වන නිසා, පිටවීමට පෙර ප්‍රතිඵලය බාගත කරගන්න.",
  },
  recording: {
    recording: "මනිමින්…",
    paused: "නවතා ඇත",
    pauseLabel: "මැනීම තාවකාලිකව නවත්වන්න",
    resumeLabel: "මැනීම දිගටම කරන්න",
    liveArea: "දැනට වර්ගඵලය (ආසන්න)",
    walked: "ඇවිද ඇත",
    points: "ලකුණු",
    pause: "නවත්වන්න",
    resume: "දිගටම කරන්න",
    finish: "අවසන්",
    markCorner: "කොන ලකුණු කරන්න",
    manualHint: 'එක් එක් කොනේ සිට "කොන ලකුණු කරන්න" ඔබන්න, නැතහොත් සිතියම මත ඔබා කොනක් යොදන්න.',
    pausedHint: "මැනීම නවතා ඇත. දැන් ලකුණු සටහන් නොවේ. දිගටම කිරීමට පෙර ඔබ නැවැත්වූ තැනට යන්න.",
    undoPoint: "අවසන් ලකුණ ඉවත් කරන්න",
    cornerMarked: "කොන ලකුණු කළා",
    cornerNoFix: "තවම මෑත GPS ස්ථානයක් නැත. සංඥාව ලැබෙන තුරු සිට, ඉන්පසු කොන ලකුණු කරන්න.",
    hiddenWarning:
      "යෙදුම පසුබිමට ගිය නිසා, ඇවිදීමේ එම කොටස GPS මගින් සටහන් නොවන්නට ඇත. අවසන් කළ විට මායිම පරීක්ෂා කරන්න.",
  },
  review: {
    title: "මායිම පරීක්ෂාව",
    fineTune: "මායිම නිවැරදි කරන්න",
    fineTuneDetail:
      "ලකුණු ඇදගෙන ගොස් වෙනස් කරන්න. වර්ගඵලය හා වට ප්‍රමාණය ස්වයංක්‍රීයව යාවත්කාලීන වේ.",
    addPoint: "ලකුණක් දමන්න",
    addPointActive: "මායිම අසල ඔබන්න",
    removePoint: "ලකුණ මකන්න",
    confirm: "තහවුරු කරන්න",
    fixCrossings: "හරස් වන කොටස් ඉවත් කරන්න",
    fixedCrossings: (area) =>
      `හරස් වන කොටස් ඉවත් කළා. වර්ගඵලය දැන් ${area}. ආපසු ගැනීමට "අහෝසි" ඔබන්න.`,
    issues: {
      "invalid-coordinate": "මෙම මායිමේ වැරදි ස්ථානයක් තිබේ.",
      "too-few-points": "මායිමකට වෙනස් ලකුණු අවම වශයෙන් 3ක් අවශ්‍යයි.",
      "self-intersection":
        "රතු ලකුණු ඇති තැන්වල මායිම තමන්ම හරස් කරයි. තහවුරු කිරීමට පෙර ලකුණු වෙනස් කරන්න, නැතහොත් හරස් වන කොටස් ඉවත් කරන්න.",
      degenerate: "මෙම මායිම වර්ගඵලයක් මැනීමට තරම් විශාල හෝ පළල නැත.",
    },
    edited: "වෙනස් කළා",
    discardEditsTitle: "ඔබ කළ වෙනස්කම් ඉවත් කරන්නද?",
    discardEditsBody: "මැනීමට ආපසු ගියහොත්, මායිමට ඔබ කළ වෙනස්කම් ඉවත් වේ.",
    discardEdits: "වෙනස්කම් ඉවත් කරන්න",
  },
  closure: {
    title: "මායිම සම්බන්ධ කරන්නද?",
    body: (meters) =>
      `ඔබේ අවසන් ලකුණ පටන්ගත් තැනට මීටර ${meters}ක් දුරින් තිබේ. ඒවා සම්බන්ධ කළහොත් ඔබ නොඇවිදි සරල රේඛාවක් එක් වන අතර, එය ඔබේ මායිමට නොගැළපෙන්නට පුළුවන.`,
    keepWalking: "දිගටම ඇවිදින්න",
    connect: "සරල රේඛාවකින් සම්බන්ධ කරන්න",
  },
  tooFewPoints: {
    title: "තවම ලකුණු මදි",
    body: "මායිමකට වෙනස් ලකුණු අවම වශයෙන් 3ක් අවශ්‍යයි. දිගටම මනින්න, නැතහොත් මෙම මිනුම ඉවත් කරන්න.",
    keepMeasuring: "දිගටම මනින්න",
    discard: "මිනුම ඉවත් කරන්න",
  },
  result: {
    title: "මිනුම් ප්‍රතිඵලය",
    measuredOn: "මැනූ දිනය",
    gpsQuality: "GPS තත්ත්වය",
    medianAccuracy: (meters) => `සාමාන්‍යයෙන් දැක්වූ නිරවද්‍යතාව ±${meters} මී.`,
    method: "ක්‍රමය",
    points: "මායිම් ලකුණු",
    recordedFixes: (count) => `GPS කියවීම් ${count.toLocaleString("en-US")}`,
    edited: "අතින් නිවැරදි කළා",
    notes: "මෙම මිනුම ගැන සටහන්",
    download: "ප්‍රතිඵලය බාගන්න (PNG)",
    downloading: "රූපය සකසමින්…",
    downloaded: "රූපය සුරැකුණා. Downloads බලන්න.",
    shared: "රූපය බෙදාගැනීමට හෝ සුරැකීමට සූදානම්.",
    exportFailed: "රූපය සෑදිය නොහැකි විය. වෙනත් යෙදුම් වසා නැවත උත්සාහ කරන්න.",
    editBoundary: "මායිම වෙනස් කරන්න",
    newMeasurement: "නව මිනුමක්",
    methods: {
      "gps-walk": "GPS සමඟ ඇවිදීමෙන්",
      "gps-corners": "GPS මගින් කොන් ලකුණු කිරීමෙන්",
      "map-placed": "සිතියමේ ලකුණු කිරීමෙන්",
      "mixed-manual": "GPS හා සිතියම මගින් කොන් ලකුණු කිරීමෙන්",
    },
    disclaimer:
      "මෙම මිනුම් උපාංගයේ GPS මත පදනම් වූ ඇස්තමේන්තු පමණි. ඒවා වෘත්තීය ඉඩම් මිනින්දෝරු මිනුමකට ආදේශකයක් නොවේ.",
  },
  warnings: {
    "weak-start": () => "මැනීම ඇරඹූ විට GPS සංඥාව දුර්වල විය.",
    "long-gap": (meters, count) =>
      `GPS සම්බන්ධතාව ${count} වරක් නැති විය${meters ? ` (දිගම හිඩැස මීටර ${meters})` : ""}. ඒ නිසා සටහන් නොවූ සරල රේඛා තිබේ.`,
    background: (_meters, count) => `මැනීම අතරතුර යෙදුම ${count} වරක් පසුබිමට ගියේය.`,
    "closing-gap": (meters) =>
      `ඔබ නොඇවිදි මීටර ${meters ?? "?"}ක සරල රේඛාවකින් මායිම සම්බන්ධ කර ඇත.`,
    "paused-gap": (meters) =>
      `නවතා තිබූ විට ඔබ මීටර ${meters ?? "?"}ක් ගියේය. එම කොටස සරල රේඛාවකි.`,
    "poor-corner": () => "අවම වශයෙන් එක් කොනක් හෝ දුර්වල GPS සංඥාවකින් ලකුණු කර ඇත.",
    "storage-unavailable": () => "මෙම සැසියේ කොටසක් තුළ දත්ත නැවත ලබාගැනීමේ ගබඩාව ක්‍රියා කළේ නැත.",
  },
  units: {
    acres: { long: "අක්කර", short: "අක්.", label: "අක්කර" },
    squareMeters: { long: "වර්ග මීටර", short: "m²", label: "වර්ග මීටර" },
    hectares: { long: "හෙක්ටයාර", short: "හෙක්.", label: "හෙක්ටයාර" },
    squareKilometers: { long: "වර්ග කි.මී.", short: "km²", label: "වර්ග කිලෝමීටර" },
    perches: { long: "පර්චස්", short: "පර්.", label: "පර්චස්" },
    squareFeet: { long: "වර්ග අඩි", short: "වර්ග අඩි", label: "වර්ග අඩි" },
  },
  length: { meters: "මී.", kilometers: "කි.මී." },
  settings: {
    title: "සැකසුම්",
    areaUnit: "ප්‍රධාන වර්ගඵල ඒකකය",
    session: "මෙම මිනුම",
    sessionWarning:
      "ඔබේ මිනුම මෙම උපාංගයේ තාවකාලිකව ගබඩා කර ඇත. යෙදුම වැසීමට පෙර ප්‍රතිඵලය බාගත කරගන්න. සැසිය අවසන් වූ විට දත්ත නැති වන්නට පුළුවන.",
    clear: "සැසිය මකන්න",
    clearTitle: "මෙම සැසිය මකන්නද?",
    clearBody: "මෙයින් වත්මන් මිනුම මෙම උපාංගයෙන් මැකේ. එය ආපසු ගත නොහැක.",
    aboutTitle: "නිරවද්‍යතාව ගැන",
    about:
      "ප්‍රතිඵල ඔබේ දුරකථනයේ GPS මගින් ලබාගන්නා ඇස්තමේන්තු වේ. නිරවද්‍යතාව ඔබේ උපාංගය, අහස පෙනෙන ආකාරය සහ ඔබ මායිම කෙතරම් හරියට අනුගමනය කරනවාද යන්න මත රඳා පවතී. වර්ගඵලය ගණනය කරන්නේ WGS84 පෘථිවි ආකෘතියෙනි.",
    install: "යෙදුම ස්ථාපනය කරන්න",
    installAndroid: "Android: Chrome හි ⋮ මෙනුව විවෘත කර Install app හෝ Add to Home screen තෝරන්න.",
    installIos: "iPhone සහ iPad: Safari හි Share ඔබා Add to Home Screen තෝරන්න.",
    cleared: "සැසිය මැකුවා",
    copyright: "ප්‍රකාශන හිමිකම © 2026. සියලු හිමිකම් ඇවිරිණි.",
    credit: "නිර්මාණය හා සංවර්ධනය:",
    creditName: "Sandeepa Mallawarachchi",
    creditUrl: "https://www.linkedin.com/in/sandeepa-mallawarachchi",
  },
  map: {
    layers: "සිතියම් වර්ගය වෙනස් කරන්න",
    locate: "මගේ ස්ථානයට යන්න",
    zoomIn: "විශාල කරන්න",
    zoomOut: "කුඩා කරන්න",
    fit: "මුළු මායිමම පෙන්වන්න",
    styles: {
      satellite: "චන්ද්‍රිකා සිතියම",
      street: "මාර්ග සිතියම",
      plain: "සරල (අන්තර්ජාලය අවශ්‍ය නැත)",
    },
    styleFailed: "එම සිතියම පූරණය නොවූ නිසා සරල දර්ශනය පෙන්වයි. ඔබේ මිනුමට බලපෑමක් නැත.",
    tilesFailed: "සිතියමේ කොටස් කිහිපයක් පූරණය නොවීය. ඔබේ මිනුමට බලපෑමක් නැත.",
    loading: "සිතියම පූරණය වෙමින්…",
    unsupported: "මෙම උපාංගයේ සිතියම පෙන්විය නොහැක, නමුත් මැනීම කළ හැක.",
  },
  recovery: {
    title: "ඔබේ මිනුම දිගටම කරන්නද?",
    body: (points) => `ලකුණු ${points.toLocaleString("en-US")}ක් සහිත මිනුමක් මෙම උපාංගයේ හමු විය.`,
    resume: "මිනුම දිගටම කරන්න",
    discard: "එය ඉවත් කරන්න",
    restoredPaused: 'මිනුම නැවත ලැබුණා, දැනට නවතා ඇත. අවසන් ලකුණට ගිය පසු "දිගටම කරන්න" ඔබන්න.',
  },
  newMeasurement: {
    title: "නව මිනුමක් අරඹන්නද?",
    body: "වත්මන් මිනුම ඉවත් වන අතර, ඔබ එය තවම බාගත කර නැත.",
    bodyDownloaded: "වත්මන් මිනුම ඉවත් වේ.",
    confirm: "නව මිනුම අරඹන්න",
  },
  install: {
    title: "FieldMeasure ස්ථාපනය කරන්න",
    description:
      "මුල් තිරයට එක් කළ විට යෙදුමක් ලෙස විවෘත කළ හැක. පළමු වරින් පසු අන්තර්ජාලය නැතිවත් විවෘත කළ හැක.",
    installNow: "යෙදුම ස්ථාපනය කරන්න",
    notNow: "දැන් නොවේ",
    ios: [
      "මෙම පිටුව Safari හි විවෘත කරන්න.",
      "Share බොත්තම ඔබන්න.",
      "Add to Home Screen තෝරන්න.",
      "Add ඔබන්න.",
    ],
    android: [
      "මෙම පිටුව Chrome හි විවෘත කරන්න.",
      "⋮ මෙනුව ඔබන්න.",
      "Install app හෝ Add to Home screen තෝරන්න.",
    ],
  },
  update: {
    available: "FieldMeasure හි නව අනුවාදයක් සූදානම්.",
    action: "යාවත්කාලීන කරන්න",
  },
  storageFailed:
    "දත්ත ගබඩාව පිරී හෝ අවහිර වී ඇත. මැනීම දිගටම කළ හැකි නමුත්, පිටුව නැවත පූරණය කළහොත් මිනුම නැති වේ.",
  report: {
    heading: "ඉඩම් මිනුම් වාර්තාව",
    totalArea: "මුළු වර්ගඵලය",
    perimeter: "වට ප්‍රමාණය",
    method: "ක්‍රමය",
    gpsConditions: "GPS තත්ත්වය",
    measured: "මැනූ දිනය",
    plainMap: "සිතියම් රූප නොමැත. මායිම පරිමාණයට පෙන්වා ඇත.",
    reportedAccuracy: (quality, meters) => `${quality} (දැක්වූ නිරවද්‍යතාව ±${meters} මී.)`,
    north: "උ",
    meters: "මීටර",
    kilometers: "කිලෝමීටර",
  },
  errorBoundary: {
    title: "යම් දෝෂයක් සිදු විය",
    body: "ඔබේ මිනුම මෙම උපාංගයේ ගබඩා වී ඇත. එය නැවත ලබාගැනීමට පිටුව නැවත පූරණය කරන්න.",
    reload: "නැවත පූරණය කරන්න",
  },
  offline: "ඔබ අන්තර්ජාලයට සම්බන්ධ නැත. මැනීම කළ හැකි නමුත් සිතියම් රූප පූරණය නොවන්නට පුළුවන.",
};
