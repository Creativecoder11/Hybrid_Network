"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Layers, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";

// Ambient type declarations for Google Maps JavaScript API
declare global {
  interface Window {
    google?: any;
  }
  namespace google {
    namespace maps {
      type MapTypeStyle = {
        elementType?: string;
        featureType?: string;
        stylers: Record<string, string | number | boolean>[];
      };
      enum MapTypeId {
        ROADMAP = "roadmap",
        SATELLITE = "satellite",
        HYBRID = "hybrid",
        TERRAIN = "terrain",
      }
      enum SymbolPath {
        CIRCLE = 0,
        FORWARD_CLOSED_ARROW = 1,
        FORWARD_OPEN_ARROW = 2,
        BACKWARD_CLOSED_ARROW = 3,
        BACKWARD_OPEN_ARROW = 4,
      }
      class Point {
        constructor(x: number, y: number);
      }
      class LatLngBounds {
        extend(latLng: { lat: number; lng: number }): LatLngBounds;
      }
      class InfoWindow {
        constructor(opts?: Record<string, unknown>);
        setContent(content: string | Element): void;
        open(map: Map, anchor?: Marker): void;
        close(): void;
      }
      class Marker {
        constructor(opts?: Record<string, unknown>);
        setMap(map: Map | null): void;
        addListener(event: string, handler: () => void): void;
      }
      class Polyline {
        constructor(opts?: Record<string, unknown>);
        setMap(map: Map | null): void;
      }
      class Map {
        constructor(el: HTMLElement, opts?: Record<string, unknown>);
        setCenter(latLng: { lat: number; lng: number }): void;
        setZoom(zoom: number): void;
        fitBounds(bounds: LatLngBounds, padding?: number | Record<string, number>): void;
        setMapTypeId(type: MapTypeId | string): void;
        setOptions(opts: Record<string, unknown>): void;
      }
    }
  }
}

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  online?: boolean;
};

export type TrailPoint = {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
};

const HEIGHT = 420;

// Dark theme map styling matching Hybrid Networks dark palette
const GOOGLE_MAPS_DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#141A22" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#141A22" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9CA3AF" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#E5E7EB" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9CA3AF" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#122820" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#34D399" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#232D3B" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1A222C" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9CA3AF" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2E3B4E" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1F2937" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1E293B" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0B111A" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#60A5FA" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#0B111A" }],
  },
];

