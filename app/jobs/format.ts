import type { JobStatus, StatusTone } from '@/lib/types';

export const STATUS_TONE: Record<JobStatus, StatusTone> = {
  created: 'info',
  in_progress: 'info',
  blocked: 'critical',
  held: 'warn',
  completed: 'ok',
};

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
