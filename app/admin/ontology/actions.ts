'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Provenance } from '@/lib/types';
import {
  createObjectDef,
  editObjectDef,
  setObjectStatus,
  createRelationshipDef,
  editRelationshipDef,
  setRelationshipStatus,
  createFieldDef,
  setFieldStatus,
} from '@/lib/queries/ontology';

// Demo account is an admin (DESIGN.md role state); recorded as the editor.
const EDITOR = 'admin';
const KEY_RE = /^[a-z][a-z0-9_]*$/;

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

function opt(fd: FormData, name: string): string | null {
  const v = str(fd, name);
  return v === '' ? null : v;
}

function provenance(fd: FormData): Provenance {
  const v = str(fd, 'provenance');
  if (v === 'observed' || v === 'derived' || v === 'external') return v;
  throw new Error('invalid provenance');
}

function back(fd: FormData, params: Record<string, string>): never {
  const q = new URLSearchParams(params);
  const facility = str(fd, 'facility');
  if (facility) q.set('facility', facility);
  redirect(`/admin/ontology?${q.toString()}`);
}

function fail(fd: FormData, tab: string, err: string): never {
  back(fd, { tab, err });
}

export async function addObject(fd: FormData): Promise<void> {
  const key = str(fd, 'key');
  if (!KEY_RE.test(key)) fail(fd, 'objects', 'Key must be lower_snake_case.');
  if (!str(fd, 'label')) fail(fd, 'objects', 'Label is required.');
  await createObjectDef(
    {
      key,
      label: str(fd, 'label'),
      plural_label: opt(fd, 'plural_label'),
      id_field: opt(fd, 'id_field'),
      source_mapping: opt(fd, 'source_mapping'),
      description: opt(fd, 'description'),
      provenance: provenance(fd),
    },
    EDITOR
  );
  revalidatePath('/admin/ontology');
  back(fd, { tab: 'objects', sel: key });
}

export async function editObject(fd: FormData): Promise<void> {
  const key = str(fd, 'key');
  if (!str(fd, 'label')) fail(fd, 'objects', 'Label is required.');
  await editObjectDef(
    {
      key,
      label: str(fd, 'label'),
      plural_label: opt(fd, 'plural_label'),
      id_field: opt(fd, 'id_field'),
      source_mapping: opt(fd, 'source_mapping'),
      description: opt(fd, 'description'),
      provenance: provenance(fd),
    },
    EDITOR
  );
  revalidatePath('/admin/ontology');
  back(fd, { tab: 'objects', sel: key });
}

export async function archiveObject(fd: FormData): Promise<void> {
  const key = str(fd, 'key');
  await setObjectStatus(key, str(fd, 'to') === 'active' ? 'active' : 'archived', EDITOR);
  revalidatePath('/admin/ontology');
  back(fd, { tab: 'objects', sel: key });
}

export async function addRelationship(fd: FormData): Promise<void> {
  const key = str(fd, 'key');
  const prov = provenance(fd);
  const caveat = opt(fd, 'caveat');
  if (!KEY_RE.test(key)) fail(fd, 'relationships', 'Key must be lower_snake_case.');
  if (!str(fd, 'verb')) fail(fd, 'relationships', 'Relationship label is required.');
  if (prov === 'derived' && !caveat)
    fail(fd, 'relationships', 'A derived relationship requires a method/caveat.');
  await createRelationshipDef(
    {
      key,
      from_object: str(fd, 'from_object'),
      verb: str(fd, 'verb'),
      to_object: str(fd, 'to_object'),
      source_mapping: opt(fd, 'source_mapping'),
      provenance: prov,
      caveat,
    },
    EDITOR
  );
  revalidatePath('/admin/ontology');
  back(fd, { tab: 'relationships', sel: key });
}

export async function editRelationship(fd: FormData): Promise<void> {
  const key = str(fd, 'key');
  const prov = provenance(fd);
  const caveat = opt(fd, 'caveat');
  if (prov === 'derived' && !caveat)
    fail(fd, 'relationships', 'A derived relationship requires a method/caveat.');
  await editRelationshipDef(
    {
      key,
      from_object: str(fd, 'from_object'),
      verb: str(fd, 'verb'),
      to_object: str(fd, 'to_object'),
      source_mapping: opt(fd, 'source_mapping'),
      provenance: prov,
      caveat,
    },
    EDITOR
  );
  revalidatePath('/admin/ontology');
  back(fd, { tab: 'relationships', sel: key });
}

export async function archiveRelationship(fd: FormData): Promise<void> {
  const key = str(fd, 'key');
  await setRelationshipStatus(key, str(fd, 'to') === 'active' ? 'active' : 'archived', EDITOR);
  revalidatePath('/admin/ontology');
  back(fd, { tab: 'relationships', sel: key });
}

export async function addField(fd: FormData): Promise<void> {
  const key = str(fd, 'key');
  const prov = provenance(fd);
  const caveat = opt(fd, 'caveat');
  if (!KEY_RE.test(key)) fail(fd, 'fields', 'Key must be lower_snake_case.');
  if (!str(fd, 'label')) fail(fd, 'fields', 'Label is required.');
  if (prov === 'derived' && !caveat)
    fail(fd, 'fields', 'A derived field requires a method/caveat.');
  await createFieldDef(
    {
      object_key: str(fd, 'object_key'),
      key,
      label: str(fd, 'label'),
      field_type: str(fd, 'field_type'),
      source_mapping: opt(fd, 'source_mapping'),
      provenance: prov,
      caveat,
    },
    EDITOR
  );
  revalidatePath('/admin/ontology');
  back(fd, { tab: 'fields', sel: `${str(fd, 'object_key')}.${key}` });
}

export async function archiveField(fd: FormData): Promise<void> {
  const objectKey = str(fd, 'object_key');
  const key = str(fd, 'key');
  await setFieldStatus(objectKey, key, str(fd, 'to') === 'active' ? 'active' : 'archived', EDITOR);
  revalidatePath('/admin/ontology');
  back(fd, { tab: 'fields', sel: `${objectKey}.${key}` });
}
