import type { StatusTone } from '@/lib/types';
import { AngleGlyph } from './AngleGlyph';

const TONE = {
  ok: { color: 'var(--color-status-ok)', bg: 'var(--color-status-ok-dim)' },
  warn: { color: 'var(--color-status-warn)', bg: 'var(--color-status-warn-dim)' },
  critical: { color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-dim)' },
  info: { color: 'var(--color-status-info)', bg: 'var(--color-status-info-dim)' },
} as const;

// 20px badge: glyph + UPPERCASE label on -dim bg, 1px border at 25% alpha. No pills.
export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  const t = TONE[tone];
  return (
    <span
      className="inline-flex h-5 items-center gap-1.5 rounded-sm px-1.5 text-[11px] font-medium uppercase tracking-wide"
      style={{
        color: t.color,
        background: t.bg,
        border: `1px solid color-mix(in srgb, ${t.color} 25%, transparent)`,
      }}
    >
      <AngleGlyph tone={tone} size={8} />
      {label}
    </span>
  );
}
