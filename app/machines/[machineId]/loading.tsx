import { Panel } from '@/components/Panel';
import { Skeleton } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <div className="flex flex-col gap-2 pb-1">
        <Skeleton height={28} width={180} />
        <Skeleton height={14} width={320} />
      </div>
      <Panel label="Cycle-time trend · weekly median">
        <Skeleton height={220} />
      </Panel>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel label="Evidence log">
          <div className="flex flex-col gap-2">
            <Skeleton height={16} />
            <Skeleton height={16} />
            <Skeleton height={16} width="70%" />
          </div>
        </Panel>
        <Panel label="Affected work">
          <div className="flex flex-col gap-2">
            <Skeleton height={16} />
            <Skeleton height={16} />
            <Skeleton height={16} width="70%" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
