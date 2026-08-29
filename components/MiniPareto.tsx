// Inline defect mini-Pareto: thin horizontal bars in --status-critical at reduced
// opacity with mono counts — a PlyBar-style flex div, not a chart component.
export function MiniPareto({
  items,
  className = '',
}: {
  items: { label: string; count: number }[];
  className?: string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      {items.map(({ label, count }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-text-secondary">{label}</span>
          <span
            className="h-1 rounded-sm"
            style={{
              width: Math.max(6, Math.round((count / max) * 56)),
              background: 'var(--color-status-critical)',
              opacity: 0.55,
            }}
          />
          <span className="font-mono text-[11px] text-text-muted">{count}</span>
        </span>
      ))}
    </div>
  );
}