let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    // Check if already in document
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      if (window.google?.maps) {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", (e) => reject(e));
      }
      return;
    }

    const script = document.createElement("script");
    const keyQuery = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?v=weekly${keyQuery}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => {
      googleMapsScriptPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

export function LocationMap({
  points,
  trail = [],
  selectedId,
  onSelectPoint,
  height = HEIGHT,
}: {
  points: MapPoint[];
  trail?: TrailPoint[];
  selectedId?: string;
  onSelectPoint?: (id: string) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const trailPolylineRef = useRef<google.maps.Polyline | null>(null);
  const trailMarkersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<"dark" | "satellite">("dark");

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // Load Google Maps API script
  useEffect(() => {
    let mounted = true;
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (mounted) setMapLoaded(true);
      })
      .catch((err) => {
        if (mounted) {
          console.error("Google Maps load error:", err);
          setLoadError("Unable to load Google Maps.");
        }
      });
    return () => {
      mounted = false;
    };
  }, [apiKey]);

  // Initialize Map
  useEffect(() => {
    if (!mapLoaded || !containerRef.current || mapInstanceRef.current) return;

    const firstPoint = points[0] || trail[0];
    const initialCenter = firstPoint
      ? { lat: firstPoint.latitude, lng: firstPoint.longitude }
      : { lat: 3.139, lng: 101.6869 }; // Default center

    const map = new google.maps.Map(containerRef.current, {
      center: initialCenter,
      zoom: points.length === 1 ? 12 : 5,
      mapTypeId: mapType === "satellite" ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP,
      styles: mapType === "dark" ? GOOGLE_MAPS_DARK_STYLE : undefined,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      backgroundColor: "#141A22",
    });

    infoWindowRef.current = new google.maps.InfoWindow({
      pixelOffset: new google.maps.Point(0, -16),
    });
    mapInstanceRef.current = map;
  }, [mapLoaded, mapType, points, trail]);

  // Update map style when mapType changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (mapType === "satellite") {
      mapInstanceRef.current.setMapTypeId(google.maps.MapTypeId.HYBRID);
      mapInstanceRef.current.setOptions({ styles: undefined });
    } else {
      mapInstanceRef.current.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      mapInstanceRef.current.setOptions({ styles: GOOGLE_MAPS_DARK_STYLE });
    }
  }, [mapType]);

  const openInfoWindow = useCallback(
    (point: MapPoint, marker: google.maps.Marker) => {
      if (!infoWindowRef.current || !mapInstanceRef.current) return;
      const isOnline = point.online !== false;
      const statusColor = isOnline ? "#00CF90" : "#9CA3AF";
      const statusBg = isOnline ? "rgba(0, 207, 144, 0.15)" : "rgba(156, 163, 175, 0.15)";
      const statusBorder = isOnline ? "rgba(0, 207, 144, 0.35)" : "rgba(156, 163, 175, 0.35)";
      const statusText = isOnline ? "ONLINE" : "OFFLINE";

      const content = `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #F9FAFB; padding: 2px 4px; min-width: 190px; user-select: none;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <span style="font-weight: 700; font-size: 14px; color: #00CF90; letter-spacing: 0.3px;">${point.label}</span>
            <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: ${statusBg}; color: ${statusColor}; padding: 2px 7px; border-radius: 9999px; border: 1px solid ${statusBorder};">
              <span style="display:inline-block; width: 5px; height: 5px; border-radius: 50%; background: ${statusColor};"></span>
              ${statusText}
            </span>
          </div>
          <div style="font-size: 11px; color: #9CA3AF; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: rgba(255,255,255,0.06); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 8px;">
            ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; color: #60A5FA; font-weight: 500;">
            <span>Click to select</span>
            <span style="color: #6B7280; font-size: 10px;">GPS Fix</span>
          </div>
        </div>
      `;

      infoWindowRef.current.setContent(content);
      infoWindowRef.current.open(mapInstanceRef.current, marker);
    },
    []
  );

  // Render Markers and Trails
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    // Clear old trail
    if (trailPolylineRef.current) {
      trailPolylineRef.current.setMap(null);
      trailPolylineRef.current = null;
    }
    trailMarkersRef.current.forEach((m) => m.setMap(null));
    trailMarkersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Plot Points (Terminals)
    points.forEach((p) => {
      const isSelected = selectedId === p.id;
      const color = p.online !== false ? "#00CF90" : "#6B7280";

      const marker = new google.maps.Marker({
        position: { lat: p.latitude, lng: p.longitude },
        map,
        title: p.label,
        zIndex: isSelected ? 100 : 10,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: color,
          fillOpacity: 1,
          strokeColor: isSelected ? "#FFFFFF" : "#0B0F14",
          strokeWeight: isSelected ? 2.5 : 1.5,
          scale: isSelected ? 1.8 : 1.4,
          anchor: new google.maps.Point(12, 22),
        },
      });

      marker.addListener("click", () => {
        onSelectPoint?.(p.id);
        openInfoWindow(p, marker);
      });

      if (isSelected) {
        openInfoWindow(p, marker);
      }

      markersRef.current.set(p.id, marker);
      bounds.extend({ lat: p.latitude, lng: p.longitude });
      hasPoints = true;
    });

    // Plot History Trail
    if (trail.length > 0) {
      const sortedTrail = [...trail].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const pathCoordinates = sortedTrail.map((t) => ({ lat: t.latitude, lng: t.longitude }));

      const polyline = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map,
      });
      trailPolylineRef.current = polyline;

      // Small dots on historical points
      sortedTrail.forEach((tp) => {
        const dotMarker = new google.maps.Marker({
          position: { lat: tp.latitude, lng: tp.longitude },
          map,
          title: formatDateTime(tp.timestamp),
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 3,
            fillColor: "#3B82F6",
            fillOpacity: 0.9,
            strokeColor: "#1E3A8A",
            strokeWeight: 1,
          },
        });
        trailMarkersRef.current.push(dotMarker);
        bounds.extend({ lat: tp.latitude, lng: tp.longitude });
        hasPoints = true;
      });
    }

    // Auto fit bounds
    if (hasPoints) {
      if (points.length === 1 && trail.length === 0) {
        map.setCenter({ lat: points[0].latitude, lng: points[0].longitude });
        map.setZoom(13);
      } else {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }
    }
  }, [mapLoaded, points, trail, selectedId, onSelectPoint, openInfoWindow]);

  if (points.length === 0 && trail.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line text-xs text-text-muted">
        No coordinates to plot on Google Maps.
      </div>
    );
  }

  const primaryPoint = points.find((p) => p.id === selectedId) || points[0] || trail[0];
  const googleMapsExternalUrl = primaryPoint
    ? `https://www.google.com/maps?q=${primaryPoint.latitude},${primaryPoint.longitude}`
    : "https://maps.google.com";

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface-raised">
      {/* Dark Theme Google Maps InfoWindow Overrides */}
      <style>{`
        .gm-style .gm-style-iw-c {
          background-color: #111827 !important;
          border: 1px solid #374151 !important;
          border-radius: 12px !important;
          padding: 10px 14px !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7) !important;
        }
        .gm-style .gm-style-iw-tc::after {
          background-color: #111827 !important;
          box-shadow: -2px 2px 2px rgba(0, 0, 0, 0.4) !important;
        }
        .gm-style .gm-style-iw-d {
          overflow: hidden !important;
          padding: 0 !important;
          max-height: none !important;
        }
        .gm-style .gm-ui-hover-effect {
          top: 6px !important;
          right: 6px !important;
          filter: invert(1) brightness(2) !important;
          opacity: 0.65 !important;
          border-radius: 50% !important;
          transition: opacity 0.15s ease !important;
        }
        .gm-style .gm-ui-hover-effect:hover {
          opacity: 1 !important;
          background: rgba(255, 255, 255, 0.1) !important;
        }
      `}</style>

      {/* Map Control Bar */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-line bg-surface/90 p-1 backdrop-blur-md shadow-lg">
        <button
          type="button"
          onClick={() => setMapType("dark")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            mapType === "dark" ? "bg-accent-green text-surface-dark font-semibold" : "text-text-secondary hover:text-text-primary"
          )}
        >
          <Layers className="size-3.5" />
          Dark Map
        </button>
        <button
          type="button"
          onClick={() => setMapType("satellite")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            mapType === "satellite" ? "bg-accent-green text-surface-dark font-semibold" : "text-text-secondary hover:text-text-primary"
          )}
        >
          <Layers className="size-3.5" />
          Satellite
        </button>
        <a
          href={googleMapsExternalUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:text-accent-blue transition-colors"
          title="Open in Google Maps"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {/* Map Container */}
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full bg-[#141A22] transition-opacity duration-300"
      >
        {!mapLoaded && !loadError && (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="size-4 animate-spin text-accent-green" />
            Loading Google Maps...
          </div>
        )}
        {loadError && (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <MapPin className="size-8 text-amber mb-2" />
            <p className="text-sm font-semibold text-text-primary">Google Maps</p>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              Coordinates: {primaryPoint ? `${primaryPoint.latitude.toFixed(5)}, ${primaryPoint.longitude.toFixed(5)}` : "Available"}
            </p>
            <a
              href={googleMapsExternalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-green px-3 py-1.5 text-xs font-semibold text-surface-dark"
            >
              Open in Google Maps
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-[11px] text-text-muted bg-surface-raised">
        <MapPin className="size-3 text-accent-green" />
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-accent-green" /> Online Terminal
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-text-muted" /> Offline Terminal
        </span>
        {trail.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-accent-blue" /> GPS History Trail
          </span>
        )}
        <span className="ml-auto font-medium text-text-secondary flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-accent-green animate-pulse" /> Google Maps Live
        </span>
      </div>
    </div>
  );
}

