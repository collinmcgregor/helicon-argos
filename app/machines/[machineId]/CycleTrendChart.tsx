import type { RecoveredIncident, WeeklyTrendPoint } from '@/lib/queries/machines';
import { eventLabel } from '@/lib/present';

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

  const yLo = Math.max(0, Math.floor((Math.min(...values) - 60) / 200) * 200);
  const yHi = Math.ceil((Math.max(...values) + 60) / 200) * 200;
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
  const step = yHi - yLo > 1200 ? 400 : 200;
  for (let v = yLo; v <= yHi; v += step) yTicks.push(v);

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
          {machineId}
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
                {nf.format(v)}s
              </text>
            </g>
          ))}
          {points.map((p) => (
            <text key={p.weekStart} x={weekX(p)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)" fontFamily="var(--font-plex-mono)">
              {p.weekStart.slice(5)}
            </text>
          ))}

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
                {eventLabel(e.event_type)}
              </text>
            </g>
          ))}

          <path d={path((p) => p.fleetMedianSeconds)} fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d={path((p) => p.machineMedianSeconds)} fill="none" stroke="var(--color-series-1)" strokeWidth="1.5" />
          {points.map(
            (p) =>
              p.machineMedianSeconds !== null && (
                <rect key={p.weekStart} x={weekX(p) - 2} y={y(p.machineMedianSeconds) - 2} width="4" height="4" fill="var(--color-series-1)">
                  <title>{`${p.weekStart} · ${nf.format(p.machineMedianSeconds)}s median · ${nf.format(p.cycleCount)} cycles`}</title>
                </rect>
              ),
          )}
        </svg>
      </div>
    </div>
  );
}
