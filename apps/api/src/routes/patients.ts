import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { CONDITION_OPTIONS, RELATIONSHIP_OPTIONS } from '@familygene/shared';
import type {
  BiologicalRelativeInput,
  ConsentStatus,
  FamilyHistoryStatus,
  InformationSource,
  PatientRegistrationInput,
  RelativeStatus,
  Sex,
} from '@familygene/shared';
import { database } from '../database/connection.js';
import { ApiError } from '../middleware/api-error.js';

type JsonObject = Record<string, unknown>;

const sexOptions: Sex[] = ['female', 'male', 'intersex', 'unknown', 'prefer_not_to_say'];
const sourceOptions: InformationSource[] = [
  'patient_reported',
  'documented',
  'clinically_verified',
  'unknown',
];
const relativeStatusOptions: RelativeStatus[] = ['alive', 'deceased', 'unknown'];

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(
  object: JsonObject,
  key: string,
  label: string,
  fields: Record<string, string>,
  max = 120,
): string {
  const value = object[key];
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) {
    fields[key] = `${label} is required and must be no more than ${max} characters.`;
    return '';
  }
  return value.trim();
}

function optionalText(
  object: JsonObject,
  key: string,
  label: string,
  fields: Record<string, string>,
  max = 500,
): string | null {
  const value = object[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    fields[key] = `${label} must be no more than ${max} characters.`;
    return null;
  }
  return value.trim() || null;
}

function optionalAge(
  object: JsonObject,
  key: string,
  label: string,
  fields: Record<string, string>,
): number | null {
  const value = object[key];
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 130) {
    fields[key] = `${label} must be a whole number between 0 and 130.`;
    return null;
  }
  return Number(value);
}

function validateDate(value: unknown, key: string, label: string, fields: Record<string, string>) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) ||
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
  ) {
    fields[key] = `${label} must be a valid date.`;
    return false;
  }
  return true;
}

function validateConsentDate(value: unknown, key: string, fields: Record<string, string>) {
  if (!validateDate(value, key, 'Consent date', fields)) return false;
  if (String(value) > new Date().toISOString().slice(0, 10)) {
    fields[key] = 'Consent date cannot be in the future.';
    return false;
  }
  return true;
}

function failFields(fields: Record<string, string>): void {
  if (Object.keys(fields).length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', fields);
  }
}

