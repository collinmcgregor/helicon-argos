/** Human-facing labels for source-system identifiers.
 *
 * Keep raw IDs in URLs and queries; use these only at the UI boundary. This gives
 * operators a readable product without weakening traceability back to the JSONL.
 */
const words = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function jobLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/^job_0*/, '') || '0';
}

export function customerLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return words(value.replace(/^cust_/, ''));
}

export function partLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/^part_0*/, '') || '0';
}

export function facilityLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const match = value.match(/^([a-z]+)_(\d+)$/i);
  return match ? `${match[1].toUpperCase()} ${match[2]}` : words(value);
}

export function machineLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const match = value.match(/^([a-z]+)_(\d+)$/i);
  return match ? `${words(match[1])} ${match[2]}` : words(value);
}

export function toolLabel(value: string | null | undefined): string {
  return machineLabel(value);
}

export function materialLabel(value: string | null | undefined): string {
  return value ? words(value) : '—';
}

export function eventLabel(value: string | null | undefined): string {
  return value ? words(value) : '—';
}

export function reasonLabel(value: string | null | undefined): string {
  return value ? words(value) : '—';
}

export function identifierLabel(value: string): string {
  if (value.startsWith('job_')) return `Job ${jobLabel(value)}`;
  if (value.startsWith('cust_')) return customerLabel(value);
  if (value.startsWith('part_')) return `Part ${partLabel(value)}`;
  if (value.startsWith('press_')) return machineLabel(value);
  if (value.startsWith('tool_')) return toolLabel(value);
  if (value.startsWith('la_')) return facilityLabel(value);
  if (value.startsWith('lot_')) return `Lot ${value.replace(/^lot_0*/, '')}`;
  if (value.startsWith('qc_')) return `QC ${value.replace(/^qc_0*/, '')}`;
  return words(value);
}
