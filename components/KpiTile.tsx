import Link from 'next/link';
import type { Route } from 'next';
import type { StatusTone } from '@/lib/types';

const TONE_COLOR: Record<StatusTone, string> = {
  ok: 'var(--color-status-ok)',
  warn: 'var(--color-status-warn)',
  critical: 'var(--color-status-critical)',
  info: 'var(--color-status-info)',
};

// Flat KPI tile: 2px status top border (resin-seam echo), small-caps label,
// 28px mono value, 11px mono delta/secondary line. Whole tile links.
export function KpiTile({
  label,
  value,
  delta,
  tone = 'info',
  href,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: StatusTone;
  href: Route | string;
}) {
  return (
    <Link
      href={href as Route}
      className="block min-h-[84px] rounded-sm border border-border bg-bg-2 px-4 py-3 transition-colors duration-100 hover:bg-bg-3"
      style={{ borderTop: `2px solid ${TONE_COLOR[tone]}` }}
    >
      <div
        className="text-[11px] font-semibold uppercase text-text-secondary"
        style={{ letterSpacing: '0.08em' }}
      >
        {label}
      </div>
      <div className="mt-1 font-mono text-[28px] font-medium leading-8 text-text-primary">
        {value}
      </div>
      {delta && <div className="mt-0.5 font-mono text-[11px] text-text-muted">{delta}</div>}
    </Link>
  );
}
