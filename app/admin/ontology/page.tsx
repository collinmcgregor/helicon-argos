import type { Metadata } from 'next';
import { PageTitle } from '@/components/PageTitle';
import { EVENT_HORIZON_DISPLAY } from '@/lib/display';
import {
  listObjectDefs,
  listRelationshipDefs,
  listFieldDefs,
  recordCounts,
  objectHistory,
  relationshipHistory,
  fieldHistory,
} from '@/lib/queries/ontology';
import { Editor, type EditorState, type Tab } from './editor';
import { OntologyMap } from './map';

export const metadata: Metadata = { title: 'Ontology Control · Helicon Argos' };
export const dynamic = 'force-dynamic';

function one(v: string | string[] | undefined): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

export default async function OntologyControlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tabParam = one(params.tab);
  const tab: Tab =
    tabParam === 'relationships' || tabParam === 'fields' ? tabParam : 'objects';
  const modeParam = one(params.mode);
  const s: EditorState = {
    tab,
    sel: one(params.sel),
    mode: modeParam === 'add' || modeParam === 'edit' ? modeParam : 'view',
    err: one(params.err),
    facility: one(params.facility),
  };

  const [objects, relationships, fields, counts] = await Promise.all([
    listObjectDefs(),
    listRelationshipDefs(),
    listFieldDefs(),
    recordCounts(),
  ]);

  const [objectHist, relHist, fieldHist] = await Promise.all([
    s.tab === 'objects' && s.sel ? objectHistory(s.sel) : Promise.resolve([]),
    s.tab === 'relationships' && s.sel ? relationshipHistory(s.sel) : Promise.resolve([]),
    s.tab === 'fields' && s.sel && s.sel.includes('.')
      ? fieldHistory(s.sel.split('.')[0], s.sel.split('.')[1])
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle
          right={
            <span
              className="font-mono text-[11px] font-medium uppercase text-accent-resin"
              style={{ letterSpacing: '0.08em' }}
            >
              Admin
            </span>
          }
        >
          Ontology Control
        </PageTitle>
        <p className="mt-2 text-[13px] text-text-secondary">
          Define how Argos interprets factory data. Configuration is versioned; raw source
          events and materialized views stay read-only here.
        </p>
        <p className="mt-1 font-mono text-[11px] text-text-muted">
          data through {EVENT_HORIZON_DISPLAY} · source: ontology_* configuration tables
        </p>
      </div>

      <OntologyMap s={s} objects={objects} relationships={relationships} counts={counts} />

      <Editor
        s={s}
        objects={objects}
        relationships={relationships}
        fields={fields}
        counts={counts}
        objectHist={objectHist}
        relHist={relHist}
        fieldHist={fieldHist}
      />
    </div>
  );
}
