import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
  type MapTouchEvent,
  type PaddingOptions,
} from "maplibre-gl";
import { formatArea } from "@/lib/geometry/conversions";
import { measureGeodesicPolygon } from "@/lib/geometry/geodesy";
import { t } from "@/lib/i18n";
import { selectBoundaryMetrics, selectBoundaryPoints } from "@/lib/measurement/selectors";
import { showToast } from "@/lib/toast";
import { createId } from "@/lib/utils";
import type { MeasurementStore } from "@/store/measurementStore";
import type { MapStyleId } from "@/types/map";
import type { BoundaryPoint, LngLat, MeasurementState } from "@/types/measurement";
import {
  EMPTY_COLLECTION,
  boundsOf,
  centroidOf,
  circlePolygon,
  findNearestSegment,
  findNearestVertex,
  interpolate,
  lineCollection,
  pointCollection,
  pointsCollection,
  polygonCollection,
  vertexCollection,
  type Projector,
  type VertexKind,
} from "./mapHelpers";
import { PLAIN_MAP_STYLE, getStyleDefinition } from "./mapStyles";

const SOURCES = {
  accuracy: "fm-accuracy",
  boundary: "fm-boundary",
  route: "fm-route",
  vertices: "fm-vertices",
  position: "fm-position",
  crossings: "fm-crossings",
} as const;

const COLORS = {
  boundary: "#32D758",
  boundaryCasing: "#08752E",
  position: "#2563EB",
  crossing: "#DC2626",
  selected: "#F59E0B",
  start: "#08752E",
};

const DEFAULT_CENTER: LngLat = [80.7, 7.6]; // Sri Lanka: the view before any location is known.
const DEFAULT_ZOOM = 6.5;
const FOLLOW_ZOOM = 18;
const FIT_MAX_ZOOM = 21;
const STYLE_LOAD_TIMEOUT_MS = 8_000;
const VERTEX_HIT_RADIUS_PX = 24;
const EDGE_HIT_RADIUS_PX = 44;
const TILE_ERRORS_BEFORE_NOTICE = 6;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function fixPosition(state: MeasurementState): LngLat | null {
  return state.currentFix ? [state.currentFix.longitude, state.currentFix.latitude] : null;
}

function isBoundaryPhase(state: MeasurementState): boolean {
  return state.status === "reviewing" || state.status === "completed";
}

export class MapController {
  private readonly map: MapLibreMap;
  private readonly areaLabel: Marker;
  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribe: () => void;

  private frame: number | null = null;
  private styleTimer: ReturnType<typeof setTimeout> | null = null;
  private styleLoaded = false;
  private activeStyle: MapStyleId;
  private tileErrors = 0;
  private tileNoticeShown = false;

  private follow = true;
  private hasCenteredOnUser = false;
  private lastStatus: MeasurementState["status"] | null = null;
  private lastPoints: BoundaryPoint[] | null = null;
  private lastFix: MeasurementState["currentFix"] = null;
  private lastSelected: number | null = null;

