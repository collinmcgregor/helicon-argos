'use client';

import { EmptyState } from '@/components/EmptyState';
import { Panel } from '@/components/Panel';

export default function MachineError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <Panel label="Machine detail">
        <EmptyState message="Source-derived machine data could not load." />
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded-sm border border-border bg-bg-3 px-3 py-1 text-[13px] text-text-primary transition-colors duration-100 hover:bg-bg-2"
          >
            Retry
          </button>
        </div>
      </Panel>
    </div>
  );
}
