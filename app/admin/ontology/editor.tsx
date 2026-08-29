import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Panel } from '@/components/Panel';
import { SectionLabel } from '@/components/SectionLabel';
import { DerivedBadge } from '@/components/DerivedBadge';
import { EmptyState } from '@/components/EmptyState';
import { Table, THead, Th, Tr, Td } from '@/components/Table';
import {
  APPROVED_SOURCES,
  type ObjectDef,
  type FieldDef,
  type RelationshipDef,
} from '@/lib/queries/ontology';
import {
  addObject,
  editObject,
  archiveObject,
  addRelationship,
  editRelationship,
  archiveRelationship,
  addField,
  archiveField,
} from './actions';

export type Tab = 'objects' | 'relationships' | 'fields';

export interface EditorState {
  tab: Tab;
  sel: string | null;
  mode: 'view' | 'add' | 'edit';
  err: string | null;
  facility: string | null;
}

export function href(s: EditorState, patch: Partial<EditorState>): Route {
  const next = { ...s, ...patch };
  const q = new URLSearchParams({ tab: next.tab });
  if (next.sel) q.set('sel', next.sel);
  if (next.mode !== 'view') q.set('mode', next.mode);
  if (next.facility) q.set('facility', next.facility);
  return `/admin/ontology?${q.toString()}` as Route;
}

const inputCls =
  'h-8 w-full rounded-sm border border-border bg-bg-1 px-2 text-[13px] text-text-primary outline-none focus:border-border-strong';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </label>
  );
}

function SubmitBtn({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="h-8 rounded-sm border border-border-strong bg-bg-3 px-3 text-[13px] text-text-primary transition-colors duration-100 hover:bg-bg-1"
    >
      {children}
    </button>
  );
}

function LinkBtn({ href: to, children }: { href: Route; children: ReactNode }) {
  return (
    <Link
      href={to}
      className="inline-flex h-8 items-center rounded-sm border border-border px-3 text-[13px] text-text-secondary transition-colors duration-100 hover:bg-bg-3"
    >
      {children}
    </Link>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border-faint py-1.5">
      <span className="w-32 shrink-0 text-[11px] uppercase text-text-muted" style={{ letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span className="min-w-0 text-[13px] text-text-primary">{children}</span>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12.5px]">{children}</span>;
}

function sourceHint(mapping: string | null): string | null {
  return APPROVED_SOURCES.find((s) => s.mapping === mapping)?.describes ?? null;
}

function SourceLine({ mapping, count }: { mapping: string | null; count: number | null }) {
  if (!mapping) {
    return <span className="text-text-muted">Configured; no records are currently available from a source.</span>;
  }
  const hint = sourceHint(mapping);
  return (
    <span className="flex flex-col gap-0.5">
      <span>
        <Mono>{mapping}</Mono>
        {count !== null && <Mono>{` · ${count.toLocaleString('en-US')} records`}</Mono>}
      </span>
      {hint && <span className="text-[11px] text-text-muted">{hint}</span>}
      {count === null && (
        <span className="text-[11px] text-text-muted">
          Configured; no records are currently available from a source.
        </span>
      )}
    </span>
  );
}

function ProvenanceSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <Field label="Provenance">
      <select name="provenance" defaultValue={defaultValue ?? 'observed'} className={inputCls}>
        <option value="observed">observed</option>
        <option value="derived">derived (requires caveat)</option>
        <option value="external">external</option>
      </select>
    </Field>
  );
}

function SourceSelect({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <Field label="Source mapping (approved sources only)">
      <select name="source_mapping" defaultValue={defaultValue ?? ''} className={inputCls}>
        <option value="">— none (configured; no records from a source) —</option>
        {APPROVED_SOURCES.map((s) => (
          <option key={s.mapping} value={s.mapping}>
            {s.mapping}
          </option>
        ))}
      </select>
    </Field>
  );
}

function FacilityCarry({ facility }: { facility: string | null }) {
  return facility ? <input type="hidden" name="facility" value={facility} /> : null;
}

