import type Database from 'better-sqlite3';

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE patients (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth TEXT NOT NULL,
        sex TEXT NOT NULL CHECK (sex IN ('female', 'male', 'intersex', 'unknown', 'prefer_not_to_say')),
        phone TEXT,
        email TEXT,
        county TEXT,
        location TEXT,
        consultation_reason TEXT NOT NULL,
        family_history_status TEXT NOT NULL DEFAULT 'Not started'
          CHECK (family_history_status IN ('Not started', 'In progress', 'Recorded')),
        review_status TEXT NOT NULL DEFAULT 'Not required'
          CHECK (review_status IN ('Reviewed', 'Awaiting review', 'Not required')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE patient_consents (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('granted', 'not_granted')),
        obtained_at TEXT,
        recorded_by TEXT,
        family_history_permission INTEGER NOT NULL DEFAULT 0
          CHECK (family_history_permission IN (0, 1)),
        updated_at TEXT NOT NULL,
        CHECK (
          (status = 'granted' AND obtained_at IS NOT NULL AND recorded_by IS NOT NULL)
          OR
          (status = 'not_granted' AND obtained_at IS NULL AND recorded_by IS NULL
            AND family_history_permission = 0)
        )
      );

      CREATE TABLE biological_relatives (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        relationship TEXT NOT NULL CHECK (relationship IN (
          'mother', 'father', 'maternal_grandmother', 'maternal_grandfather',
          'paternal_grandmother', 'paternal_grandfather', 'sister', 'brother',
          'daughter', 'son', 'maternal_aunt', 'maternal_uncle', 'paternal_aunt',
          'paternal_uncle', 'other_biological_relative'
        )),
        relationship_detail TEXT,
        sex TEXT NOT NULL CHECK (sex IN ('female', 'male', 'intersex', 'unknown', 'prefer_not_to_say')),
        status TEXT NOT NULL CHECK (status IN ('alive', 'deceased', 'unknown')),
        age INTEGER CHECK (age IS NULL OR age BETWEEN 0 AND 130),
        age_at_death INTEGER CHECK (age_at_death IS NULL OR age_at_death BETWEEN 0 AND 130),
        information_unknown INTEGER NOT NULL DEFAULT 0 CHECK (information_unknown IN (0, 1)),
        information_source TEXT NOT NULL CHECK (information_source IN (
          'patient_reported', 'documented', 'clinically_verified', 'unknown'
        )),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE health_conditions (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1))
      );

      CREATE TABLE relative_conditions (
        relative_id TEXT NOT NULL REFERENCES biological_relatives(id) ON DELETE CASCADE,
        condition_id INTEGER NOT NULL REFERENCES health_conditions(id),
        age_at_onset INTEGER CHECK (age_at_onset IS NULL OR age_at_onset BETWEEN 0 AND 130),
        PRIMARY KEY (relative_id, condition_id)
      );

      CREATE TABLE clinical_notes (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        recorded_by TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE patient_history (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        relative_id TEXT REFERENCES biological_relatives(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        recorded_by TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_patients_name ON patients(last_name, first_name);
      CREATE INDEX idx_relatives_patient ON biological_relatives(patient_id);
      CREATE INDEX idx_relative_conditions_relative ON relative_conditions(relative_id);
      CREATE INDEX idx_clinical_notes_patient ON clinical_notes(patient_id, created_at);
      CREATE INDEX idx_patient_history_patient ON patient_history(patient_id, created_at);

      INSERT INTO health_conditions (name, is_custom) VALUES
        ('Sickle cell disease', 0),
        ('Thalassemia', 0),
        ('Breast cancer', 0),
        ('Colorectal cancer', 0),
        ('Type 2 diabetes', 0),
        ('Hypertension', 0),
        ('Heart disease', 0),
        ('Stroke', 0),
        ('No known condition', 0),
        ('Unknown', 0);
    `,
  },
  {
    version: 2,
    sql: `
      UPDATE patients
      SET family_history_status = CASE id
        WHEN 'DEMO-1042' THEN 'Recorded'
        WHEN 'DEMO-1038' THEN 'In progress'
        WHEN 'DEMO-1031' THEN 'Recorded'
        WHEN 'DEMO-1027' THEN 'Not started'
        WHEN 'DEMO-1021' THEN 'In progress'
        WHEN 'DEMO-1015' THEN 'Recorded'
        WHEN 'DEMO-1012' THEN 'In progress'
        WHEN 'DEMO-1008' THEN 'Recorded'
      END
      WHERE consultation_reason = 'Synthetic demonstration record'
        AND id IN (
          'DEMO-1042', 'DEMO-1038', 'DEMO-1031', 'DEMO-1027',
          'DEMO-1021', 'DEMO-1015', 'DEMO-1012', 'DEMO-1008'
        );
    `,
  },
];

export function migrateDatabase(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const isApplied = database.prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
  const recordMigration = database.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  );

  for (const migration of migrations) {
    if (isApplied.get(migration.version)) continue;

    database.transaction(() => {
      database.exec(migration.sql);
      recordMigration.run(migration.version, new Date().toISOString());
    })();
  }
}
