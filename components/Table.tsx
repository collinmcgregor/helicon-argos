import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react';

// Laminate table primitives: sticky small-caps header, 36px rows, 1px faint
// separators (no zebra), right-aligned mono numerics, whole-row hover --bg-3.

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="sticky top-0 z-10 bg-bg-2">{children}</thead>;
}

export function Th({
  numeric = false,
  children,
  className = '',
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      {...rest}
      className={`h-9 border-b border-border px-3 text-[11px] font-semibold uppercase text-text-secondary ${numeric ? 'text-right' : 'text-left'} ${className}`}
      style={{ letterSpacing: '0.08em' }}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      {...rest}
      className={`h-9 border-b border-border-faint transition-colors duration-100 hover:bg-bg-3 ${className}`}
    >
      {children}
    </tr>
  );
}

export function Td({
  numeric = false,
  mono = false,
  children,
  className = '',
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; mono?: boolean }) {
  return (
    <td
      {...rest}
      className={`px-3 ${numeric ? 'text-right' : 'text-left'} ${numeric || mono ? 'font-mono text-[12.5px]' : ''} ${className}`}
    >
      {children}
    </td>
  );
}
