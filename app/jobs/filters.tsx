'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
  { value: 'la_01', label: 'LA-01' },
  { value: 'la_02', label: 'LA-02' },
];

function Select({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-6 cursor-pointer rounded-sm border border-border bg-bg-2 px-1.5 font-mono text-[11px] text-text-secondary"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

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
      <Select
        name="facility"
        value={searchParams.get('facility') ?? ''}
        options={FACILITY_OPTIONS}
        onChange={(v) => set('facility', v)}
      />
      <Select
        name="status"
        value={searchParams.get('status') ?? ''}
        options={STATUS_OPTIONS}
        onChange={(v) => set('status', v)}
      />
      <Select
        name="customer"
        value={searchParams.get('customer') ?? ''}
        options={[
          { value: '', label: 'All customers' },
          ...customers.map((c) => ({ value: c, label: c })),
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