function makePatientId(): string {
  return `FG-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

function mapPatient(row: Record<string, unknown>) {
  const consentStatus = String(row.consent_status ?? 'not_granted') as ConsentStatus;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    dateOfBirth: row.date_of_birth,
    age: Math.max(
      0,
      new Date().getUTCFullYear() -
        new Date(String(row.date_of_birth)).getUTCFullYear() -
        (new Date().toISOString().slice(5, 10) < String(row.date_of_birth).slice(5, 10) ? 1 : 0),
    ),
    sex: row.sex,
    county: row.county,
    location: row.location,
    registeredAt: row.created_at,
    familyHistory: row.family_history_status as FamilyHistoryStatus,
    reviewStatus: row.review_status,
    consentStatus,
    familyHistoryPermission: Boolean(row.family_history_permission),
    relativesCount: Number(row.relatives_count ?? 0),
  };
}

function patientSelect(where = ''): string {
  return `
    SELECT p.*, c.status AS consent_status,
      c.family_history_permission AS family_history_permission,
      (SELECT COUNT(*) FROM biological_relatives r WHERE r.patient_id = p.id) AS relatives_count
    FROM patients p
    LEFT JOIN patient_consents c ON c.patient_id = p.id
    ${where}
  `;
}

function getPatientRow(id: string): Record<string, unknown> | undefined {
  return database.prepare(patientSelect('WHERE p.id = ?')).get(id) as
    Record<string, unknown> | undefined;
}

function ensurePatient(id: string): Record<string, unknown> {
  const patient = getPatientRow(id);
  if (!patient) throw new ApiError(404, 'PATIENT_NOT_FOUND', 'Patient record was not found.');
  return patient;
}

function ensureHistoryPermission(id: string): void {
  const consent = database
    .prepare(
      'SELECT family_history_permission FROM patient_consents WHERE patient_id = ? AND status = ?',
    )
    .get(id, 'granted') as { family_history_permission: number } | undefined;
  if (!consent?.family_history_permission) {
    throw new ApiError(
      403,
      'CONSENT_REQUIRED',
      'Recorded permission to collect family history is required before adding relatives.',
    );
  }
}

function addHistory(patientId: string, eventType: string, summary: string): void {
  database
    .prepare(
      'INSERT INTO patient_history (id, patient_id, event_type, summary, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(randomUUID(), patientId, eventType, summary, new Date().toISOString());
}

function parsePatientInput(body: unknown): PatientRegistrationInput {
  if (!isObject(body)) throw new ApiError(400, 'VALIDATION_ERROR', 'A JSON object is required.');
  const fields: Record<string, string> = {};
  const firstName = requiredText(body, 'firstName', 'First name', fields, 70);
  const lastName = requiredText(body, 'lastName', 'Last name', fields, 70);
  const dateOfBirth = body.dateOfBirth;
  if (
    validateDate(dateOfBirth, 'dateOfBirth', 'Date of birth', fields) &&
    String(dateOfBirth) > new Date().toISOString().slice(0, 10)
  ) {
    fields.dateOfBirth = 'Date of birth cannot be in the future.';
  }
  const sex = body.sex;
  if (typeof sex !== 'string' || !sexOptions.includes(sex as Sex)) {
    fields.sex = 'Select a valid sex value.';
  }
  const phone = optionalText(body, 'phone', 'Phone number', fields, 30);
  if (phone && !/^[+()\d.\-\s]{7,30}$/.test(phone)) fields.phone = 'Enter a valid phone number.';
  const email = optionalText(body, 'email', 'Email address', fields, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fields.email = 'Enter a valid email address.';
  const county = optionalText(body, 'county', 'County', fields, 100);
  const location = optionalText(body, 'location', 'Location', fields, 120);
  const consultationReason = requiredText(
    body,
    'consultationReason',
    'Consultation reason',
    fields,
  );
  const clinicalNote = optionalText(body, 'clinicalNote', 'Clinical note', fields, 3000);
  let consent: PatientRegistrationInput['consent'] = {
    granted: false,
    obtainedAt: null,
    recordedBy: null,
    familyHistoryPermission: false,
  };
  if (!isObject(body.consent)) {
    fields.consent = 'Consent status must be explicitly provided.';
  } else {
    const granted = body.consent.granted;
    const permission = body.consent.familyHistoryPermission;
    const obtainedAt = body.consent.obtainedAt;
    const recordedBy = body.consent.recordedBy;
    if (typeof granted !== 'boolean')
      fields.consent = 'Consent status must be explicitly provided.';
    if (typeof permission !== 'boolean')
      fields.familyHistoryPermission = 'Select whether permission was obtained.';
    if (granted && permission !== true) {
      fields.familyHistoryPermission = 'Permission to document family history must be confirmed.';
    }
    if (granted && !validateConsentDate(obtainedAt, 'obtainedAt', fields)) {
      fields.obtainedAt ||= 'Enter the date consent was obtained.';
    }
    if (
      granted &&
      (typeof recordedBy !== 'string' || !recordedBy.trim() || recordedBy.length > 120)
    ) {
      fields.recordedBy = 'Enter the healthcare professional recording consent.';
    }
    consent = {
      granted: granted === true,
      obtainedAt: typeof obtainedAt === 'string' ? obtainedAt : null,
      recordedBy: typeof recordedBy === 'string' ? recordedBy.trim() : null,
      familyHistoryPermission: permission === true,
    };
  }
  failFields(fields);
  return {
    firstName,
    lastName,
    dateOfBirth: String(dateOfBirth),
    sex: sex as Sex,
    phone,
    email,
    county,
    location,
    consultationReason,
    consent,
    clinicalNote,
  };
}

function parseRelativeInput(body: unknown): BiologicalRelativeInput {
  if (!isObject(body)) throw new ApiError(400, 'VALIDATION_ERROR', 'A JSON object is required.');
  const fields: Record<string, string> = {};
  const relationship = body.relationship;
  if (
    typeof relationship !== 'string' ||
    !RELATIONSHIP_OPTIONS.includes(relationship as (typeof RELATIONSHIP_OPTIONS)[number])
  ) {
    fields.relationship = 'Select a supported biological relationship.';
  }
  const relationshipDetail = optionalText(
    body,
    'relationshipDetail',
    'Relationship detail',
    fields,
    120,
  );
  if (relationship === 'other_biological_relative' && !relationshipDetail) {
    fields.relationshipDetail = 'Describe the biological relationship.';
  }
  const sex = body.sex;
  if (typeof sex !== 'string' || !sexOptions.includes(sex as Sex))
    fields.sex = 'Select a valid sex value.';
  const status = body.status;
  if (typeof status !== 'string' || !relativeStatusOptions.includes(status as RelativeStatus)) {
    fields.status = 'Select a valid status.';
  }
  const age = optionalAge(body, 'age', 'Age', fields);
  const ageAtDeath = optionalAge(body, 'ageAtDeath', 'Age at death', fields);
  if (status !== 'deceased' && ageAtDeath !== null) {
    fields.ageAtDeath = 'Age at death is only applicable when the relative is deceased.';
  }
  if (
    status === 'deceased' &&
    ageAtDeath === null &&
    body.ageAtDeath !== null &&
    body.ageAtDeath !== ''
  ) {
    fields.ageAtDeath ||= 'Age at death must be between 0 and 130.';
  }
  if (age !== null && ageAtDeath !== null && ageAtDeath > age) {
    fields.ageAtDeath = 'Age at death cannot exceed current or approximate age.';
  }
  const informationUnknown = body.informationUnknown;
  if (typeof informationUnknown !== 'boolean')
    fields.informationUnknown = 'Select whether information is unknown.';
  const source = body.source;
  if (typeof source !== 'string' || !sourceOptions.includes(source as InformationSource)) {
    fields.source = 'Select an information source.';
  }
  const notes = optionalText(body, 'notes', 'Notes', fields, 2000);
  const conditions: BiologicalRelativeInput['conditions'] = [];
  if (!Array.isArray(body.conditions)) {
    fields.conditions = 'Conditions must be a list.';
  } else {
    body.conditions.forEach((value, index) => {
      const key = `conditions.${index}`;
      if (!isObject(value)) {
        fields[key] = 'Condition entry is invalid.';
        return;
      }
      const name = value.name;
      const ageAtOnset = optionalAge(value, 'ageAtOnset', 'Age at onset', fields);
      if (
        typeof name !== 'string' ||
        !CONDITION_OPTIONS.includes(name as (typeof CONDITION_OPTIONS)[number])
      ) {
        fields[`${key}.name`] = 'Select a supported health condition.';
        return;
      }
      const customName = optionalText(value, 'customName', 'Custom condition', fields, 120);
      if (name === 'Other condition' && !customName) {
        fields[`${key}.customName`] = 'Enter the condition name.';
      }
      conditions.push({
        name: name as BiologicalRelativeInput['conditions'][number]['name'],
        customName: customName ?? undefined,
        ageAtOnset,
      });
    });
  }
  failFields(fields);
  return {
    relationship: relationship as BiologicalRelativeInput['relationship'],
    relationshipDetail,
    sex: sex as Sex,
    status: status as RelativeStatus,
    age,
    ageAtDeath,
    informationUnknown: informationUnknown as boolean,
    source: source as InformationSource,
    notes,
    conditions,
  };
}

function replaceRelativeConditions(
  relativeId: string,
  conditions: BiologicalRelativeInput['conditions'],
): void {
  database.prepare('DELETE FROM relative_conditions WHERE relative_id = ?').run(relativeId);
  const insertCondition = database.prepare(
    `INSERT INTO health_conditions (name, is_custom) VALUES (?, 1)
     ON CONFLICT(name) DO NOTHING`,
  );
  const getCondition = database.prepare('SELECT id FROM health_conditions WHERE name = ?');
  const insertAssociation = database.prepare(
    'INSERT INTO relative_conditions (relative_id, condition_id, age_at_onset) VALUES (?, ?, ?)',
  );
  for (const condition of conditions) {
    const name = condition.name === 'Other condition' ? condition.customName! : condition.name;
    if (condition.name === 'Other condition') insertCondition.run(name);
    const record = getCondition.get(name) as { id: number } | undefined;
    if (!record)
      throw new ApiError(400, 'INVALID_CONDITION', 'The selected condition is not available.');
    insertAssociation.run(relativeId, record.id, condition.ageAtOnset);
  }
}

function getRelatives(patientId: string) {
  const relatives = database
    .prepare('SELECT * FROM biological_relatives WHERE patient_id = ? ORDER BY created_at')
    .all(patientId) as Record<string, unknown>[];
  const conditionsQuery = database.prepare(`
    SELECT hc.id, hc.name, hc.is_custom AS isCustom, rc.age_at_onset AS ageAtOnset
    FROM relative_conditions rc JOIN health_conditions hc ON hc.id = rc.condition_id
    WHERE rc.relative_id = ?
  `);
  return relatives.map((relative) => ({
    id: relative.id,
    patientId: relative.patient_id,
    relationship: relative.relationship,
    relationshipDetail: relative.relationship_detail,
    sex: relative.sex,
    status: relative.status,
    age: relative.age,
    ageAtDeath: relative.age_at_death,
    informationUnknown: Boolean(relative.information_unknown),
    source: relative.information_source,
    notes: relative.notes,
    createdAt: relative.created_at,
    updatedAt: relative.updated_at,
    conditions: (conditionsQuery.all(relative.id) as Array<Record<string, unknown>>).map(
      (condition) => ({ ...condition, isCustom: Boolean(condition.isCustom) }),
    ),
  }));
}

function getDetail(patient: Record<string, unknown>) {
  const patientId = String(patient.id);
  const consent = database
    .prepare('SELECT * FROM patient_consents WHERE patient_id = ?')
    .get(patientId) as Record<string, unknown> | undefined;
  const clinicalNotes = database
    .prepare('SELECT * FROM clinical_notes WHERE patient_id = ? ORDER BY created_at DESC')
    .all(patientId) as Record<string, unknown>[];
  const history = database
    .prepare('SELECT * FROM patient_history WHERE patient_id = ? ORDER BY created_at DESC')
    .all(patientId) as Record<string, unknown>[];
  const relatives = getRelatives(patientId);
  const missingInformation: string[] = [];
  if (!patient.phone && !patient.email)
    missingInformation.push('No phone or email contact recorded.');
  if (!consent || consent.status !== 'granted')
    missingInformation.push('Family-history consent has not been granted.');
  if (relatives.some((relative) => relative.informationUnknown)) {
    missingInformation.push('Some relative information is explicitly unknown.');
  }
  if (relatives.some((relative) => relative.source === 'unknown')) {
    missingInformation.push('Some family-history information has no recorded source.');
  }
  if (!relatives.length) missingInformation.push('No biological relatives have been recorded.');
  return {
    ...mapPatient(patient),
    phone: patient.phone,
    email: patient.email,
    consultationReason: patient.consultation_reason,
    consent: {
      status: consent?.status ?? 'not_granted',
      obtainedAt: consent?.obtained_at ?? null,
      recordedBy: consent?.recorded_by ?? null,
      familyHistoryPermission: Boolean(consent?.family_history_permission),
      updatedAt: consent?.updated_at ?? patient.updated_at,
    },
    relatives,
    clinicalNotes: clinicalNotes.map((note) => ({
      id: note.id,
      text: note.note,
      recordedBy: note.recorded_by,
      createdAt: note.created_at,
    })),
    history: history.map((event) => ({
      id: event.id,
      eventType: event.event_type,
      summary: event.summary,
      recordedBy: event.recorded_by,
      createdAt: event.created_at,
    })),
    missingInformation,
  };
}

export const patientsRouter = Router();

patientsRouter.get('/conditions', (_request, response) => {
  const conditions = database
    .prepare(
      'SELECT id, name, is_custom AS isCustom FROM health_conditions ORDER BY is_custom, name',
    )
    .all();
  response.json({ conditions });
});

patientsRouter.get('/', (request: Request, response: Response) => {
  const search = typeof request.query.q === 'string' ? `%${request.query.q.trim()}%` : null;
  const rows = database
    .prepare(
      `${patientSelect(search ? 'WHERE p.id LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ?' : '')}
       ORDER BY p.created_at DESC`,
    )
    .all(...(search ? [search, search, search] : [])) as Record<string, unknown>[];
  response.json({ patients: rows.map(mapPatient) });
});

patientsRouter.post('/', (request: Request, response: Response) => {
  const input = parsePatientInput(request.body);
  const idempotencyKey = request.header('Idempotency-Key')?.slice(0, 100) ?? null;
  if (idempotencyKey) {
    const existing = database
      .prepare(patientSelect('WHERE p.idempotency_key = ?'))
      .get(idempotencyKey) as Record<string, unknown> | undefined;
    if (existing) {
      response.status(200).json({ patient: mapPatient(existing) });
      return;
    }
  }

  const id = makePatientId();
  const now = new Date().toISOString();
  const save = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO patients (
          id, idempotency_key, first_name, last_name, date_of_birth, sex, phone, email,
          county, location, consultation_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        idempotencyKey,
        input.firstName,
        input.lastName,
        input.dateOfBirth,
        input.sex,
        input.phone,
        input.email,
        input.county,
        input.location,
        input.consultationReason,
        now,
        now,
      );
    database
      .prepare(
        `INSERT INTO patient_consents (
          id, patient_id, status, obtained_at, recorded_by, family_history_permission, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        id,
        input.consent.granted ? 'granted' : 'not_granted',
        input.consent.granted ? input.consent.obtainedAt : null,
        input.consent.granted ? input.consent.recordedBy : null,
        input.consent.granted && input.consent.familyHistoryPermission ? 1 : 0,
        now,
      );
    addHistory(id, 'patient_registered', 'Patient record registered.');
    if (input.clinicalNote) {
      database
        .prepare(
          'INSERT INTO clinical_notes (id, patient_id, note, created_at) VALUES (?, ?, ?, ?)',
        )
        .run(randomUUID(), id, input.clinicalNote, now);
      addHistory(id, 'clinical_note_added', 'Clinical note recorded.');
    }
  });
  save();
  response.status(201).json({ patient: mapPatient(ensurePatient(id)) });
});

