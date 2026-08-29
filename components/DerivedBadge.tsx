import type { Provenance } from '@/lib/types';

const LABEL_COLOR: Record<Provenance, string> = {
  observed: 'var(--color-accent)',
  derived: 'var(--color-accent-resin)',
  external: 'var(--color-text-muted)',
};

// Provenance badge + one-line method/caveat. Derived relationships are never
// shown as raw facts — this is the UI half of that invariant.
export function DerivedBadge({
  provenance = 'derived',
  caveat,
  className = '',
}: {
  provenance?: Provenance;
  caveat?: string;
  className?: string;
}) {
  const color = LABEL_COLOR[provenance];
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span
        className="inline-flex h-5 items-center rounded-sm px-1.5 font-mono text-[11px] font-medium uppercase"
        style={{
          color,
          border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          letterSpacing: '0.08em',
        }}
      >
        {provenance}
      </span>
      {caveat && <span className="text-[11px] text-text-muted">{caveat}</span>}
    </span>
  );
}
