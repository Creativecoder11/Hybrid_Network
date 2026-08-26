"use client";

// Dependency-free GPS visualization: an equirectangular lat/lon projection
// drawn as inline SVG (graticule + markers + optional history trail), auto-
// fit to whatever points are passed in. This is the "reusable map component"
// the terminal detail, tracking, and portal pages all render through.
//
// No tile-based map library (Leaflet/Mapbox/Google Maps) is wired in:
// installing one in this environment hit a persistent npm registry
// integrity error (a corrupting proxy, not a real problem with the
// package — retried and confirmed reproducible), so real street/satellite
// tiles aren't available here. Swapping this component's internals for a
// real `react-leaflet` map later is a one-file change — every caller
// already only depends on the `points`/`trail`/`onSelectPoint` props below.
import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";

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

const WIDTH = 640;
const HEIGHT = 340;
const PADDING = 28;

function niceStep(range: number): number {
  const candidates = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 20, 30];
  return candidates.find((c) => range / c <= 6) ?? 60;
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
  const [hovered, setHovered] = useState<string | null>(null);

  const bounds = useMemo(() => {
    const all = [...points, ...trail];
    if (all.length === 0) return { minLat: -10, maxLat: 10, minLon: -10, maxLon: 10 };
    const lats = all.map((p) => p.latitude);
    const lons = all.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    // Guarantee a minimum visible span so a single point isn't a 0x0 box.
    const latPad = Math.max(0.5, (maxLat - minLat) * 0.25);
    const lonPad = Math.max(0.5, (maxLon - minLon) * 0.25);
    return {
      minLat: Math.max(-90, minLat - latPad),
      maxLat: Math.min(90, maxLat + latPad),
      minLon: Math.max(-180, minLon - lonPad),
      maxLon: Math.min(180, maxLon + lonPad),
    };
  }, [points, trail]);

  const project = (lat: number, lon: number) => {
    const x = PADDING + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon || 1)) * (WIDTH - PADDING * 2);
    const y = PADDING + (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1)) * (height - PADDING * 2);
    return { x, y };
  };

  const latStep = niceStep(bounds.maxLat - bounds.minLat);
  const lonStep = niceStep(bounds.maxLon - bounds.minLon);
  const latLines: number[] = [];
  for (let v = Math.ceil(bounds.minLat / latStep) * latStep; v <= bounds.maxLat; v += latStep) latLines.push(v);
  const lonLines: number[] = [];
  for (let v = Math.ceil(bounds.minLon / lonStep) * lonStep; v <= bounds.maxLon; v += lonStep) lonLines.push(v);

  const trailByTerminal = useMemo(() => {
    const map = new Map<string, TrailPoint[]>();
    for (const p of trail) {
      const arr = map.get(p.id) ?? [];
      arr.push(p);
      map.set(p.id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return map;
  }, [trail]);

  if (points.length === 0 && trail.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line text-xs text-text-muted">
        No coordinates to plot.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-raised">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full" role="img" aria-label="Terminal location map">
        <rect x={0} y={0} width={WIDTH} height={height} fill="var(--color-surface-raised, #1a1f27)" />

        {lonLines.map((lon) => {
          const { x } = project(0, lon);
          return (
            <g key={`lon-${lon}`}>
              <line x1={x} y1={PADDING} x2={x} y2={height - PADDING} stroke="#232A33" strokeWidth={1} />
              <text x={x} y={height - PADDING + 14} fontSize={9} fill="#6b7280" textAnchor="middle">
                {lon.toFixed(lonStep < 1 ? 2 : 0)}°
              </text>
            </g>
          );
        })}
        {latLines.map((lat) => {
          const { y } = project(lat, 0);
          return (
            <g key={`lat-${lat}`}>
              <line x1={PADDING} y1={y} x2={WIDTH - PADDING} y2={y} stroke="#232A33" strokeWidth={1} />
              <text x={PADDING - 6} y={y + 3} fontSize={9} fill="#6b7280" textAnchor="end">
                {lat.toFixed(latStep < 1 ? 2 : 0)}°
              </text>
            </g>
          );
        })}

        {[...trailByTerminal.entries()].map(([id, pts]) => (
          <polyline
            key={`trail-${id}`}
            points={pts.map((p) => { const { x, y } = project(p.latitude, p.longitude); return `${x},${y}`; }).join(" ")}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        ))}
        {[...trailByTerminal.entries()].flatMap(([id, pts]) =>
          pts.map((p, i) => {
            const { x, y } = project(p.latitude, p.longitude);
            return (
              <circle key={`trailpt-${id}-${i}`} cx={x} cy={y} r={2.5} fill="#3b82f6">
                <title>{`${formatDateTime(p.timestamp)} — ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}</title>
              </circle>
            );
          })
        )}

        {points.map((p) => {
          const { x, y } = project(p.latitude, p.longitude);
          const isSelected = selectedId === p.id;
          const isHovered = hovered === p.id;
          const color = p.online === false ? "#6b7280" : "#00CF90";
          return (
            <g
              key={p.id}
              className={onSelectPoint ? "cursor-pointer" : undefined}
              onClick={() => onSelectPoint?.(p.id)}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {(isSelected || isHovered) && <circle cx={x} cy={y} r={10} fill={color} opacity={0.2} />}
              <circle cx={x} cy={y} r={5} fill={color} stroke="#0b0f14" strokeWidth={1.5} />
              <title>{`${p.label} — ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}</title>
              {(isSelected || isHovered) && (
                <text x={x + 9} y={y - 8} fontSize={10} fill="#F3F4F6" fontWeight={600}>
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-[11px] text-text-muted">
        <MapPin className="size-3" />
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-accent-green" /> Online</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-text-muted" /> Offline</span>
        {trail.length > 0 && (
          <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-accent-blue" /> History</span>
        )}
        <span className={cn("ml-auto")}>Coordinate grid — not a tile map</span>
      </div>
    </div>
  );
}