patientsRouter.get('/:patientId', (request, response) => {
  response.json({ patient: getDetail(ensurePatient(request.params.patientId)) });
});

patientsRouter.put('/:patientId/consent', (request, response) => {
  const patient = ensurePatient(request.params.patientId);
  if (!isObject(request.body))
    throw new ApiError(400, 'VALIDATION_ERROR', 'A JSON object is required.');
  const fields: Record<string, string> = {};
  const granted = request.body.granted;
  const permission = request.body.familyHistoryPermission;
  const obtainedAt = request.body.obtainedAt;
  const recordedBy = request.body.recordedBy;
  if (typeof granted !== 'boolean') fields.granted = 'Select a consent status.';
  if (typeof permission !== 'boolean')
    fields.familyHistoryPermission = 'Select whether permission was obtained.';
  if (granted && permission !== true)
    fields.familyHistoryPermission = 'Confirm permission to document family history.';
  if (granted && !validateConsentDate(obtainedAt, 'obtainedAt', fields)) {
    fields.obtainedAt ||= 'Enter the date consent was obtained.';
  }
  if (
    granted &&
    (typeof recordedBy !== 'string' || !recordedBy.trim() || recordedBy.length > 120)
  ) {
    fields.recordedBy = 'Enter the healthcare professional recording consent.';
  }
  failFields(fields);
  const now = new Date().toISOString();
  database
    .prepare(
      `UPDATE patient_consents SET status = ?, obtained_at = ?, recorded_by = ?,
       family_history_permission = ?, updated_at = ? WHERE patient_id = ?`,
    )
    .run(
      granted ? 'granted' : 'not_granted',
      granted ? obtainedAt : null,
      granted ? String(recordedBy).trim() : null,
      granted && permission ? 1 : 0,
      now,
      patient.id,
    );
  database.prepare('UPDATE patients SET updated_at = ? WHERE id = ?').run(now, patient.id);
  addHistory(
    String(patient.id),
    'consent_updated',
    granted ? 'Family-history consent granted.' : 'Consent not granted.',
  );
  response.json({ patient: getDetail(ensurePatient(String(patient.id))) });
});

