import type { TrendPoint } from '@/lib/queries/overview';

// Laminate chart rules (ARGOS.md §5): series colors in fixed order, chart-grid
// gridlines, 11px mono axis text, no dual axes. Pure SVG, server-rendered.

const W = 600;
const H = 130;

function xAt(i: number, len: number) {
  return len > 1 ? (i / (len - 1)) * W : 0;
}

export function ThroughputArea({ points }: { points: TrendPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const y = (v: number) => H - (v / max) * (H - 8);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i, points.length).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[130px] w-full" preserveAspectRatio="none" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--color-chart-grid)" strokeWidth={1} />
        ))}
        <path d={area} fill="var(--color-series-1)" fillOpacity={0.18} />
        <path d={line} fill="none" stroke="var(--color-series-1)" strokeWidth={1.5} />
      </svg>
      <div className="flex justify-between pt-1 font-mono text-[11px] text-text-muted">
        <span>{points[0]?.date}</span>
        <span>peak {max.toLocaleString('en-US')}/day</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export function PassRateLine({ points, referencePct }: { points: TrendPoint[]; referencePct: number }) {
  // fixed 0–100 domain: the line's flatness around the reference band is the finding
  const y = (v: number) => H - (v / 100) * H;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i, points.length).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[130px] w-full" preserveAspectRatio="none" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--color-chart-grid)" strokeWidth={1} />
        ))}
        <rect x={0} y={y(referencePct + 3)} width={W} height={y(referencePct - 3) - y(referencePct + 3)} fill="var(--color-text-muted)" fillOpacity={0.12} />
        <line x1={0} x2={W} y1={y(referencePct)} y2={y(referencePct)} stroke="var(--color-text-muted)" strokeWidth={1} strokeDasharray="4 4" />
        <path d={line} fill="none" stroke="var(--color-status-ok)" strokeWidth={1.5} />
      </svg>
      <div className="flex justify-between pt-1 font-mono text-[11px] text-text-muted">
        <span>{points[0]?.date}</span>
        <span>ref {referencePct}% overall pass</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const w = 64;
  const h = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(values.length > 1 ? (i / (values.length - 1)) * w : 0).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.25} />
    </svg>
  );
}
