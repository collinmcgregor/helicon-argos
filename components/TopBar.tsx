'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

const FACILITIES = [
  { value: null, label: 'All facilities' },
  { value: 'la_01', label: 'LA-01' },
  { value: 'la_02', label: 'LA-02' },
] as const;

// 48px top bar: breadcrumb · facility selector (persisted in ?facility=) · user menu.
export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const facility = searchParams.get('facility');
  const [menuOpen, setMenuOpen] = useState(false);

  const crumbs = ['argos', ...pathname.split('/').filter(Boolean)];

  const setFacility = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('facility', value);
    else params.delete('facility');
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
  };

  return (
    <header className="fixed left-[220px] right-0 top-0 z-20 flex h-12 items-center justify-between border-b border-border bg-bg-1 px-4">
      <span className="font-mono text-[12.5px] text-text-secondary">
        {crumbs.map((crumb, i) => (
          <span key={i}>
            {i > 0 && <span className="text-text-muted"> / </span>}
            <span className={i === crumbs.length - 1 ? 'text-text-primary' : ''}>{crumb}</span>
          </span>
        ))}
      </span>

      <div className="flex items-center gap-4">
        <div className="flex h-6 items-center rounded-sm border border-border">
          {FACILITIES.map((f) => {
            const active = facility === f.value || (!facility && f.value === null);
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setFacility(f.value)}
                className={`h-full cursor-pointer px-2 font-mono text-[11px] transition-colors duration-100 ${
                  active ? 'bg-bg-3 text-text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <ThemeToggle />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex cursor-pointer items-center gap-2"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-border bg-bg-2 font-mono text-[11px] text-text-primary">
              CM
            </span>
            <span
              className="font-mono text-[11px] font-medium text-accent-resin"
              style={{ letterSpacing: '0.08em' }}
            >
              ADMIN
            </span>
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-8 z-30 w-32 rounded-sm border border-border bg-bg-2"
            >
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setMenuOpen(false);
                  await fetch('/api/logout', { method: 'POST' });
                  window.location.href = '/login';
                }}
                className="block w-full cursor-pointer px-3 py-2 text-left text-[13px] text-text-secondary transition-colors duration-100 hover:bg-bg-3 hover:text-text-primary"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
