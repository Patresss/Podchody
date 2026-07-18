import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl, { LngLatBounds, type GeoJSONSource, type Map as MapLibreMap, type Marker } from "maplibre-gl";
import { versionedPhotoUrl } from "../lib/photo-url";
import type { Point } from "../types";

export type MapViewHandle = {
  capture: (includeRoute: boolean, orderedIdsOverride?: string[]) => Promise<string>;
  fit: () => void;
  focus: (pointId: string) => void;
};

type MapViewProps = {
  points: Point[];
  selectedIds?: Set<string>;
  orderedIds?: string[];
  editable?: boolean;
  onSelect?: (point: Point) => void;
  onMove?: (point: Point, latitude: number, longitude: number) => void;
  placingPoint?: Point | null;
  onPlace?: (point: Point, latitude: number, longitude: number) => void;
  className?: string;
};

const emptyCollection = { type: "FeatureCollection" as const, features: [] };

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({
  points,
  selectedIds = new Set<string>(),
  orderedIds = [],
  editable = false,
  onSelect,
  onMove,
  placingPoint = null,
  onPlace,
  className = "",
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new globalThis.Map<string, Marker>());
  const loadedRef = useRef(false);
  const lastFitKey = useRef("");
  const stateRef = useRef({ points, selectedIds, orderedIds, onSelect, onMove, placingPoint, onPlace });
  stateRef.current = { points, selectedIds, orderedIds, onSelect, onMove, placingPoint, onPlace };

  const locatedPoints = points.filter((point): point is Point & { latitude: number; longitude: number } => point.latitude != null && point.longitude != null);

  const fitMap = () => {
    const map = mapRef.current;
    const current = stateRef.current.points.filter((point): point is Point & { latitude: number; longitude: number } => point.latitude != null && point.longitude != null);
    if (!map || !current.length) return;
    if (current.length === 1) {
      map.easeTo({ center: [current[0]!.longitude, current[0]!.latitude], zoom: 17, duration: 350 });
      return;
    }
    const bounds = new LngLatBounds();
    current.forEach((point) => bounds.extend([point.longitude, point.latitude]));
    map.fitBounds(bounds, { padding: 72, maxZoom: 19, duration: 350 });
  };

  useImperativeHandle(ref, () => ({
    fit: fitMap,
    focus: (pointId) => {
      const map = mapRef.current;
      const point = stateRef.current.points.find((candidate) => candidate.id === pointId);
      if (!map || !point || point.latitude == null || point.longitude == null) return;
      map.easeTo({ center: [point.longitude, point.latitude], zoom: Math.max(map.getZoom(), 18.5), duration: 450 });
      markersRef.current.forEach((marker, id) => marker.getElement().classList.toggle("is-focused", id === pointId));
    },
    capture: async (includeRoute, orderedIdsOverride) => {
      const map = mapRef.current;
      const container = containerRef.current;
      if (!map || !container || !loadedRef.current) throw new Error("Mapa nie jest jeszcze gotowa.");
      const previousStyles = {
        width: container.style.width,
        height: container.style.height,
        minHeight: container.style.minHeight,
        maxWidth: container.style.maxWidth,
      };
      const routeVisibility = map.getLayer("route-line") ? map.getLayoutProperty("route-line", "visibility") : "visible";
      try {
        container.style.width = "1120px";
        container.style.height = "608px";
        container.style.minHeight = "608px";
        container.style.maxWidth = "none";
        map.resize();
        if (orderedIdsOverride) updateCanvasLayers(map, stateRef.current.points, orderedIdsOverride);
        if (map.getLayer("route-line")) {
          map.setLayoutProperty("route-line", "visibility", includeRoute ? "visible" : "none");
        }
        fitMap();
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(resolve, 2_000);
          map.once("idle", () => {
            window.clearTimeout(timeout);
            resolve();
          });
        });
        return map.getCanvas().toDataURL("image/png");
      } finally {
        if (map.getLayer("route-line")) map.setLayoutProperty("route-line", "visibility", routeVisibility ?? "visible");
        if (orderedIdsOverride) updateCanvasLayers(map, stateRef.current.points, stateRef.current.orderedIds);
        container.style.width = previousStyles.width;
        container.style.height = previousStyles.height;
        container.style.minHeight = previousStyles.minHeight;
        container.style.maxWidth = previousStyles.maxWidth;
        map.resize();
        fitMap();
      }
    },
  }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [19.94, 50.06],
      zoom: 13,
      maxZoom: 19,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("click", (event) => {
      const state = stateRef.current;
      if (state.placingPoint) state.onPlace?.(state.placingPoint, event.lngLat.lat, event.lngLat.lng);
    });
    map.on("load", () => {
      loadedRef.current = true;
      map.addSource("route-line-source", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route-line-source",
        paint: {
          "line-color": "#174f43",
          "line-width": 5,
          "line-opacity": 0.88,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addSource("route-points-source", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "route-point-halo",
        type: "circle",
        source: "route-points-source",
        paint: {
          "circle-radius": 12,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#174f43",
          "circle-stroke-width": 3,
        },
      });
      map.addLayer({
        id: "route-point-label",
        type: "symbol",
        source: "route-points-source",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#12362f" },
      });
      updateCanvasLayers(map, stateRef.current.points, stateRef.current.orderedIds);
      fitMap();
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    locatedPoints.forEach((point) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `photo-map-marker${selectedIds.has(point.id) ? " is-selected" : ""}`;
      const organizerLabel = point.displayName || point.originalFilename;
      element.setAttribute("aria-label", `Punkt ${organizerLabel}`);
      element.title = organizerLabel;
      const image = document.createElement("img");
      image.src = versionedPhotoUrl(point.previewUrl, point.createdAt);
      image.alt = "";
      element.append(image);
      const routeIndex = orderedIds.indexOf(point.id);
      if (routeIndex >= 0) {
        const badge = document.createElement("span");
        badge.textContent = String(routeIndex + 1);
        element.append(badge);
      }
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        stateRef.current.onSelect?.(point);
      });
      const marker = new maplibregl.Marker({ element, draggable: editable, anchor: "bottom-left" })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
      if (editable) {
        marker.on("dragend", () => {
          const position = marker.getLngLat();
          stateRef.current.onMove?.(point, position.lat, position.lng);
        });
      }
      markersRef.current.set(point.id, marker);
    });
    if (loadedRef.current) updateCanvasLayers(map, points, orderedIds);
    const fitKey = locatedPoints.map((point) => point.id).sort().join(",");
    if (fitKey && fitKey !== lastFitKey.current) {
      lastFitKey.current = fitKey;
      fitMap();
    }
  }, [points, selectedIds, orderedIds, editable]);

  if (!locatedPoints.length) {
    return (
      <div className={`map-shell map-empty ${className}`}>
        <div>
          <strong>Brak punktów na mapie</strong>
          <span>Dodaj zdjęcia z GPS albo ustaw współrzędne ręcznie.</span>
        </div>
      </div>
    );
  }

  return <div className={`map-shell ${placingPoint ? "is-placing " : ""}${className}`} ref={containerRef} aria-label="Interaktywna mapa punktów" />;
});

function updateCanvasLayers(map: MapLibreMap, points: Point[], orderedIds: string[]) {
  const located = points.filter((point): point is Point & { latitude: number; longitude: number } => point.latitude != null && point.longitude != null);
  const ordered = orderedIds.map((id) => located.find((point) => point.id === id)).filter((point): point is Point & { latitude: number; longitude: number } => Boolean(point));
  const pointFeatures = ordered.map((point, index) => ({
    type: "Feature" as const,
    properties: { label: String(index + 1) },
    geometry: { type: "Point" as const, coordinates: [point.longitude, point.latitude] },
  }));
  const lineFeatures = ordered.length > 1 ? [{
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: ordered.map((point) => [point.longitude, point.latitude]) },
  }] : [];
  (map.getSource("route-points-source") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: pointFeatures });
  (map.getSource("route-line-source") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: lineFeatures });
}