function HistoryList({
  rows,
}: {
  rows: { version: number; editor: string; status: string; created_at: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <SectionLabel>Change history</SectionLabel>
      <div className="mt-1">
        {rows.map((r) => (
          <div key={r.version} className="flex items-baseline gap-3 border-b border-border-faint py-1">
            <Mono>v{r.version}</Mono>
            <Mono>{r.created_at.slice(0, 19).replace('T', ' ')}</Mono>
            <span className="text-[12px] text-text-secondary">{r.editor}</span>
            <span className={`text-[11px] uppercase ${r.status === 'archived' ? 'text-text-muted' : 'text-status-ok'}`}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchiveBtn({
  action,
  hidden,
  archived,
  facility,
}: {
  action: (fd: FormData) => Promise<void>;
  hidden: Record<string, string>;
  archived: boolean;
  facility: string | null;
}) {
  return (
    <form action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="to" value={archived ? 'active' : 'archived'} />
      <FacilityCarry facility={facility} />
      <SubmitBtn>{archived ? 'Restore' : 'Archive'}</SubmitBtn>
    </form>
  );
}

// --------------------------------------------------------------------------
// Objects tab
// --------------------------------------------------------------------------

function ObjectForm({ s, existing }: { s: EditorState; existing?: ObjectDef }) {
  return (
    <form action={existing ? editObject : addObject} className="flex flex-col gap-3">
      <FacilityCarry facility={s.facility} />
      {existing ? (
        <input type="hidden" name="key" value={existing.key} />
      ) : (
        <Field label="Key (lower_snake_case)">
          <input name="key" className={`${inputCls} font-mono`} placeholder="supplier" required />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Label">
          <input name="label" defaultValue={existing?.label} className={inputCls} required />
        </Field>
        <Field label="Plural label">
          <input name="plural_label" defaultValue={existing?.plural_label ?? ''} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ID field">
          <input name="id_field" defaultValue={existing?.id_field ?? ''} className={`${inputCls} font-mono`} />
        </Field>
        <ProvenanceSelect defaultValue={existing?.provenance} />
      </div>
      <SourceSelect defaultValue={existing?.source_mapping} />
      <Field label="Description">
        <input name="description" defaultValue={existing?.description ?? ''} className={inputCls} />
      </Field>
      <div className="flex gap-2">
        <SubmitBtn>{existing ? 'Save new version' : 'Add object'}</SubmitBtn>
        <LinkBtn href={href(s, { mode: 'view' })}>Cancel</LinkBtn>
      </div>
    </form>
  );
}

function ObjectDetail({
  s,
  def,
  fields,
  counts,
  history,
}: {
  s: EditorState;
  def: ObjectDef;
  fields: FieldDef[];
  counts: Record<string, number | null>;
  history: ObjectDef[];
}) {
  if (s.mode === 'edit') return <ObjectForm s={s} existing={def} />;
  const count = def.source_mapping ? (counts[def.source_mapping] ?? null) : null;
  const own = fields.filter((f) => f.object_key === def.key && f.status === 'active');
  return (
    <div>
      <Meta label="Label">
        {def.label}
        {def.plural_label && <span className="text-text-muted"> / {def.plural_label}</span>}
      </Meta>
      <Meta label="Key"><Mono>{def.key}</Mono></Meta>
      <Meta label="ID field"><Mono>{def.id_field ?? '—'}</Mono></Meta>
      <Meta label="Source"><SourceLine mapping={def.source_mapping} count={count} /></Meta>
      <Meta label="Provenance"><DerivedBadge provenance={def.provenance} /></Meta>
      {def.description && <Meta label="Description">{def.description}</Meta>}
      <Meta label="Fields">
        {own.length === 0 ? (
          <span className="text-text-muted">No documented fields.</span>
        ) : (
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {own.map((f) => (
              <Link key={f.key} href={href(s, { tab: 'fields', sel: `${f.object_key}.${f.key}`, mode: 'view' })} className="text-accent hover:underline">
                <Mono>{f.key}</Mono>
              </Link>
            ))}
          </span>
        )}
      </Meta>
      <Meta label="Version">
        <Mono>v{def.version}</Mono>
        {def.prior_version_id !== null && <span className="text-[11px] text-text-muted"> · prior #{def.prior_version_id}</span>}
      </Meta>
      <Meta label="Last change">
        <Mono>{def.created_at.slice(0, 19).replace('T', ' ')}</Mono>
        <span className="text-text-secondary"> by {def.editor}</span>
        <span className={`ml-2 text-[11px] uppercase ${def.status === 'archived' ? 'text-text-muted' : 'text-status-ok'}`}>{def.status}</span>
      </Meta>
      <div className="mt-3 flex gap-2">
        <LinkBtn href={href(s, { mode: 'edit' })}>Edit</LinkBtn>
        <ArchiveBtn action={archiveObject} hidden={{ key: def.key }} archived={def.status === 'archived'} facility={s.facility} />
      </div>
      <HistoryList rows={history} />
    </div>
  );
}

// --------------------------------------------------------------------------
// Relationships tab
// --------------------------------------------------------------------------

function RelationshipForm({
  s,
  objects,
  existing,
}: {
  s: EditorState;
  objects: ObjectDef[];
  existing?: RelationshipDef;
}) {
  const objectSelect = (name: string, defaultValue?: string) => (
    <select name={name} defaultValue={defaultValue} className={inputCls}>
      {objects
        .filter((o) => o.status === 'active')
        .map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
    </select>
  );
  return (
    <form action={existing ? editRelationship : addRelationship} className="flex flex-col gap-3">
      <FacilityCarry facility={s.facility} />
      {existing ? (
        <input type="hidden" name="key" value={existing.key} />
      ) : (
        <Field label="Key (lower_snake_case)">
          <input name="key" className={`${inputCls} font-mono`} placeholder="supplier_provides_lot" required />
        </Field>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Field label="From">{objectSelect('from_object', existing?.from_object)}</Field>
        <Field label="Relationship label (verb)">
          <input name="verb" defaultValue={existing?.verb} className={inputCls} placeholder="provides" required />
        </Field>
        <Field label="To">{objectSelect('to_object', existing?.to_object)}</Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ProvenanceSelect defaultValue={existing?.provenance} />
        <Field label="Caveat / method (required when derived)">
          <input name="caveat" defaultValue={existing?.caveat ?? ''} className={inputCls} />
        </Field>
      </div>
      <SourceSelect defaultValue={existing?.source_mapping} />
      <div className="flex gap-2">
        <SubmitBtn>{existing ? 'Save new version' : 'Add relationship'}</SubmitBtn>
        <LinkBtn href={href(s, { mode: 'view' })}>Cancel</LinkBtn>
      </div>
    </form>
  );
}

function RelationshipDetail({
  s,
  def,
  objects,
  counts,
  history,
}: {
  s: EditorState;
  def: RelationshipDef;
  objects: ObjectDef[];
  counts: Record<string, number | null>;
  history: RelationshipDef[];
}) {
  if (s.mode === 'edit') return <RelationshipForm s={s} objects={objects} existing={def} />;
  const label = (key: string) => objects.find((o) => o.key === key)?.label ?? key;
  const count = def.source_mapping ? (counts[def.source_mapping] ?? null) : null;
  return (
    <div>
      <Meta label="Edge">
        {label(def.from_object)} <span className="font-mono text-[12px] text-text-secondary">──{def.verb}──▶</span>{' '}
        {label(def.to_object)}
      </Meta>
      <Meta label="Key"><Mono>{def.key}</Mono></Meta>
      <Meta label="Provenance"><DerivedBadge provenance={def.provenance} caveat={def.caveat ?? undefined} /></Meta>
      <Meta label="Source"><SourceLine mapping={def.source_mapping} count={count} /></Meta>
      <Meta label="Version"><Mono>v{def.version}</Mono></Meta>
      <Meta label="Last change">
        <Mono>{def.created_at.slice(0, 19).replace('T', ' ')}</Mono>
        <span className="text-text-secondary"> by {def.editor}</span>
        <span className={`ml-2 text-[11px] uppercase ${def.status === 'archived' ? 'text-text-muted' : 'text-status-ok'}`}>{def.status}</span>
      </Meta>
      <div className="mt-3 flex gap-2">
        <LinkBtn href={href(s, { mode: 'edit' })}>Edit</LinkBtn>
        <ArchiveBtn action={archiveRelationship} hidden={{ key: def.key }} archived={def.status === 'archived'} facility={s.facility} />
      </div>
      <HistoryList rows={history} />
    </div>
  );
}

// --------------------------------------------------------------------------
// Fields tab
// --------------------------------------------------------------------------

function FieldForm({ s, objects }: { s: EditorState; objects: ObjectDef[] }) {
  return (
    <form action={addField} className="flex flex-col gap-3">
      <FacilityCarry facility={s.facility} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Object">
          <select name="object_key" className={inputCls}>
            {objects
              .filter((o) => o.status === 'active')
              .map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Key (lower_snake_case)">
          <input name="key" className={`${inputCls} font-mono`} placeholder="operator_id" required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Label">
          <input name="label" className={inputCls} required />
        </Field>
        <Field label="Type">
          <select name="field_type" className={inputCls}>
            {['text', 'integer', 'numeric', 'boolean', 'timestamp', 'enum'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ProvenanceSelect />
        <Field label="Caveat / method (required when derived)">
          <input name="caveat" className={inputCls} />
        </Field>
      </div>
      <SourceSelect />
      <div className="flex gap-2">
        <SubmitBtn>Add field</SubmitBtn>
        <LinkBtn href={href(s, { mode: 'view' })}>Cancel</LinkBtn>
      </div>
    </form>
  );
}

function FieldDetail({
  s,
  def,
  counts,
  history,
}: {
  s: EditorState;
  def: FieldDef;
  counts: Record<string, number | null>;
  history: FieldDef[];
}) {
  const count = def.source_mapping ? (counts[def.source_mapping] ?? null) : null;
  return (
    <div>
      <Meta label="Field">
        {def.label} <span className="text-text-muted">on</span>{' '}
        <Link href={href(s, { tab: 'objects', sel: def.object_key, mode: 'view' })} className="text-accent hover:underline">
          <Mono>{def.object_key}</Mono>
        </Link>
      </Meta>
      <Meta label="Key"><Mono>{def.object_key}.{def.key}</Mono></Meta>
      <Meta label="Type"><Mono>{def.field_type}</Mono></Meta>
      <Meta label="Provenance"><DerivedBadge provenance={def.provenance} caveat={def.caveat ?? undefined} /></Meta>
      <Meta label="Source"><SourceLine mapping={def.source_mapping} count={count} /></Meta>
      <Meta label="Version"><Mono>v{def.version}</Mono></Meta>
      <Meta label="Last change">
        <Mono>{def.created_at.slice(0, 19).replace('T', ' ')}</Mono>
        <span className="text-text-secondary"> by {def.editor}</span>
        <span className={`ml-2 text-[11px] uppercase ${def.status === 'archived' ? 'text-text-muted' : 'text-status-ok'}`}>{def.status}</span>
      </Meta>
      <div className="mt-3 flex gap-2">
        <ArchiveBtn
          action={archiveField}
          hidden={{ object_key: def.object_key, key: def.key }}
          archived={def.status === 'archived'}
          facility={s.facility}
        />
      </div>
      <HistoryList rows={history} />
    </div>
  );
}

// --------------------------------------------------------------------------
// Assembled editor
// --------------------------------------------------------------------------

export function Editor({
  s,
  objects,
  relationships,
  fields,
  counts,
  objectHist,
  relHist,
  fieldHist,
}: {
  s: EditorState;
  objects: ObjectDef[];
  relationships: RelationshipDef[];
  fields: FieldDef[];
  counts: Record<string, number | null>;
  objectHist: ObjectDef[];
  relHist: RelationshipDef[];
  fieldHist: FieldDef[];
}) {
  const tabs: { tab: Tab; label: string }[] = [
    { tab: 'objects', label: 'Objects' },
    { tab: 'relationships', label: 'Relationships' },
    { tab: 'fields', label: 'Fields' },
  ];
  const addLabel = { objects: '+ Add object', relationships: '+ Add relationship', fields: '+ Add field' }[s.tab];

  const selObject = s.tab === 'objects' ? objects.find((o) => o.key === s.sel) : undefined;
  const selRel = s.tab === 'relationships' ? relationships.find((r) => r.key === s.sel) : undefined;
  const selField =
    s.tab === 'fields' ? fields.find((f) => `${f.object_key}.${f.key}` === s.sel) : undefined;

  const detailLabel =
    s.mode === 'add'
      ? `New ${s.tab.slice(0, -1)}`
      : selObject
        ? `Selected object · ${selObject.label}`
        : selRel
          ? `Selected relationship · ${selRel.verb}`
          : selField
            ? `Selected field · ${selField.label}`
            : 'Detail';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <Link
              key={t.tab}
              href={href(s, { tab: t.tab, sel: null, mode: 'view' })}
              className={`flex h-8 items-center rounded-sm border px-3 text-[13px] transition-colors duration-100 ${
                s.tab === t.tab
                  ? 'border-border-strong bg-bg-3 text-text-primary'
                  : 'border-border text-text-secondary hover:bg-bg-3'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <LinkBtn href={href(s, { mode: 'add' })}>{addLabel}</LinkBtn>
      </div>

      {s.err && (
        <div className="mb-3 rounded-sm border border-status-critical bg-status-critical-dim px-3 py-2 text-[13px] text-status-critical">
          {s.err}
        </div>
      )}

      <div className="grid grid-cols-[minmax(320px,2fr)_3fr] gap-4">
        <Panel
          label={{ objects: 'Object catalogue', relationships: 'Relationship catalogue', fields: 'Field catalogue' }[s.tab]}
          count={{ objects: objects.length, relationships: relationships.length, fields: fields.length }[s.tab]}
          padded={false}
        >
          <Table>
            <THead>
              <tr>
                <Th>{s.tab === 'fields' ? 'Field' : s.tab === 'relationships' ? 'Edge' : 'Object'}</Th>
                <Th>Provenance</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <tbody>
              {s.tab === 'objects' &&
                objects.map((o) => (
                  <Tr key={o.key} className={o.key === s.sel ? 'bg-bg-3' : ''}>
                    <Td>
                      <Link href={href(s, { sel: o.key, mode: 'view' })} className="block hover:text-accent">
                        {o.label} <span className="font-mono text-[11px] text-text-muted">{o.key}</span>
                      </Link>
                    </Td>
                    <Td><DerivedBadge provenance={o.provenance} /></Td>
                    <Td className={o.status === 'archived' ? 'text-text-muted' : 'text-text-secondary'}>{o.status}</Td>
                  </Tr>
                ))}
              {s.tab === 'relationships' &&
                relationships.map((r) => (
                  <Tr key={r.key} className={r.key === s.sel ? 'bg-bg-3' : ''}>
                    <Td>
                      <Link href={href(s, { sel: r.key, mode: 'view' })} className="block hover:text-accent">
                        <span className="font-mono text-[12px]">{r.from_object}</span>{' '}
                        <span className="text-text-secondary">{r.verb}</span>{' '}
                        <span className="font-mono text-[12px]">{r.to_object}</span>
                      </Link>
                    </Td>
                    <Td><DerivedBadge provenance={r.provenance} /></Td>
                    <Td className={r.status === 'archived' ? 'text-text-muted' : 'text-text-secondary'}>{r.status}</Td>
                  </Tr>
                ))}
              {s.tab === 'fields' &&
                fields.map((f) => (
                  <Tr key={`${f.object_key}.${f.key}`} className={`${f.object_key}.${f.key}` === s.sel ? 'bg-bg-3' : ''}>
                    <Td>
                      <Link href={href(s, { sel: `${f.object_key}.${f.key}`, mode: 'view' })} className="block hover:text-accent">
                        {f.label}{' '}
                        <span className="font-mono text-[11px] text-text-muted">
                          {f.object_key}.{f.key}
                        </span>
                      </Link>
                    </Td>
                    <Td><DerivedBadge provenance={f.provenance} /></Td>
                    <Td className={f.status === 'archived' ? 'text-text-muted' : 'text-text-secondary'}>{f.status}</Td>
                  </Tr>
                ))}
            </tbody>
          </Table>
        </Panel>

        <Panel label={detailLabel}>
          {s.mode === 'add' ? (
            s.tab === 'objects' ? (
              <ObjectForm s={s} />
            ) : s.tab === 'relationships' ? (
              <RelationshipForm s={s} objects={objects} />
            ) : (
              <FieldForm s={s} objects={objects} />
            )
          ) : selObject ? (
            <ObjectDetail s={s} def={selObject} fields={fields} counts={counts} history={objectHist} />
          ) : selRel ? (
            <RelationshipDetail s={s} def={selRel} objects={objects} counts={counts} history={relHist} />
          ) : selField ? (
            <FieldDetail s={s} def={selField} counts={counts} history={fieldHist} />
          ) : (
            <EmptyState
              message="Select a definition from the catalogue or the map to inspect it."
              queryContext={`tab=${s.tab}`}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
