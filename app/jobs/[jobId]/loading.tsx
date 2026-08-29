import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { Skeleton } from '@/components/Skeleton';

export default function JobDetailLoading() {
  return (
    <div className="flex flex-col gap-3">
      <PageTitle>
        <Skeleton height={20} width={120} />
      </PageTitle>
      <Skeleton height={34} width={480} />
      <div className="grid grid-cols-[2fr_1fr] items-start gap-3">
        <Panel padded={false} label="Event timeline">
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} height={20} />
            ))}
          </div>
        </Panel>
        <div className="flex flex-col gap-3">
          {['Machines & tools', 'Inspections', 'Blockers', 'Material lot'].map((label) => (
            <Panel key={label} label={label}>
              <Skeleton height={40} />
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
