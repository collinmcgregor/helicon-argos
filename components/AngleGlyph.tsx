import type { StatusTone } from '@/lib/types';

const TONE_COLOR: Record<StatusTone, string> = {
  ok: 'var(--color-status-ok)',
  warn: 'var(--color-status-warn)',
  critical: 'var(--color-status-critical)',
  info: 'var(--color-status-info)',
};

// Fiber-angle status glyphs: statuses are layup angles, not dots.
// ok — 0° · info ⟋ 45° · warn ∣ 90° · critical ✕ crossed ±45°
export function AngleGlyph({
  tone,
  size = 10,
  color,
  className,
}: {
  tone: StatusTone;
  size?: number;
  color?: string;
  className?: string;
}) {
  const stroke = color ?? TONE_COLOR[tone];
  const s = size;
  const lines: [number, number, number, number][] =
    tone === 'ok'
      ? [[0, s / 2, s, s / 2]]
      : tone === 'info'
        ? [[0, s, s, 0]]
        : tone === 'warn'
          ? [[s / 2, 0, s / 2, s]]
          : [
              [0, 0, s, s],
              [0, s, s, 0],
            ];
  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      className={className}
      aria-hidden="true"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={1.5} />
      ))}
    </svg>
  );
}