patientsRouter.post('/:patientId/notes', (request, response) => {
  const patient = ensurePatient(request.params.patientId);
  if (!isObject(request.body))
    throw new ApiError(400, 'VALIDATION_ERROR', 'A JSON object is required.');
  const fields: Record<string, string> = {};
  const text = requiredText(request.body, 'text', 'Clinical note', fields, 3000);
  const recordedBy = optionalText(request.body, 'recordedBy', 'Recorded by', fields, 120);
  failFields(fields);
  const now = new Date().toISOString();
  const id = randomUUID();
  database.transaction(() => {
    database
      .prepare(
        'INSERT INTO clinical_notes (id, patient_id, note, recorded_by, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, patient.id, text, recordedBy, now);
    addHistory(String(patient.id), 'clinical_note_added', 'Clinical note recorded.');
    database.prepare('UPDATE patients SET updated_at = ? WHERE id = ?').run(now, patient.id);
  })();
  response.status(201).json({ patient: getDetail(ensurePatient(String(patient.id))) });
});

patientsRouter.post('/:patientId/relatives', (request, response) => {
  const patient = ensurePatient(request.params.patientId);
  ensureHistoryPermission(String(patient.id));
  const input = parseRelativeInput(request.body);
  const id = randomUUID();
  const now = new Date().toISOString();
  database.transaction(() => {
    database
      .prepare(
        `INSERT INTO biological_relatives (
          id, patient_id, relationship, relationship_detail, sex, status, age, age_at_death,
          information_unknown, information_source, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        patient.id,
        input.relationship,
        input.relationshipDetail,
        input.sex,
        input.status,
        input.age,
        input.ageAtDeath,
        input.informationUnknown ? 1 : 0,
        input.source,
        input.notes,
        now,
        now,
      );
    replaceRelativeConditions(id, input.conditions);
    database
      .prepare(
        "UPDATE patients SET family_history_status = 'In progress', updated_at = ? WHERE id = ?",
      )
      .run(now, patient.id);
    addHistory(String(patient.id), 'relative_added', 'Biological relative information added.');
  })();
  response.status(201).json({
    relatives: getRelatives(String(patient.id)),
    patient: getDetail(ensurePatient(String(patient.id))),
  });
});

patientsRouter.put('/:patientId/relatives/:relativeId', (request, response) => {
  const patient = ensurePatient(request.params.patientId);
  ensureHistoryPermission(String(patient.id));
  const relative = database
    .prepare('SELECT id FROM biological_relatives WHERE id = ? AND patient_id = ?')
    .get(request.params.relativeId, patient.id);
  if (!relative)
    throw new ApiError(404, 'RELATIVE_NOT_FOUND', 'Biological relative was not found.');
  const input = parseRelativeInput(request.body);
  const now = new Date().toISOString();
  database.transaction(() => {
    database
      .prepare(
        `UPDATE biological_relatives SET relationship = ?, relationship_detail = ?, sex = ?,
         status = ?, age = ?, age_at_death = ?, information_unknown = ?, information_source = ?,
         notes = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        input.relationship,
        input.relationshipDetail,
        input.sex,
        input.status,
        input.age,
        input.ageAtDeath,
        input.informationUnknown ? 1 : 0,
        input.source,
        input.notes,
        now,
        request.params.relativeId,
      );
    replaceRelativeConditions(request.params.relativeId, input.conditions);
    database.prepare('UPDATE patients SET updated_at = ? WHERE id = ?').run(now, patient.id);
    addHistory(String(patient.id), 'relative_updated', 'Biological relative information updated.');
  })();
  response.json({
    relatives: getRelatives(String(patient.id)),
    patient: getDetail(ensurePatient(String(patient.id))),
  });
});

patientsRouter.delete('/:patientId/relatives/:relativeId', (request, response) => {
  const patient = ensurePatient(request.params.patientId);
  ensureHistoryPermission(String(patient.id));
  const relative = database
    .prepare('SELECT id FROM biological_relatives WHERE id = ? AND patient_id = ?')
    .get(request.params.relativeId, patient.id);
  if (!relative)
    throw new ApiError(404, 'RELATIVE_NOT_FOUND', 'Biological relative was not found.');
  const now = new Date().toISOString();
  database.transaction(() => {
    database
      .prepare('DELETE FROM biological_relatives WHERE id = ?')
      .run(request.params.relativeId);
    const remaining = database
      .prepare('SELECT COUNT(*) AS count FROM biological_relatives WHERE patient_id = ?')
      .get(patient.id) as { count: number };
    database
      .prepare('UPDATE patients SET family_history_status = ?, updated_at = ? WHERE id = ?')
      .run(remaining.count ? 'In progress' : 'Not started', now, patient.id);
    addHistory(String(patient.id), 'relative_removed', 'Biological relative information removed.');
  })();
  response.json({ patient: getDetail(ensurePatient(String(patient.id))) });
});
