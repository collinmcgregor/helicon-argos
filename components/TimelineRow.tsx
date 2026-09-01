'use client';

import { useState } from 'react';
import type { StatusTone } from '@/lib/types';

const TONE_COLOR: Record<StatusTone, string> = {
  ok: 'var(--color-status-ok)',
  warn: 'var(--color-status-warn)',
  critical: 'var(--color-status-critical)',
  info: 'var(--color-status-info)',
};

const TONE_BG: Record<StatusTone, string> = {
  ok: 'var(--color-status-ok-dim)',
  warn: 'var(--color-status-warn-dim)',
  critical: 'var(--color-status-critical-dim)',
  info: 'var(--color-bg-inset)',
};

// Event-timeline log row (32px), columnar: --bg-inset gutter with node · mono
// timestamp · tone-tinted event chip · detail · numeric qty · person · muted
// click-to-copy event_id. Info-tone chips stay neutral so pass/fail color reads.
export function TimelineRow({
  timestamp,
  label,
  eventId,
  tone = 'info',
  detail,
  qty,
  who,
}: {
  timestamp: string;
  label: string;
  eventId: string;
  tone?: StatusTone;
  detail?: string;
  qty?: number | null;
  who?: string | null;
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
      <span
        className="w-[88px] shrink-0 rounded-sm px-1.5 py-0.5 text-center font-mono text-[11px]"
        style={{
          background: TONE_BG[tone],
          color: tone === 'info' ? 'var(--color-text-secondary)' : TONE_COLOR[tone],
        }}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">{detail ?? ''}</span>
      <span className="w-[52px] shrink-0 text-right font-mono text-[12px] text-text-secondary">
        {qty != null ? qty : ''}
      </span>
      <span className="w-[96px] shrink-0 truncate text-[12px] text-text-muted">{who ?? ''}</span>
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

// Column captions matching TimelineRow's grid, for the top of the log.
export function TimelineHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-border-faint pb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
      <span className="w-6 shrink-0" />
      <span className="w-[150px] shrink-0">Time</span>
      <span className="w-[88px] shrink-0 text-center">Event</span>
      <span className="min-w-0 flex-1">Detail</span>
      <span className="w-[52px] shrink-0 text-right">Qty</span>
      <span className="w-[96px] shrink-0">By</span>
      <span className="shrink-0">Source ID</span>
    </div>
  );
}
