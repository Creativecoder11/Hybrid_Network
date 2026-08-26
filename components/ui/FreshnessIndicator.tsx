"use client";

// "Last updated Xs ago" + Fresh/Stale/Offline badge (§30). Computed purely
// from the record's own lastSeenAt timestamp — the SLASH API has no
// confirmed `stale` flag on any endpoint this app calls, so freshness is an
// app-level judgement about timestamp age, not a value read from the API.
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";

const FRESH_MS = 2 * 60 * 1000;
const STALE_MS = 30 * 60 * 1000;

function relativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function FreshnessIndicator({ lastSeenAt }: { lastSeenAt: string | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!lastSeenAt) {
    return <Badge tone="neutral">No data</Badge>;
  }

  const seenAt = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seenAt)) return <Badge tone="neutral">No data</Badge>;

  const age = Math.max(0, now - seenAt);
  const tone = age < FRESH_MS ? "green" : age < STALE_MS ? "amber" : "red";
  const label = age < FRESH_MS ? "Live" : age < STALE_MS ? "Stale" : "Offline";

  return (
    <Badge tone={tone}>
      {label} · updated {relativeTime(age)}
    </Badge>
  );
}
