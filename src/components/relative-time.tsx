'use client';

import { useEffect, useMemo, useState } from 'react';

interface Props {
  /** Absolute timestamp to render as a relative "x ago" label. */
  date: Date | string | number | null | undefined;
  /** Prefix label. Defaults to "Updated". */
  label?: string;
  /** Tick cadence in ms — default 15s is enough for a human-readable clock. */
  tickMs?: number;
  className?: string;
}

function formatRelative(from: Date, now: Date): string {
  const ms = now.getTime() - from.getTime();
  if (Number.isNaN(ms) || ms < 0) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function RelativeTime({ date, label = 'Updated', tickMs = 15_000, className }: Props) {
  // Memoised so the effect dependency array is stable when the parent re-renders
  // with the same timestamp — otherwise we'd reset the interval every tick.
  const parsed = useMemo(() => {
    if (!date) return null;
    return date instanceof Date ? date : new Date(date);
  }, [date]);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!parsed) return;
    const id = window.setInterval(() => setTick((t) => t + 1), tickMs);
    return () => window.clearInterval(id);
  }, [parsed, tickMs]);

  if (!parsed || Number.isNaN(parsed.getTime())) return null;

  const relative = formatRelative(parsed, new Date());
  const iso = parsed.toISOString();

  return (
    <time className={className} dateTime={iso} title={parsed.toLocaleString()} aria-live="polite">
      {label} {relative}
    </time>
  );
}
