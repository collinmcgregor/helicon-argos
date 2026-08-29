import type { ReactNode } from 'react';
import { SectionLabel } from './SectionLabel';

// Flat --bg-2 panel, 1px border, radius ≤2px, no shadow.
// Optional 36px header: small-caps label left, mono count right.
export function Panel({
  label,
  count,
  headerRight,
  children,
  className = '',
  padded = true,
}: {
  label?: ReactNode;
  count?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-sm border border-border bg-bg-2 ${className}`}>
      {label !== undefined && (
        <header className="flex h-9 items-center justify-between border-b border-border px-4">
          <SectionLabel>{label}</SectionLabel>
          {headerRight ??
            (count !== undefined && (
              <span className="font-mono text-[12.5px] text-text-secondary">{count}</span>
            ))}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}
