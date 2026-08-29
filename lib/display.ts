// Pure display formatters — presentation only. URLs, query params, and raw
// evt_* audit ids never pass through here; they stay raw everywhere.
import { NOW } from '@/lib/constants';

const PT_ZONE = 'America/Los_Angeles';

type Stampish = string | Date;

// Date-only values ('2026-08-13') are calendar dates: format them in UTC so the
// day never shifts; real timestamps render in Pacific time, never machine-local.
const isDateOnly = (v: Stampish): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = tz + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz });
    fmtCache.set(key, f);
  }
  return f;
}

function parts(v: Stampish, opts: Intl.DateTimeFormatOptions): string {
  const tz = isDateOnly(v) ? 'UTC' : PT_ZONE;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return fmt(tz, opts).format(d);
}

/** 'Aug 13, 2026' */
export function formatDate(v: Stampish): string {
  return parts(v, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** 'Aug 13' */
export function formatDateShort(v: Stampish): string {
  return parts(v, { month: 'short', day: 'numeric' });
}

/** 'Aug 13, 4:06 PM PT' */
export function formatDateTime(v: Stampish): string {
  return `${parts(v, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} PT`;
}

/** 'Aug 13, 2026, 4:06 PM PT' */
export function formatDateTimeFull(v: Stampish): string {
  return `${parts(v, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} PT`;
}

/** 'Aug 13 · 4:06 PM' — timeline/log rows (mono). */
export function formatStamp(v: Stampish): string {
  const date = parts(v, { month: 'short', day: 'numeric' });
  const time = parts(v, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

/** The frozen event horizon, readable: 'Aug 13, 2026, 4:06 PM PT'. */
export const EVENT_HORIZON_DISPLAY = formatDateTimeFull(NOW);
/** 'Aug 13' — for compact "as of" phrasing. */
export const EVENT_HORIZON_DAY = formatDateShort(NOW);

/** 'job_0276' → '0276' (bare id; render in mono). */
export function formatJobId(id: string): string {
  return id.replace(/^job_/, '');
}

/** 'la_01' / 'LA-01' → 'LA 1'. */
export function formatFacility(id: string): string {
  const m = /^la[_-]0*(\d+)$/i.exec(id);
  return m ? `LA ${m[1]}` : id;
}

const titleCase = (s: string) =>
  s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

const ENTITY_WORDS: Record<string, string> = {
  press: 'Press',
  tool: 'Tool',
  part: 'Part',
  lot: 'Lot',
  qc: 'QC',
  insp: 'Inspector',
  op: 'Operator',
};

/**
 * Human label for any entity id: press_03 → 'Press 3', tool_29 → 'Tool 29',
 * lot_6626 → 'Lot 6626', la_01 → 'LA 1', job_0276 → '0276',
 * cust_nimbus → 'Nimbus'. evt_* audit ids pass through untouched.
 */
export function formatEntityId(id: string): string {
  if (id.startsWith('evt_')) return id;
  if (id.startsWith('job_')) return formatJobId(id);
  if (id.startsWith('cust_')) return titleCase(id.slice(5).replace(/_/g, ' '));
  const la = formatFacility(id);
  if (la !== id) return la;
  const m = /^([a-z]+)_0*(\d+)$/.exec(id);
  if (m && ENTITY_WORDS[m[1]]) return `${ENTITY_WORDS[m[1]]} ${m[2]}`;
  return id;
}

/** snake_case code → sentence case: 'missing_tool' → 'Missing tool'. */
export function formatLabel(s: string): string {
  const words = s.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** snake_case code → lowercase words, for mid-sentence use. */
export function formatLabelLower(s: string): string {
  return s.replace(/_/g, ' ');
}

/** Seconds → '21.6 min' (one decimal). */
export function formatMinutes(seconds: number): string {
  return `${(seconds / 60).toFixed(1)} min`;
}

const ID_IN_TEXT = /\b(?:job|press|tool|part|lot|qc|insp|op|cust|la)_[a-z0-9]+\b/g;
const ISO_DATETIME = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?\b/g;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const SNAKE_WORD = /\b[a-z]+(?:_[a-z]+)+\b/g;
const SECONDS = /\b(\d{1,3}(?:,\d{3})*)s\b/g;

/**
 * Prettify query-built prose for display: readable Pacific dates, entity ids
 * humanized, snake_case words spaced, large seconds shown as minutes.
 * evt_* ids are untouched (excluded from every pattern).
 */
export function humanizeText(text: string): string {
  return text
    .replace(ISO_DATETIME, (m) => formatDateTime(m))
    .replace(ISO_DATE, (m) => formatDate(m))
    .replace(ID_IN_TEXT, (m) => formatEntityId(m))
    .replace(SNAKE_WORD, (m) => m.replace(/_/g, ' '))
    .replace(SECONDS, (m, n: string) => {
      const secs = Number(n.replace(/,/g, ''));
      return secs >= 60 ? formatMinutes(secs) : m;
    });
}
