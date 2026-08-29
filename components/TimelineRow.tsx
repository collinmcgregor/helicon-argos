'use client';

import { useState, type ReactNode } from 'react';
import type { StatusTone } from '@/lib/types';

const TONE_COLOR: Record<StatusTone, string> = {
  ok: 'var(--color-status-ok)',
  warn: 'var(--color-status-warn)',
  critical: 'var(--color-status-critical)',
  info: 'var(--color-status-info)',
};

// Event-timeline log row (32px): --bg-inset gutter with a 1px vertical line and a
// 4px square node · fixed-width mono timestamp · event_type mono chip · summary ·
// muted click-to-copy event_id. It's a log — render it like one.
export function TimelineRow({
  timestamp,
  eventType,
  eventId,
  tone = 'info',
  children,
}: {
  timestamp: string;
  eventType: string;
  eventId: string;
  tone?: StatusTone;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex h-8 items-center gap-3">
      <div className="relative h-full w-6 shrink-0 self-stretch bg-bg-inset">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
        <div
          className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2"
          style={{ background: TONE_COLOR[tone] }}
        />
      </div>
      <span className="w-[150px] shrink-0 font-mono text-[11px] text-text-muted">{timestamp}</span>
      <span className="shrink-0 rounded-sm bg-bg-inset px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
        {eventType}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">{children}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(eventId).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        title="Copy event_id"
        className="shrink-0 cursor-pointer font-mono text-[11px] text-text-muted transition-colors duration-100 hover:text-text-secondary"
      >
        {copied ? 'copied' : eventId}
      </button>
    </div>
  );
}
