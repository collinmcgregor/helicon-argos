import { Panel } from '@/components/Panel';
import type { Provenance } from '@/lib/types';
import type { ObjectDef, RelationshipDef } from '@/lib/queries/ontology';
import { href, type EditorState } from './editor';

// Fixed layered layout: source → core → assets/quality → derived. Hand-placed
// positions, one SVG edge layer with computed anchors — a diagram, not a canvas.
const NODE_W = 150;
const NODE_H = 48;
const COL_X = (col: number) => 16 + col * 194;

const LAYOUT: Record<string, { col: number; y: number }> = {
  raw_event: { col: 0, y: 150 },
  customer: { col: 1, y: 32 },
  material_lot: { col: 1, y: 210 },
  facility: { col: 1, y: 330 },
  job: { col: 2, y: 120 },
  part: { col: 3, y: 16 },
  production_cycle: { col: 3, y: 120 },
  inspection: { col: 3, y: 240 },
  tool: { col: 4, y: 16 },
  machine: { col: 4, y: 150 },
  inspector: { col: 4, y: 320 },
  operational_issue: { col: 5, y: 200 },
};

const PROV_COLOR: Record<Provenance, string> = {
  observed: 'var(--color-accent)',
  derived: 'var(--color-accent-resin)',
  external: 'var(--color-text-muted)',
};

interface Placed {
  def: ObjectDef;
  x: number;
  y: number;
  count: number | null;
}

function anchor(a: Placed, b: Placed): { x1: number; y1: number; x2: number; y2: number } {
  if (a.x + NODE_W < b.x) {
    return { x1: a.x + NODE_W, y1: a.y + NODE_H / 2, x2: b.x, y2: b.y + NODE_H / 2 };
  }
  if (b.x + NODE_W < a.x) {
    return { x1: a.x, y1: a.y + NODE_H / 2, x2: b.x + NODE_W, y2: b.y + NODE_H / 2 };
  }
  if (a.y < b.y) {
    return { x1: a.x + NODE_W / 2, y1: a.y + NODE_H, x2: b.x + NODE_W / 2, y2: b.y };
  }
  return { x1: a.x + NODE_W / 2, y1: a.y, x2: b.x + NODE_W / 2, y2: b.y + NODE_H };
}

function LegendSwatch({ provenance }: { provenance: Provenance }) {
  return (
    <span
      className="font-mono text-[11px] uppercase"
      style={{ color: PROV_COLOR[provenance], letterSpacing: '0.08em' }}
    >
      {provenance}
    </span>
  );
}

export function OntologyMap({
  s,
  objects,
  relationships,
  counts,
}: {
  s: EditorState;
  objects: ObjectDef[];
  relationships: RelationshipDef[];
  counts: Record<string, number | null>;
}) {
  // archived definitions are hidden from the map, listed only in the catalogue
  const visible = objects.filter((o) => o.status === 'active');
  const extras = visible.filter((o) => !(o.key in LAYOUT));

  const placed = new Map<string, Placed>();
  for (const def of visible) {
    const pos = LAYOUT[def.key];
    const count = def.source_mapping ? (counts[def.source_mapping] ?? null) : null;
    if (pos) {
      placed.set(def.key, { def, x: COL_X(pos.col), y: pos.y, count });
    } else {
      const i = extras.indexOf(def);
      placed.set(def.key, { def, x: COL_X(5), y: 290 + i * 68, count });
    }
  }

  const edges = relationships.filter(
    (r) => r.status === 'active' && placed.has(r.from_object) && placed.has(r.to_object)
  );

  const width = 16 + 6 * 194 - 44 + 16;
  const height = Math.max(400, 290 + extras.length * 68 + NODE_H + 16);

  return (
    <Panel
      label="Ontology map"
      headerRight={
        <span className="flex items-center gap-3">
          <LegendSwatch provenance="observed" />
          <LegendSwatch provenance="derived" />
          <LegendSwatch provenance="external" />
        </span>
      }
      padded={false}
    >
      <div className="overflow-x-auto">
        <div className="relative" style={{ width, height }}>
          <svg
            className="absolute inset-0"
            width={width}
            height={height}
            style={{ pointerEvents: 'none' }}
          >
            <defs>
              {(['observed', 'derived', 'external'] as const).map((p) => (
                <marker
                  key={p}
                  id={`arrow-${p}`}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill={PROV_COLOR[p]} />
                </marker>
              ))}
            </defs>
            {edges.map((r) => {
              const a = placed.get(r.from_object);
              const b = placed.get(r.to_object);
              if (!a || !b) return null;
              const { x1, y1, x2, y2 } = anchor(a, b);
              const color = PROV_COLOR[r.provenance];
              const dashed = r.provenance !== 'observed';
              const selected = s.tab === 'relationships' && s.sel === r.key;
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              return (
                <a
                  key={r.key}
                  href={href(s, { tab: 'relationships', sel: r.key, mode: 'view' })}
                  style={{ pointerEvents: 'auto' }}
                >
                  {r.caveat && <title>{`${r.provenance}: ${r.caveat}`}</title>}
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={10} />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={selected ? 2 : 1}
                    strokeOpacity={selected ? 1 : 0.55}
                    strokeDasharray={dashed ? '4 3' : undefined}
                    markerEnd={`url(#arrow-${r.provenance})`}
                  />
                  <text
                    x={mx}
                    y={my - 5}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                    fill={selected ? color : 'var(--color-text-secondary)'}
                  >
                    {r.verb}
                  </text>
                </a>
              );
            })}
          </svg>
          {[...placed.values()].map(({ def, x, y, count }) => {
            const color = PROV_COLOR[def.provenance];
            const selected = s.tab === 'objects' && s.sel === def.key;
            const ghost = count === null;
            return (
              <a
                key={def.key}
                href={href(s, { tab: 'objects', sel: def.key, mode: 'view' })}
                className="absolute flex flex-col justify-center rounded-sm bg-bg-2 px-2.5 transition-colors duration-100 hover:bg-bg-3"
                style={{
                  left: x,
                  top: y,
                  width: NODE_W,
                  height: NODE_H,
                  border: `1px ${ghost ? 'dashed' : 'solid'} ${
                    selected ? color : `color-mix(in srgb, ${color} 45%, transparent)`
                  }`,
                  background: selected ? 'var(--color-bg-3)' : undefined,
                }}
                title={ghost ? 'Configured · no records available from a source' : undefined}
              >
                <span className="truncate text-[12.5px] text-text-primary">
                  {def.key === 'raw_event' ? 'Raw Event Log' : def.label}
                </span>
                <span
                  className="truncate font-mono text-[10.5px]"
                  style={{ color: ghost ? 'var(--color-text-muted)' : color }}
                >
                  {ghost
                    ? 'configured · no source records'
                    : `${count.toLocaleString('en-US')} · ${def.provenance}`}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
