'use client';

import { EmptyState } from '@/components/EmptyState';
import { Panel } from '@/components/Panel';

export default function JobsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Panel label="Jobs">
      <div className="flex flex-col items-center gap-2 py-6">
        <EmptyState
          message="Source-derived job data could not load."
          queryContext="jobs_current"
        />
        <button
          type="button"
          onClick={reset}
          className="h-6 cursor-pointer rounded-sm border border-border bg-bg-2 px-2 font-mono text-[11px] text-text-secondary transition-colors duration-100 hover:bg-bg-3"
        >
          Retry
        </button>
      </div>
    </Panel>
  );
}
