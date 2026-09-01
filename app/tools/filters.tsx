'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Listbox } from '@/components/Listbox';
import { formatEntityId } from '@/lib/display';

export function ToolsFilterBar({ presses }: { presses: string[] }) {
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

  return (
    <div className="flex items-center gap-2">
      <Listbox
        ariaLabel="press"
        value={searchParams.get('press') ?? ''}
        options={[
          { value: '', label: 'All presses' },
          ...presses.map((p) => ({ value: p, label: formatEntityId(p) })),
        ]}
        onChange={(v) => set('press', v)}
      />
      {searchParams.get('press') && (
        <button
          type="button"
          onClick={() => set('press', '')}
          className="text-[12.5px] text-accent hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
