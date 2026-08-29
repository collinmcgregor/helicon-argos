'use client';

import { useEffect, useRef, useState } from 'react';

export interface ListboxOption {
  value: string;
  label: string;
}

// Laminate listbox replacing native <select> (whose popup is OS-styled):
// flat 1px-border trigger + bg-2 popup panel, hover bg-3, radius ≤2px.
// Controlled mode: pass value + onChange (URL-state filters). Form mode:
// pass name (+ defaultValue) and it submits via a hidden input.
export function Listbox({
  options,
  ariaLabel,
  name,
  value,
  defaultValue,
  onChange,
  size = 'sm',
  className = '',
}: {
  options: ListboxOption[];
  ariaLabel: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? options[0]?.value ?? '');
  const selectedValue = value ?? internal;
  const selectedIdx = Math.max(
    0,
    options.findIndex((o) => o.value === selectedValue),
  );
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(selectedIdx);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const commit = (idx: number) => {
    const o = options[idx];
    if (!o) return;
    setInternal(o.value);
    onChange?.(o.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlight(selectedIdx);
        return;
      }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => Math.min(Math.max(h + step, 0), options.length - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) commit(highlight);
      else {
        setOpen(true);
        setHighlight(selectedIdx);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setHighlight(options.length - 1);
    }
  };

  const triggerSize =
    size === 'sm' ? 'h-6 px-1.5 font-mono text-[11px]' : 'h-8 px-2 text-[13px]';
  const optionSize =
    size === 'sm' ? 'px-2 py-1 font-mono text-[11px]' : 'px-2 py-1.5 text-[13px]';
  const selected = options[selectedIdx];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          setOpen((o) => !o);
          setHighlight(selectedIdx);
        }}
        onKeyDown={onKeyDown}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm border border-border bg-bg-2 text-left text-text-secondary transition-colors duration-100 hover:bg-bg-3 ${triggerSize}`}
      >
        <span className="truncate">{selected?.label ?? '—'}</span>
        <span className="shrink-0 text-[9px] text-text-muted">▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-30 mt-1 max-h-64 min-w-full overflow-y-auto whitespace-nowrap rounded-sm border border-border bg-bg-2 py-0.5"
        >
          {options.map((o, i) => (
            <div
              key={o.value}
              role="option"
              aria-selected={o.value === selectedValue}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(i)}
              className={`cursor-pointer ${optionSize} ${
                i === highlight ? 'bg-bg-3 text-text-primary' : 'text-text-secondary'
              } ${o.value === selectedValue ? 'font-medium' : ''}`}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
