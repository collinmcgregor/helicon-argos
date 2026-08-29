import { PageTitle } from '@/components/PageTitle';
import { Panel } from '@/components/Panel';
import { Skeleton } from '@/components/Skeleton';

export default function JobsLoading() {
  return (
    <div className="flex flex-col gap-3">
      <PageTitle>Jobs</PageTitle>
      <Skeleton height={24} width={420} />
      <Panel padded={false} label="jobs_current">
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} height={28} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
