// Ply-stack yield bar: quantities rendered as 4px "plies" with 1px gaps —
// a laminate cross-section. good = ok-green, scrap = critical-red, remaining = --bg-3.
export function PlyBar({
  good,
  scrap,
  total,
  plyCount = 24,
  height = 12,
  className = '',
}: {
  good: number;
  scrap: number;
  total: number;
  plyCount?: number;
  height?: number;
  className?: string;
}) {
  const safeTotal = Math.max(total, good + scrap, 1);
  const goodPlies = Math.round((good / safeTotal) * plyCount);
  const scrapPlies = Math.round((scrap / safeTotal) * plyCount);
  const plies = Array.from({ length: plyCount }, (_, i) =>
    i < goodPlies
      ? 'var(--color-status-ok)'
      : i < goodPlies + scrapPlies
        ? 'var(--color-status-critical)'
        : 'var(--color-bg-3)',
  );
  return (
    <div
      className={`flex items-stretch gap-px ${className}`}
      style={{ height }}
      role="img"
      aria-label={`${good} good, ${scrap} scrap of ${safeTotal}`}
    >
      {plies.map((bg, i) => (
        <div key={i} style={{ width: 4, background: bg }} />
      ))}
    </div>
  );
}
