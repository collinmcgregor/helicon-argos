'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { formatDateShort } from '@/lib/display';
import type { TrendPoint } from '@/lib/queries/overview';
import { useMeasuredWidth } from '@/lib/useMeasuredWidth';

// Laminate chart rules (ARGOS.md §5): fixed series colors, chart-grid gridlines,
// 11px mono axis text, no dual axes. Pure SVG in measured pixel space so axis
// ticks, hover crosshairs, and tooltips stay unstretched.

const TONE_COLOR: Record<string, string> = {
  ok: 'var(--color-series-1)',
  warn: 'var(--color-status-warn)',
  critical: 'var(--color-status-critical)',
  info: 'var(--color-status-info)',
};

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en-US');

function niceCeil(v: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(v, 1)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

export interface TrendStat {
  label: string;
  value: string;
}

interface TrendChartProps {
  points: TrendPoint[];
  kind: 'area' | 'line';
  color: string;
  /** fixed y max (e.g. 100 for percentages); omitted = nice-rounded data max */
  domainMax?: number;
  unit: string;
  formatValue?: 'percent' | 'count';
  reference?: { value: number; label: string; band?: number };
  title: string;
  takeaway: string;
  stats: TrendStat[];
  drill: { href: string; label: string };
}

function TrendPlot({
  points,
  kind,
  color,
  domainMax,
  formatValue = 'count',
  reference,
  height,
  onHoverChange,
}: Pick<TrendChartProps, 'points' | 'kind' | 'color' | 'domainMax' | 'formatValue' | 'reference'> & {
  height: number;
  onHoverChange?: (i: number | null) => void;
}) {
  const { ref, width } = useMeasuredWidth();
  const [hover, setHover] = useState<number | null>(null);

  const pad = { l: 44, r: 10, t: 10, b: 22 };
  const innerW = Math.max(width - pad.l - pad.r, 10);
  const innerH = height - pad.t - pad.b;
  const n = points.length;
  const max = domainMax ?? niceCeil(Math.max(...points.map((p) => p.value), 1));

  const x = (i: number) => pad.l + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v: number) => pad.t + (1 - v / max) * innerH;

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${(pad.t + innerH).toFixed(1)} L${pad.l},${(pad.t + innerH).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const xStep = Math.max(1, Math.ceil(n / 6));
  const xTicks: number[] = [];
  // stop early enough that the last interior tick never crowds the end label
  for (let i = 0; i <= n - 1 - Math.ceil(xStep * 0.7); i += xStep) xTicks.push(i);
  if (n > 0) xTicks.push(n - 1);

  const fmtVal = (v: number) =>
    formatValue === 'percent' ? `${Math.round(v)}%` : compact.format(v);

  const setHoverBoth = (i: number | null) => {
    setHover(i);
    onHoverChange?.(i);
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left - pad.l) / innerW;
    const i = Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1))));
    setHoverBoth(i);
  };

  const h = hover != null ? points[hover] : null;
  const hx = hover != null ? x(hover) : 0;
  const tooltipLeft = hover != null && hx > width * 0.72;

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        className="block"
        onPointerMove={onMove}
        onPointerLeave={() => setHoverBoth(null)}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-chart-grid)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className="fill-text-muted font-mono text-[10px]">
              {fmtVal(v)}
            </text>
          </g>
        ))}
        {reference && (
          <>
            {reference.band != null && (
              <rect
                x={pad.l}
                y={y(reference.value + reference.band)}
                width={innerW}
                height={y(reference.value - reference.band) - y(reference.value + reference.band)}
                fill="var(--color-text-muted)"
                fillOpacity={0.1}
              />
            )}
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y(reference.value)}
              y2={y(reference.value)}
              stroke="var(--color-text-muted)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={width - pad.r}
              y={y(reference.value + (reference.band ?? 0)) - 5}
              textAnchor="end"
              className="fill-text-muted font-mono text-[10px]"
            >
              {reference.label}
            </text>
          </>
        )}
        {kind === 'area' && <path d={area} fill={color} fillOpacity={0.16} />}
        <path d={line} fill="none" stroke={color} strokeWidth={1.5} />
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-text-muted font-mono text-[10px]">
            {formatDateShort(points[i].date)}
          </text>
        ))}
        {h && (
          <>
            <line x1={hx} x2={hx} y1={pad.t} y2={pad.t + innerH} stroke="var(--color-border-strong)" strokeWidth={1} />
            <circle cx={hx} cy={y(h.value)} r={3} fill={color} />
          </>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-sm border border-border-strong bg-bg-1 px-2 py-1"
          style={tooltipLeft ? { right: width - hx + 8 } : { left: hx + 8 }}
        >
          <div className="font-mono text-[10px] text-text-muted">{formatDateShort(h.date)}</div>
          <div className="font-mono text-[12.5px] font-medium text-text-primary">
            {formatValue === 'percent' ? `${h.value}%` : plain.format(h.value)}
          </div>
        </div>
      )}
    </div>
  );
}

