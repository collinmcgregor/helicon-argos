import type { ReactNode } from 'react';

// Page title 18/600 above the "resin seam": a 2px rule that is --border
// except its first 32px in resin amber.
export function PageTitle({
  children,
  right,
  className = '',
}: {
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-end justify-between pb-2">
        <h1 className="text-[18px] font-semibold text-text-primary">{children}</h1>
        {right}
      </div>
      <div className="flex h-0.5">
        <div className="w-8 shrink-0 bg-accent-resin" />
        <div className="flex-1 bg-border" />
      </div>
    </div>
  );
}
