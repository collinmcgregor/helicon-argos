'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useSearchParams } from 'next/navigation';
import { SectionLabel } from './SectionLabel';

const SECTIONS: { label: string; items: { label: string; href: string }[] }[] = [
  {
    label: 'Operate',
    items: [
      { label: 'Overview', href: '/' },
      { label: 'Jobs', href: '/jobs' },
    ],
  },
  {
    label: 'Investigate',
    items: [
      { label: 'Alerts', href: '/alerts' },
      { label: 'Machines', href: '/machines' },
      { label: 'Tools', href: '/tools' },
    ],
  },
  {
    label: 'Admin',
    items: [{ label: 'Ontology Control', href: '/admin/ontology' }],
  },
];

// Fixed 220px rail on --bg-0. Active item: --bg-3 + 2px resin left tick.
export function NavRail() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const facility = searchParams.get('facility');
  const query = facility ? `?facility=${facility}` : '';

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="fixed inset-y-0 left-0 z-20 flex w-[220px] flex-col border-r border-border bg-bg-0">
      <Link href={`/${query}` as Route} className="flex h-12 items-center gap-1.5 border-b border-border px-4">
        <span className="font-mono text-[13px] font-medium text-text-primary">HELICON</span>
        <span className="font-mono text-[13px] text-accent-resin">⟋</span>
        <span className="font-mono text-[13px] font-medium text-text-primary">ARGOS</span>
        <span className="font-mono text-[11px] text-text-muted">v0.0</span>
      </Link>
      <div className="flex flex-col gap-4 py-4">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="px-4 pb-1">
              <SectionLabel className="text-text-muted">{section.label}</SectionLabel>
            </div>
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={`${item.href}${query}` as Route}
                  className={`flex h-8 items-center px-4 text-[13px] transition-colors duration-100 ${
                    active
                      ? 'bg-bg-3 text-text-primary'
                      : 'text-text-secondary hover:bg-bg-1 hover:text-text-primary'
                  }`}
                  style={{
                    borderLeft: active
                      ? '2px solid var(--color-accent-resin)'
                      : '2px solid transparent',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