  private dragIndex: number | null = null;
  private dragPreview: LngLat[] | null = null;
  private dragMoved = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly store: MeasurementStore,
  ) {
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const initial = store.getState();
    this.activeStyle = initial.mapStyle;

    this.map = new MapLibreMap({
      container,
      style: getStyleDefinition(initial.mapStyle),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    const label = document.createElement("div");
    label.className = "fm-area-label";
    this.areaLabel = new Marker({ element: label });

    this.watchStyleLoad();
    this.map.on("style.load", this.handleStyleLoad);
    this.map.on("error", this.handleMapError);
    this.map.on("dragstart", this.stopFollowing);
    this.map.on("click", this.handleClick);
    this.map.on("mousedown", this.handlePointerDown);
    this.map.on("touchstart", this.handlePointerDown);

    this.resizeObserver = new ResizeObserver(() => {
      this.map.resize();
      if (isBoundaryPhase(this.store.getState())) this.fitBoundary();
    });
    this.resizeObserver.observe(container);

    this.unsubscribe = store.subscribe(() => this.scheduleSync());
  }

  destroy(): void {
    this.unsubscribe();
    this.resizeObserver.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    if (this.styleTimer !== null) clearTimeout(this.styleTimer);
    this.detachDragListeners();
    this.areaLabel.remove();
    this.map.remove();
  }

  // Controls

  zoomIn(): void {
    this.map.zoomIn({ animate: !prefersReducedMotion() });
  }

  zoomOut(): void {
    this.map.zoomOut({ animate: !prefersReducedMotion() });
  }

  locate(): void {
    this.follow = true;
    const position = fixPosition(this.store.getState());
    if (position) this.flyTo(position);
  }

  fitBoundary(): void {
    const bounds = boundsOf(selectBoundaryMetrics(this.store.getState()).positions);
    if (!bounds) return;
    // fitBounds adds its padding to the padding left by following the user, which
    // would count the panels twice and push the boundary off-centre.
    this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    this.map.fitBounds(new LngLatBounds(bounds[0], bounds[1]), {
      padding: this.readPadding(),
      maxZoom: FIT_MAX_ZOOM,
      duration: prefersReducedMotion() ? 0 : 300,
    });
  }

  // Style handling

  private watchStyleLoad(): void {
    this.styleLoaded = false;
    if (this.styleTimer !== null) clearTimeout(this.styleTimer);
    this.styleTimer = setTimeout(() => {
      if (!this.styleLoaded) this.fallBackToPlain();
    }, STYLE_LOAD_TIMEOUT_MS);
  }

  private handleStyleLoad = (): void => {
    this.styleLoaded = true;
    if (this.styleTimer !== null) clearTimeout(this.styleTimer);
    this.tileErrors = 0;
    this.addOverlay();
    // setStyle discards sources, so everything is redrawn from state: the
    // measurement itself lives in the store and is unaffected by map changes.
    this.lastPoints = null;
    this.lastFix = null;
    this.sync();
  };

  private handleMapError = (event: object): void => {
    const { sourceId } = event as { sourceId?: string };
    if (!this.styleLoaded && !sourceId) {
      this.fallBackToPlain();
      return;
    }
    if (sourceId && !sourceId.startsWith("fm-")) {
      this.tileErrors += 1;
      if (this.tileErrors >= TILE_ERRORS_BEFORE_NOTICE && !this.tileNoticeShown) {
        this.tileNoticeShown = true;
        showToast({ message: t.map.tilesFailed, tone: "warning" });
      }
    }
  };

  private fallBackToPlain(): void {
    if (this.activeStyle === "plain") return;
    this.activeStyle = "plain";
    this.watchStyleLoad();
    this.map.setStyle(PLAIN_MAP_STYLE, { diff: false });
    this.store.dispatch({ type: "SET_MAP_STYLE", style: "plain" });
    showToast({ message: t.map.styleFailed, tone: "warning" });
  }

  private addOverlay(): void {
    const { map } = this;
    for (const id of Object.values(SOURCES)) {
      if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY_COLLECTION });
    }
    map.addLayer({
      id: "fm-accuracy-fill",
      type: "fill",
      source: SOURCES.accuracy,
      paint: { "fill-color": COLORS.position, "fill-opacity": 0.14 },
    });
    map.addLayer({
      id: "fm-accuracy-line",
      type: "line",
      source: SOURCES.accuracy,
      paint: { "line-color": COLORS.position, "line-opacity": 0.35, "line-width": 1 },
    });
    map.addLayer({
      id: "fm-boundary-fill",
      type: "fill",
      source: SOURCES.boundary,
      paint: { "fill-color": COLORS.boundary, "fill-opacity": 0.32 },
    });
    map.addLayer({
      id: "fm-route-casing",
      type: "line",
      source: SOURCES.route,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": COLORS.boundaryCasing, "line-width": 6, "line-opacity": 0.55 },
    });
    map.addLayer({
      id: "fm-route",
      type: "line",
      source: SOURCES.route,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": COLORS.boundary, "line-width": 3.5 },
    });
    map.addLayer({
      id: "fm-vertices",
      type: "circle",
      source: SOURCES.vertices,
      paint: {
        "circle-radius": ["match", ["get", "kind"], "start", 8, "selected", 10, "corner", 6, 4.5],
        "circle-color": [
          "match",
          ["get", "kind"],
          "start",
          COLORS.start,
          "selected",
          COLORS.selected,
          "#FFFFFF",
        ],
        "circle-stroke-color": [
          "match",
          ["get", "kind"],
          "start",
          "#FFFFFF",
          "selected",
          "#FFFFFF",
          COLORS.boundary,
        ],
        "circle-stroke-width": 2.5,
      },
    });
    map.addLayer({
      id: "fm-crossings",
      type: "circle",
      source: SOURCES.crossings,
      paint: {
        "circle-radius": 9,
        "circle-color": COLORS.crossing,
        "circle-stroke-color": "#FFFFFF",
        "circle-stroke-width": 2,
      },
    });
    map.addLayer({
      id: "fm-position",
      type: "circle",
      source: SOURCES.position,
      paint: {
        "circle-radius": 8,
        "circle-color": COLORS.position,
        "circle-stroke-color": "#FFFFFF",
        "circle-stroke-width": 3,
      },
    });
  }

  // Rendering

  /** Coalesces store updates into one redraw per frame. */
  private scheduleSync(): void {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.sync();
    });
  }

  private setData(id: string, data: GeoJSON.GeoJSON): void {
    (this.map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
  }

  private sync(): void {
    const state = this.store.getState();

    if (state.mapStyle !== this.activeStyle) {
      this.activeStyle = state.mapStyle;
      this.tileNoticeShown = false;
      this.watchStyleLoad();
      // Without diff:false MapLibre would diff away the overlay and could skip style.load.
      this.map.setStyle(getStyleDefinition(state.mapStyle), { diff: false });
      return;
    }
    if (!this.styleLoaded) return;

    const statusChanged = state.status !== this.lastStatus;
    const points = selectBoundaryPoints(state);
    if (
      statusChanged ||
      points !== this.lastPoints ||
      state.selectedVertex !== this.lastSelected ||
      this.dragPreview
    ) {
      this.renderBoundary(state, points);
      this.lastPoints = points;
      this.lastSelected = state.selectedVertex;
    }
    if (statusChanged || state.currentFix !== this.lastFix) {
      this.renderPosition(state);
      this.lastFix = state.currentFix;
    }
    if (statusChanged) {
      this.lastStatus = state.status;
      this.handleStatusChange(state);
    }
  }

  private renderBoundary(state: MeasurementState, points: BoundaryPoint[]): void {
    const metrics = selectBoundaryMetrics(state);
    const positions = this.dragPreview ?? metrics.positions;
    const boundaryPhase = isBoundaryPhase(state);
    const hasBoundary = boundaryPhase || state.status === "recording" || state.status === "paused";
    if (!hasBoundary) {
      this.setData(SOURCES.boundary, EMPTY_COLLECTION);
      this.setData(SOURCES.route, EMPTY_COLLECTION);
      this.setData(SOURCES.vertices, EMPTY_COLLECTION);
      this.setData(SOURCES.crossings, EMPTY_COLLECTION);
      this.areaLabel.remove();
      return;
    }

    this.setData(SOURCES.boundary, polygonCollection(positions));
    // While recording the line stays open: the closing segment hasn't been walked yet.
    this.setData(
      SOURCES.route,
      lineCollection(
        boundaryPhase && positions.length > 2 ? [...positions, positions[0]] : positions,
      ),
    );

    const kindOf = (index: number): VertexKind => {
      if (index === state.selectedVertex) return "selected";
      if (index === 0) return "start";
      return points[index]?.source === "gps-auto" ? "normal" : "corner";
    };
    const showVertices = state.status !== "completed";
    this.setData(
      SOURCES.vertices,
      showVertices ? vertexCollection(positions, kindOf) : EMPTY_COLLECTION,
    );
    this.setData(
      SOURCES.crossings,
      state.status === "reviewing" && !this.dragPreview
        ? pointsCollection(metrics.validation.crossings.map((crossing) => crossing.position))
        : EMPTY_COLLECTION,
    );

    const center = centroidOf(positions);
    if (state.status === "reviewing" && center && positions.length > 2) {
      const areaM2 = this.dragPreview ? measureGeodesicPolygon(positions).areaM2 : metrics.areaM2;
      this.areaLabel.getElement().textContent = `${formatArea(areaM2, state.areaUnit)} ${t.units[state.areaUnit].long}`;
      this.areaLabel.setLngLat(center);
      this.areaLabel.addTo(this.map);
    } else {
      this.areaLabel.remove();
    }
  }

  private renderPosition(state: MeasurementState): void {
    const position = fixPosition(state);
    if (!position || isBoundaryPhase(state) || state.status === "error") {
      this.setData(SOURCES.position, EMPTY_COLLECTION);
      this.setData(SOURCES.accuracy, EMPTY_COLLECTION);
      return;
    }
    this.setData(SOURCES.position, pointCollection(position));
    this.setData(SOURCES.accuracy, circlePolygon(position, state.currentFix?.accuracy ?? 0));

    if (!this.hasCenteredOnUser) {
      this.hasCenteredOnUser = true;
      this.map.jumpTo({ center: position, zoom: FOLLOW_ZOOM, padding: this.readPadding() });
    } else if (this.follow) {
      this.map.easeTo({
        center: position,
        padding: this.readPadding(),
        duration: prefersReducedMotion() ? 0 : 400,
      });
    }
  }

  private handleStatusChange(state: MeasurementState): void {
    if (isBoundaryPhase(state)) {
      this.follow = false;
      // Two frames so the panel for this status has been laid out before measuring.
      requestAnimationFrame(() => requestAnimationFrame(() => this.fitBoundary()));
      return;
    }
    if (state.status === "recording" || state.status === "paused") {
      const position = fixPosition(state);
      const bounds = boundsOf(selectBoundaryMetrics(state).positions);
      if (!position && bounds) {
        // Restored session: no fix yet, so show what was recorded.
        requestAnimationFrame(() => this.fitBoundary());
      } else if (state.status === "recording") {
        this.follow = true;
      }
    }
    if (state.status === "idle") {
      this.hasCenteredOnUser = false;
      this.follow = true;
    }
  }

  private flyTo(position: LngLat): void {
    this.map.easeTo({
      center: position,
      zoom: Math.max(this.map.getZoom(), FOLLOW_ZOOM - 1),
      padding: this.readPadding(),
      duration: prefersReducedMotion() ? 0 : 500,
    });
  }

  /** Keeps the subject of the map clear of whichever panels overlap it at this screen size. */
  private readPadding(): PaddingOptions {
    // The sides also keep the boundary clear of the map controls on phones.
    const margin = 32;
    const sideMargin = 68;
    const padding = { top: margin, bottom: margin, left: sideMargin, right: sideMargin };
    const frame = this.container.getBoundingClientRect();
    const panel = document.querySelector("[data-map-panel]")?.getBoundingClientRect();
    if (panel && panel.height > 0) {
      if (panel.width > frame.width * 0.7) {
        padding.bottom += Math.max(0, frame.bottom - panel.top);
      } else if (panel.left - frame.left < frame.right - panel.right) {
        padding.left += Math.max(0, panel.right - frame.left);
      } else {
        padding.right += Math.max(0, frame.right - panel.left);
      }
    }
    const topBar = document.querySelector("[data-map-topbar]")?.getBoundingClientRect();
    if (topBar) padding.top += Math.max(0, topBar.bottom - frame.top);
    // Very small viewports can't honour the padding; fitBounds would throw the map away.
    const maxVertical = frame.height * 0.8;
    const vertical = padding.top + padding.bottom;
    if (vertical > maxVertical) {
      padding.top *= maxVertical / vertical;
      padding.bottom *= maxVertical / vertical;
    }
    return padding;
  }

  // Interaction

  private stopFollowing = (event: { originalEvent?: unknown }): void => {
    if (event.originalEvent) this.follow = false;
  };

  private projector: Projector = (position) => this.map.project(position);

  private handleClick = (event: MapMouseEvent): void => {
    const state = this.store.getState();
    if (state.status === "recording" && state.mode === "manual") {
      this.store.dispatch({
        type: "ADD_MAP_POINT",
        id: createId("pt"),
        position: [event.lngLat.lng, event.lngLat.lat],
        now: Date.now(),
      });
      return;
    }
    if (state.status !== "reviewing") return;

    const { positions } = selectBoundaryMetrics(state);
    if (state.addPointMode) {
      const hit = findNearestSegment(positions, this.projector, event.point);
      if (!hit || hit.distancePx > EDGE_HIT_RADIUS_PX) return;
      this.store.dispatch({
        type: "EDIT_INSERT_VERTEX",
        afterIndex: hit.afterIndex,
        position: interpolate(
          positions[hit.afterIndex],
          positions[(hit.afterIndex + 1) % positions.length],
          hit.t,
        ),
        id: createId("pt"),
      });
      return;
    }
    this.store.dispatch({
      type: "SELECT_VERTEX",
      index: findNearestVertex(positions, this.projector, event.point, VERTEX_HIT_RADIUS_PX),
    });
  };

  private handlePointerDown = (event: MapMouseEvent | MapTouchEvent): void => {
    const state = this.store.getState();
    if (state.status !== "reviewing" || state.addPointMode) return;
    if ("points" in event && event.points.length !== 1) return; // Pinch zoom stays with the map.

    const { positions } = selectBoundaryMetrics(state);
    const index = findNearestVertex(positions, this.projector, event.point, VERTEX_HIT_RADIUS_PX);
    if (index === null) return;

    // Stops the map panning for this gesture, so the vertex moves instead.
    event.preventDefault();
    this.dragIndex = index;
    this.dragMoved = false;
    this.dragPreview = null;
    this.map.on("mousemove", this.handleDragMove);
    this.map.on("touchmove", this.handleDragMove);
    this.map.on("mouseup", this.handleDragEnd);
    this.map.on("touchend", this.handleDragEnd);
    this.map.on("touchcancel", this.handleDragEnd);
    this.store.dispatch({ type: "SELECT_VERTEX", index });
  };

  private handleDragMove = (event: MapMouseEvent | MapTouchEvent): void => {
    if (this.dragIndex === null) return;
    event.preventDefault();
    const state = this.store.getState();
    const preview = [...(this.dragPreview ?? selectBoundaryMetrics(state).positions)];
    preview[this.dragIndex] = [event.lngLat.lng, event.lngLat.lat];
    this.dragPreview = preview;
    this.dragMoved = true;
    this.scheduleSync();
  };

  private handleDragEnd = (): void => {
    const index = this.dragIndex;
    const preview = this.dragPreview;
    this.detachDragListeners();
    this.dragIndex = null;
    this.dragPreview = null;
    if (index !== null && this.dragMoved && preview) {
      // One history entry per drag, so Undo reverses a whole gesture.
      this.store.dispatch({
        type: "EDIT_MOVE_VERTEX",
        index,
        position: preview[index],
        id: createId("pt"),
      });
    }
    this.scheduleSync();
  };

  private detachDragListeners(): void {
    this.map.off("mousemove", this.handleDragMove);
    this.map.off("touchmove", this.handleDragMove);
    this.map.off("mouseup", this.handleDragEnd);
    this.map.off("touchend", this.handleDragEnd);
    this.map.off("touchcancel", this.handleDragEnd);
  }
}
