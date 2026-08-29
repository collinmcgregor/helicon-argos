// Loading placeholder: --bg-3 block, opacity pulse only (no shimmer, no spring).
export function Skeleton({
  height = 16,
  width,
  className = '',
}: {
  height?: number | string;
  width?: number | string;
  className?: string;
}) {
  return (
    <div
      className={`animate-laminate-pulse rounded-sm bg-bg-3 ${className}`}
      style={{ height, width: width ?? '100%' }}
      aria-hidden="true"
    />
  );
}
