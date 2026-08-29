import { formatDate, formatDateShort, formatEntityId } from '@/lib/display';
import type { RecoveredIncident, WeeklyTrendPoint } from '@/lib/queries/machines';

const W = 720;
const H = 240;
const M = { top: 30, right: 16, bottom: 26, left: 52 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

const nf = new Intl.NumberFormat('en-US');
const DAY = 86_400_000;

// Laminate chart rules (ARGOS §5): series colors in fixed order, grid
// --chart-grid, 11px mono muted axis text. Asset events are timestamped
// annotations — a sequence marker, never proof of causality.
export function CycleTrendChart({
  machineId,
  points,
  incident,
}: {
  machineId: string;
  points: WeeklyTrendPoint[];
  incident: RecoveredIncident | null;
}) {
  const values = points
    .flatMap((p) => [p.machineMedianSeconds, p.fleetMedianSeconds])
    .filter((v): v is number => v !== null);
  if (points.length === 0 || values.length === 0) return null;

  // y domain and ticks are computed in whole minutes so labels read cleanly
  const loMin = Math.max(0, Math.floor(Math.min(...values) / 60) - 1);
  const hiMin = Math.ceil(Math.max(...values) / 60) + 1;
  const minuteStep = [1, 2, 5, 10, 15, 30].find((s) => (hiMin - loMin) / s <= 6) ?? 60;
  const yLo = loMin * 60;
  const yHi = hiMin * 60;
  const t0 = Date.parse(points[0].weekStart);
  const t1 = Date.parse(points[points.length - 1].weekStart) + 7 * DAY;

  const x = (t: number) => M.left + ((t - t0) / (t1 - t0)) * IW;
  const y = (v: number) => M.top + (1 - (v - yLo) / (yHi - yLo)) * IH;
  const weekX = (p: WeeklyTrendPoint) => x(Date.parse(p.weekStart) + 3.5 * DAY);

  const path = (get: (p: WeeklyTrendPoint) => number | null) => {
    let d = '';
    let pen = false;
    for (const p of points) {
      const v = get(p);
      if (v === null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${weekX(p).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  const yTicks: number[] = [];
  for (let m = Math.ceil(loMin / minuteStep) * minuteStep; m <= hiMin; m += minuteStep)
    yTicks.push(m * 60);
  // thin x labels so long windows don't overlap: at most ~8, always the ends
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  const annotations = incident
    ? [incident.sensorEvent, incident.maintenanceEvent].filter(
        (e) => Date.parse(e.timestamp) >= t0 && Date.parse(e.timestamp) <= t1,
      )
    : [];

  return (
    <div>
      <div className="flex items-center gap-4 pb-2 font-mono text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-4" style={{ background: 'var(--color-series-1)' }} />
          {formatEntityId(machineId)}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="3" aria-hidden="true">
            <line x1="0" y1="1.5" x2="16" y2="1.5" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          fleet median (other presses)
        </span>
        {annotations.length > 0 && (
          <span className="flex items-center gap-1.5">
            <svg width="3" height="12" aria-hidden="true">
              <line x1="1.5" y1="0" x2="1.5" y2="12" stroke="var(--color-status-warn)" strokeWidth="1.5" strokeDasharray="3 2" />
            </svg>
            asset events
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560 }} role="img" aria-label={`Weekly median cycle time for ${machineId} vs fleet`}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="var(--color-chart-grid)" strokeWidth="1" />
              <text x={M.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="11" fill="var(--color-text-muted)" fontFamily="var(--font-plex-mono)">
                {nf.format(v / 60)}m
              </text>
            </g>
          ))}
          {points.map(
            (p, i) =>
              (i % labelEvery === 0 || i === points.length - 1) && (
                <text key={p.weekStart} x={weekX(p)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)" fontFamily="var(--font-plex-mono)">
                  {formatDateShort(p.weekStart)}
                </text>
              ),
          )}

          {annotations.map((e, i) => (
            <g key={e.event_id}>
              <line x1={x(Date.parse(e.timestamp))} x2={x(Date.parse(e.timestamp))} y1={M.top - 4} y2={H - M.bottom} stroke="var(--color-status-warn)" strokeWidth="1" strokeDasharray="3 2" />
              <text
                x={x(Date.parse(e.timestamp)) + (i === 0 ? -4 : 4)}
                y={M.top - 8}
                textAnchor={i === 0 ? 'end' : 'start'}
                fontSize="10"
                fill="var(--color-status-warn)"
                fontFamily="var(--font-plex-mono)"
              >
                {e.event_type.replace(/_/g, ' ')} {e.event_id}
              </text>
            </g>
          ))}

          <path d={path((p) => p.fleetMedianSeconds)} fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d={path((p) => p.machineMedianSeconds)} fill="none" stroke="var(--color-series-1)" strokeWidth="1.5" />
          {points.map(
            (p) =>
              p.machineMedianSeconds !== null && (
                <rect key={p.weekStart} x={weekX(p) - 2} y={y(p.machineMedianSeconds) - 2} width="4" height="4" fill="var(--color-series-1)">
                  <title>{`week of ${formatDate(p.weekStart)} · ${(p.machineMedianSeconds / 60).toFixed(1)} min median (${nf.format(p.machineMedianSeconds)}s) · ${nf.format(p.cycleCount)} cycles`}</title>
                </rect>
              ),
          )}
        </svg>
      </div>
    </div>
  );
}
