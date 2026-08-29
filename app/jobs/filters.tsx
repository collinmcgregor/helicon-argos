'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Listbox } from '@/components/Listbox';
import { formatEntityId } from '@/lib/display';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'created', label: 'Created' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked-held', label: 'Blocked / held' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'held', label: 'Held' },
  { value: 'completed', label: 'Completed' },
];

const FACILITY_OPTIONS = [
  { value: '', label: 'All facilities' },
  { value: 'la_01', label: 'LA 1' },
  { value: 'la_02', label: 'LA 2' },
];

export function JobsFilterBar({ customers }: { customers: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
  };

  const readOnly = (['risk', 'reason'] as const)
    .map((key) => ({ key, value: searchParams.get(key) }))
    .filter((p) => p.value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Listbox
        ariaLabel="facility"
        value={searchParams.get('facility') ?? ''}
        options={FACILITY_OPTIONS}
        onChange={(v) => set('facility', v)}
      />
      <Listbox
        ariaLabel="status"
        value={searchParams.get('status') ?? ''}
        options={STATUS_OPTIONS}
        onChange={(v) => set('status', v)}
      />
      <Listbox
        ariaLabel="customer"
        value={searchParams.get('customer') ?? ''}
        options={[
          { value: '', label: 'All customers' },
          ...customers.map((c) => ({ value: c, label: formatEntityId(c) })),
        ]}
        onChange={(v) => set('customer', v)}
      />
      {readOnly.map(({ key, value }) => (
        <span
          key={key}
          title="Applied by an alert link; use Clear filters to remove"
          className="inline-flex h-6 items-center rounded-sm border border-border bg-bg-inset px-1.5 font-mono text-[11px] text-text-muted"
        >
          {key}={value}
        </span>
      ))}
    </div>
  );
}
