"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { MapPin, Satellite } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LocationMap, type TrailPoint } from "@/components/ui/LocationMap";
import { FreshnessIndicator } from "@/components/ui/FreshnessIndicator";
import { getTerminalLocationHistoryAction } from "@/lib/actions/tracking";
import { usePolling } from "@/lib/hooks/usePolling";
import { formatDateTime } from "@/lib/utils/format";
import { useRouter } from "next/navigation";
import type { TerminalRecord } from "@/lib/terminals/types";

export function TrackingPageClient({ terminals, detailBasePath }: { terminals: TerminalRecord[]; detailBasePath: string }) {
  const router = useRouter();
  const located = terminals.filter((t) => t.location);
  const [selectedId, setSelectedId] = useState<string | null>(located[0]?.id ?? null);
  const [history, setHistory] = useState<TrailPoint[]>([]);
  const [range, setRange] = useState({ start: "", end: "" });
  const [isPending, startTransition] = useTransition();

  usePolling(() => router.refresh(), 60_000);

  const selected = located.find((t) => t.id === selectedId) ?? null;

  function loadHistory(terminalId: string, start?: string, end?: string) {
    startTransition(async () => {
      const result = await getTerminalLocationHistoryAction(terminalId, start || undefined, end || undefined);
      if ("points" in result) {
        setHistory(result.points.map((p) => ({ id: terminalId, latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp })));
      } else {
        setHistory([]);
      }
    });
  }

  useEffect(() => {
    if (selectedId) loadHistory(selectedId);
    // Only on mount — selecting a different terminal calls loadHistory directly via selectTerminal().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTerminal(id: string) {
    setSelectedId(id);
    setHistory([]);
    setRange({ start: "", end: "" });
    loadHistory(id);
  }

  if (located.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-2xl font-bold">GPS Tracking</p>
          <p className="text-sm text-text-muted">Current terminal locations and movement history.</p>
        </div>
        <EmptyState icon={MapPin} title="No location data available" description="No terminal on this account currently has a GPS fix." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-2xl font-bold">GPS Tracking</p>
        <p className="text-sm text-text-muted">
          {located.length} of {terminals.length} terminal{terminals.length === 1 ? "" : "s"} reporting a location fix.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-5">
            <LocationMap
              points={located.map((t) => ({
                id: t.id,
                latitude: t.location!.latitude,
                longitude: t.location!.longitude,
                label: t.identification.serialNumber,
                online: t.live.onlineStatus === "ONLINE",
              }))}
              trail={history}
              selectedId={selectedId ?? undefined}
              onSelectPoint={selectTerminal}
              height={420}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-green">Terminals</p>
            <div className="max-h-105 space-y-1.5 overflow-y-auto">
              {located.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTerminal(t.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    t.id === selectedId ? "bg-accent-green/15 text-accent-green" : "text-text-secondary hover:bg-surface-raised"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Satellite className="size-3.5 shrink-0" />
                    {t.identification.serialNumber}
                  </span>
                  <Badge tone={t.live.onlineStatus === "ONLINE" ? "green" : "neutral"}>{t.live.onlineStatus}</Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {selected.identification.serialNumber} — Location History
                </p>
                <p className="text-xs text-text-muted">
                  {selected.location!.latitude.toFixed(5)}, {selected.location!.longitude.toFixed(5)} · updated{" "}
                  {formatDateTime(selected.location!.timestamp)}
                </p>
              </div>
              <FreshnessIndicator lastSeenAt={selected.live.lastSeenAt} />
            </div>

            <div className="mb-4 flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs text-text-muted">Start date</label>
                <Input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">End date</label>
                <Input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
              </div>
              <Button
                variant="secondary"
                onClick={() => loadHistory(selected.id, range.start, range.end)}
                disabled={isPending}
              >
                {isPending ? "Loading…" : "Apply Range"}
              </Button>
              <Link href={`${detailBasePath}/${selected.id}`} className="ml-auto text-xs font-medium text-accent-blue hover:underline">
                View full terminal detail
              </Link>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-text-muted">
                {isPending ? "Loading history…" : "No history points in range."}
              </p>
            ) : (
              <p className="text-xs text-text-muted">{history.length} location point{history.length === 1 ? "" : "s"} plotted above.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
