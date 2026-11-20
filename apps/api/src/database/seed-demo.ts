import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

const demoPatients = [
  {
    id: 'DEMO-1042',
    firstName: 'Jordan',
    lastName: 'Ellis',
    age: 42,
    registeredAt: '2025-11-14',
    reviewStatus: 'Awaiting review',
    familyHistory: 'Recorded',
  },
  {
    id: 'DEMO-1038',
    firstName: 'Riley',
    lastName: 'Chen',
    age: 36,
    registeredAt: '2025-11-12',
    reviewStatus: 'Reviewed',
    familyHistory: 'In progress',
  },
  {
    id: 'DEMO-1031',
    firstName: 'Casey',
    lastName: 'Patel',
    age: 58,
    registeredAt: '2025-11-10',
    reviewStatus: 'Not required',
    familyHistory: 'Recorded',
  },
  {
    id: 'DEMO-1027',
    firstName: 'Avery',
    lastName: 'Brooks',
    age: 29,
    registeredAt: '2025-11-08',
    reviewStatus: 'Awaiting review',
    familyHistory: 'Not started',
  },
  {
    id: 'DEMO-1021',
    firstName: 'Taylor',
    lastName: 'Nguyen',
    age: 47,
    registeredAt: '2025-11-06',
    reviewStatus: 'Reviewed',
    familyHistory: 'In progress',
  },
  {
    id: 'DEMO-1015',
    firstName: 'Quinn',
    lastName: 'Rivera',
    age: 51,
    registeredAt: '2025-11-03',
    reviewStatus: 'Not required',
    familyHistory: 'Recorded',
  },
  {
    id: 'DEMO-1012',
    firstName: 'Morgan',
    lastName: 'James',
    age: 33,
    registeredAt: '2025-10-30',
    reviewStatus: 'Awaiting review',
    familyHistory: 'In progress',
  },
  {
    id: 'DEMO-1008',
    firstName: 'Drew',
    lastName: 'Campbell',
    age: 61,
    registeredAt: '2025-10-28',
    reviewStatus: 'Awaiting review',
    familyHistory: 'Recorded',
  },
] as const;

export function seedDemoPatients(database: Database.Database): void {
  const patientCount = database.prepare('SELECT COUNT(*) AS count FROM patients').get() as {
    count: number;
  };
  if (patientCount.count > 0) return;

  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const insertPatient = database.prepare(`
    INSERT INTO patients (
      id, first_name, last_name, date_of_birth, sex, consultation_reason,
      family_history_status, review_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'unknown', 'Synthetic demonstration record',
      ?, ?, ?, ?)
  `);
  const insertConsent = database.prepare(`
    INSERT INTO patient_consents (
      id, patient_id, status, family_history_permission, updated_at
    ) VALUES (?, ?, 'not_granted', 0, ?)
  `);
  const insertHistory = database.prepare(`
    INSERT INTO patient_history (
      id, patient_id, event_type, summary, created_at
    ) VALUES (?, ?, 'patient_registered', 'Synthetic demonstration patient registered', ?)
  `);

  database.transaction(() => {
    for (const patient of demoPatients) {
      const birthDate = new Date(`${currentDate}T00:00:00.000Z`);
      birthDate.setUTCFullYear(birthDate.getUTCFullYear() - patient.age);
      const dateOfBirth = birthDate.toISOString().slice(0, 10);
      const registeredAt = `${patient.registeredAt}T12:00:00.000Z`;

      insertPatient.run(
        patient.id,
        patient.firstName,
        patient.lastName,
        dateOfBirth,
        patient.familyHistory,
        patient.reviewStatus,
        registeredAt,
        registeredAt,
      );
      insertConsent.run(randomUUID(), patient.id, registeredAt);
      insertHistory.run(randomUUID(), patient.id, registeredAt);
    }
  })();
}
