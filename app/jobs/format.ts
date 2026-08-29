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

// ISO → "MM-DD HH:MM" UTC; the dataset spans one year, the horizon shows it.
export function shortStamp(iso: string): string {
  return iso.slice(5, 16).replace('T', ' ');
}
