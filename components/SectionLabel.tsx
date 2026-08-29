import type { ReactNode } from 'react';

// 11/600 +0.08em small-caps section label.
export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`text-[11px] font-semibold uppercase text-text-secondary ${className}`}
      style={{ letterSpacing: '0.08em' }}
    >
      {children}
    </span>
  );
}