export function TrendChart(props: TrendChartProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="block w-full cursor-zoom-in text-left"
        aria-label={`Expand ${props.title} chart`}
      >
        <TrendPlot {...props} height={168} />
      </button>
      <div className="flex items-start justify-between gap-3 border-t border-border-faint pt-2">
        <p className="text-[12px] leading-4 text-text-secondary">{props.takeaway}</p>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="shrink-0 font-mono text-[11px] text-accent hover:underline"
        >
          Expand
        </button>
      </div>
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: 'color-mix(in srgb, var(--color-bg-0) 72%, transparent)' }}
          onClick={() => setExpanded(false)}
        >
          <div
            className="w-full max-w-4xl rounded-sm border border-border-strong bg-bg-2"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex h-10 items-center justify-between border-b border-border px-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {props.title}
              </span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="font-mono text-[12.5px] text-text-muted hover:text-text-primary"
              >
                Close · esc
              </button>
            </header>
            <div className="p-4">
              <TrendPlot {...props} height={340} />
              <div className="mt-3 grid grid-cols-4 gap-3 border-t border-border-faint pt-3">
                {props.stats.map((s) => (
                  <div key={s.label}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{s.label}</div>
                    <div className="mt-0.5 font-mono text-[15px] text-text-primary">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border-faint pt-3">
                <p className="text-[12.5px] text-text-secondary">{props.takeaway}</p>
                <Link href={props.drill.href as Route} className="shrink-0 text-[12.5px] text-accent hover:underline">
                  {props.drill.label} →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface BarRow {
  key: string;
  label: string;
  value: number;
  display: string;
  note?: string;
  tone?: 'ok' | 'warn' | 'critical' | 'info';
  href?: string;
}

export function CategoryBars({
  rows,
  reference,
}: {
  rows: BarRow[];
  reference?: { value: number; label: string };
}) {
  const max = Math.max(...rows.map((r) => r.value), reference?.value ?? 0, 1) * 1.08;
  const refPct = reference ? (reference.value / max) * 100 : null;

  const body = (r: BarRow) => (
    <>
      <span className="w-[88px] shrink-0 truncate font-mono text-[12px] text-text-primary">{r.label}</span>
      <span className="relative h-[18px] flex-1">
        <span
          className="absolute inset-y-[3px] left-0 rounded-sm"
          style={{ width: `${(r.value / max) * 100}%`, background: TONE_COLOR[r.tone ?? 'ok'], opacity: 0.75 }}
        />
        {refPct != null && (
          <span
            className="absolute inset-y-0 border-l border-dashed border-text-muted"
            style={{ left: `${refPct}%` }}
          />
        )}
      </span>
      <span className="w-[76px] shrink-0 text-right font-mono text-[12px] text-text-secondary">{r.display}</span>
      {rows.some((x) => x.note) && (
        <span className="w-[136px] shrink-0 text-right text-[11px] text-text-muted">{r.note}</span>
      )}
    </>
  );

  return (
    <div className="flex flex-col">
      {rows.map((r) =>
        r.href ? (
          <Link
            key={r.key}
            href={r.href as Route}
            className="flex items-center gap-3 rounded-sm px-1 py-0.5 transition-colors duration-100 hover:bg-bg-3"
            title={`${r.label}: ${r.display}`}
          >
            {body(r)}
          </Link>
        ) : (
          <div key={r.key} className="flex items-center gap-3 px-1 py-0.5" title={`${r.label}: ${r.display}`}>
            {body(r)}
          </div>
        ),
      )}
      {reference && (
        <div className="mt-1 flex items-center gap-1.5 px-1 font-mono text-[10px] text-text-muted">
          <span className="inline-block h-3 border-l border-dashed border-text-muted" />
          {reference.label}
        </div>
      )}
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
