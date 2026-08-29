import Link from 'next/link';
import type { Route } from 'next';
import type { Severity } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { identifierLabel } from '@/lib/present';

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--color-status-critical)',
  warn: 'var(--color-status-warn)',
  info: 'var(--color-status-info)',
};

// Alert row: 3px full-height severity left border · badge · rule title ·
// explanation · business-impact line · implicated IDs as mono chips · mono time
// right. Whole row navigates to its evidence.
export function AlertRow({
  severity,
  title,
  explanation,
  impact,
  ids = [],
  timeLabel,
  href,
  selected = false,
}: {
  severity: Severity;
  title: string;
  explanation: string;
  impact?: string;
  ids?: string[];
  timeLabel?: string;
  href: Route | string;
  selected?: boolean;
}) {
  return (
    <Link
      href={href as Route}
      className={`flex gap-3 border-b border-border-faint px-4 py-3 transition-colors duration-100 hover:bg-bg-3 ${selected ? 'bg-bg-3' : ''}`}
      style={{ borderLeft: `3px solid ${SEVERITY_COLOR[severity]}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusBadge tone={severity} label={severity} />
          <span className="text-[13px] font-semibold text-text-primary">{title}</span>
        </div>
        <div className="mt-1 text-[13px] text-text-secondary">{explanation}</div>
        {impact && (
          <div className="mt-0.5 text-[13px]" style={{ color: 'var(--color-accent-resin)' }}>
            {impact}
          </div>
        )}
        {ids.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ids.map((id) => (
              <span
                key={id}
                className="rounded-sm bg-bg-inset px-1.5 py-0.5 font-mono text-[12.5px] text-text-secondary"
              >
                {identifierLabel(id)}
              </span>
            ))}
          </div>
        )}
      </div>
      {timeLabel && (
        <span className="shrink-0 font-mono text-[11px] text-text-muted">{timeLabel}</span>
      )}
    </Link>
  );
}
