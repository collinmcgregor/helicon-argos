import { AngleGlyph } from './AngleGlyph';

// Muted fiber-angle glyph + one secondary line + optional mono query context.
// No illustrations.
export function EmptyState({
  message,
  queryContext,
  className = '',
}: {
  message: string;
  queryContext?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 py-8 ${className}`}>
      <AngleGlyph tone="info" size={14} color="var(--color-text-muted)" />
      <p className="text-[13px] text-text-secondary">{message}</p>
      {queryContext && (
        <span className="font-mono text-[11px] text-text-muted">{queryContext}</span>
      )}
    </div>
  );
}
