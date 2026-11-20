import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { after, before, test } from 'node:test';
import Database from 'better-sqlite3';
import { migrateDatabase } from './database/migrations.js';
import { seedDemoPatients } from './database/seed-demo.js';

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'familygene-api-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(temporaryDirectory, 'test.sqlite');
const { app } = await import('./app.js');
const { database } = await import('./database/connection.js');
let baseUrl = '';
let server: ReturnType<typeof app.listen>;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      baseUrl = `http://127.0.0.1:${address.port}/api`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  database.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

async function json(pathname: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

function patientInput(consent = false) {
  return {
    firstName: 'Jamie',
    lastName: 'Sample',
    dateOfBirth: '1988-04-16',
    sex: 'unknown',
    phone: null,
    email: null,
    county: 'Demo County',
    location: null,
    consultationReason: 'Synthetic consultation scenario',
    clinicalNote: 'Synthetic test note',
    consent: {
      granted: consent,
      obtainedAt: consent ? '2026-01-15' : null,
      recordedBy: consent ? 'Demo Clinician' : null,
      familyHistoryPermission: consent,
    },
  };
}

function relativeInput(relationship: 'mother' | 'father') {
  return {
    relationship,
    relationshipDetail: null,
    sex: relationship === 'mother' ? 'female' : 'male',
    status: 'alive',
    age: 62,
    ageAtDeath: null,
    informationUnknown: false,
    source: 'patient_reported',
    notes: null,
    conditions: relationship === 'mother' ? [{ name: 'Type 2 diabetes', ageAtOnset: 51 }] : [],
  };
}

test('validates input and requires explicit family-history permission', async () => {
  const invalid = await json('/patients', {
    method: 'POST',
    body: JSON.stringify({ ...patientInput(), dateOfBirth: '2099-01-01', email: 'not-an-email' }),
  });
  assert.equal(invalid.response.status, 400);
  assert.equal((invalid.body.error as { code: string }).code, 'VALIDATION_ERROR');

  const futureConsent = await json('/patients', {
    method: 'POST',
    body: JSON.stringify({
      ...patientInput(true),
      consent: { ...patientInput(true).consent, obtainedAt: '2099-01-01' },
    }),
  });
  assert.equal(futureConsent.response.status, 400);

  const created = await json('/patients', { method: 'POST', body: JSON.stringify(patientInput()) });
  assert.equal(created.response.status, 201);
  const patient = created.body.patient as { id: string; consentStatus: string };
  assert.equal(patient.consentStatus, 'not_granted');
  const blocked = await json(`/patients/${patient.id}/relatives`, {
    method: 'POST',
    body: JSON.stringify(relativeInput('mother')),
  });

  assert.equal(blocked.response.status, 403);
  assert.equal((blocked.body.error as { code: string }).code, 'CONSENT_REQUIRED');
});

test('seeds synthetic dashboard records with explicit ungranted consent', () => {
  const seedDatabase = new Database(':memory:');
  seedDatabase.pragma('foreign_keys = ON');
  migrateDatabase(seedDatabase);
  seedDemoPatients(seedDatabase);
  const patients = seedDatabase
    .prepare('SELECT id, family_history_status AS history, review_status AS review FROM patients')
    .all() as Array<{ id: string; history: string; review: string }>;
  assert.equal(patients.length, 8);
  assert.equal(patients.find((patient) => patient.id === 'DEMO-1042')?.history, 'Recorded');
  assert.equal(patients.find((patient) => patient.id === 'DEMO-1038')?.history, 'In progress');
  const consent = seedDatabase
    .prepare('SELECT status, family_history_permission FROM patient_consents WHERE patient_id = ?')
    .get('DEMO-1042') as { status: string; family_history_permission: number };
  assert.equal(consent.status, 'not_granted');
  assert.equal(consent.family_history_permission, 0);
  seedDatabase.close();
});

test('registers, updates, persists, and removes relatives with conditions', async () => {
  const registered = await json('/patients', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'phase3-patient-test-key' },
    body: JSON.stringify(patientInput(true)),
  });
  assert.equal(registered.response.status, 201);
  const patient = registered.body.patient as { id: string };

  const motherResult = await json(`/patients/${patient.id}/relatives`, {
    method: 'POST',
    body: JSON.stringify(relativeInput('mother')),
  });
  assert.equal(motherResult.response.status, 201);
  const mother = (motherResult.body.relatives as Array<{ id: string; conditions: unknown[] }>)[0];
  assert.equal(mother.conditions.length, 1);

  const fatherResult = await json(`/patients/${patient.id}/relatives`, {
    method: 'POST',
    body: JSON.stringify(relativeInput('father')),
  });
  assert.equal(fatherResult.response.status, 201);

  const updated = await json(`/patients/${patient.id}/relatives/${mother.id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...relativeInput('mother'), age: 63, informationUnknown: true }),
  });
  assert.equal(updated.response.status, 200);

  const persisted = await json(`/patients/${patient.id}`);
  const detail = persisted.body.patient as {
    consent: { status: string };
    relatives: Array<{
      id: string;
      age: number;
      informationUnknown: boolean;
      conditions: Array<{ name: string }>;
    }>;
    clinicalNotes: Array<{ text: string }>;
    history: unknown[];
  };
  assert.equal(detail.consent.status, 'granted');
  assert.equal(detail.relatives.length, 2);
  assert.equal(detail.relatives.find((relative) => relative.id === mother.id)?.age, 63);
  assert.equal(
    detail.relatives.find((relative) => relative.id === mother.id)?.informationUnknown,
    true,
  );
  assert.deepEqual(detail.relatives.find((relative) => relative.id === mother.id)?.conditions[0], {
    id: 5,
    name: 'Type 2 diabetes',
    isCustom: false,
    ageAtOnset: 51,
  });
  assert.equal(detail.clinicalNotes[0]?.text, 'Synthetic test note');
  assert.ok(detail.history.length >= 4);

  const removed = await json(`/patients/${patient.id}/relatives/${mother.id}`, {
    method: 'DELETE',
  });
  assert.equal(removed.response.status, 200);
  const afterDelete = (removed.body.patient as { relatives: unknown[] }).relatives;
  assert.equal(afterDelete.length, 1);

  const repeated = await json('/patients', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'phase3-patient-test-key' },
    body: JSON.stringify(patientInput(true)),
  });
  assert.equal(repeated.response.status, 200);
  assert.equal((repeated.body.patient as { id: string }).id, patient.id);
});
