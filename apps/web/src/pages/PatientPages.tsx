import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FilePlus2,
  Info,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CONDITION_OPTIONS, RELATIONSHIP_OPTIONS } from '@familygene/shared';
import type {
  BiologicalRelative,
  BiologicalRelativeInput,
  ConditionOption,
  InformationSource,
  PatientDetail,
  PatientRegistrationInput,
  RelativeConditionInput,
  RelativeStatus,
  Sex,
} from '@familygene/shared';
import type { FamilyHistoryStatus, Patient } from '../data/types';
import { demoReviews } from '../data/demo-data';
import { EmptyState } from '../components/FeedbackStates';
import { PageHeader } from '../components/PageHeader';
import { PatientTable } from '../components/PatientTable';
import { ReviewQueue } from '../components/ReviewQueue';
import { StatusBadge } from '../components/StatusBadge';
import {
  ApiClientError,
  getPatient,
  isStaticDemo,
  listPatients,
  removeRelative,
  saveConsent,
  saveRelative,
} from '../services/api';

const historyFilters: Array<'All statuses' | FamilyHistoryStatus> = [
  'All statuses',
  'Recorded',
  'In progress',
  'Not started',
];
const sexOptions: Array<[Sex, string]> = [
  ['unknown', 'Unknown'],
  ['female', 'Female'],
  ['male', 'Male'],
  ['intersex', 'Intersex'],
  ['prefer_not_to_say', 'Prefer not to say'],
];
const relationshipLabels: Record<(typeof RELATIONSHIP_OPTIONS)[number], string> = {
  mother: 'Mother',
  father: 'Father',
  maternal_grandmother: 'Maternal grandmother',
  maternal_grandfather: 'Maternal grandfather',
  paternal_grandmother: 'Paternal grandmother',
  paternal_grandfather: 'Paternal grandfather',
  sister: 'Sister',
  brother: 'Brother',
  daughter: 'Daughter',
  son: 'Son',
  maternal_aunt: 'Maternal aunt',
  maternal_uncle: 'Maternal uncle',
  paternal_aunt: 'Paternal aunt',
  paternal_uncle: 'Paternal uncle',
  other_biological_relative: 'Other biological relative',
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function usePatient(patientId: string | undefined) {
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loadedPatientId, setLoadedPatientId] = useState<string>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      setPatient(await getPatient(patientId));
      setLoadedPatientId(patientId);
      setError('');
    } catch (loadError) {
      setError(messageOf(loadError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!patientId) return;
    let active = true;
    getPatient(patientId)
      .then((record) => {
        if (active) {
          setPatient(record);
          setLoadedPatientId(patientId);
          setError('');
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(messageOf(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId]);
  return {
    patient: loadedPatientId === patientId ? patient : null,
    setPatient,
    error,
    loading: loading || (!!patientId && loadedPatientId !== patientId && !error),
    refresh,
  };
}

export function PatientsPage({ patients }: { patients: Patient[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const [status, setStatus] = useState<(typeof historyFilters)[number]>('All statuses');
  const filteredPatients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesSearch =
        !normalizedSearch ||
        patient.name.toLowerCase().includes(normalizedSearch) ||
        patient.id.toLowerCase().includes(normalizedSearch);
      return matchesSearch && (status === 'All statuses' || patient.familyHistory === status);
    });
  }, [patients, search, status]);

  return (
    <>
      <PageHeader
        title="Patients"
        description="Browse and manage synthetic patient records in this demonstration workspace."
        action={
          !isStaticDemo && (
            <Link className="button button--primary" to="/patients/new">
              <FilePlus2 size={17} /> Register patient
            </Link>
          )
        }
      />
      <section className="surface-card patient-list-card">
        <div className="list-toolbar">
          <label className="filter-search">
            <Search aria-hidden="true" size={17} />
            <span className="visually-hidden">Search patients by name or ID</span>
            <input
              onChange={(event) => {
                const value = event.target.value;
                setSearchParams(value ? { q: value } : {}, { replace: true });
              }}
              placeholder="Search by name or patient ID"
              value={search}
            />
          </label>
          <label className="filter-select">
            <span>Family history</span>
            <select
              onChange={(event) => setStatus(event.target.value as (typeof historyFilters)[number])}
              value={status}
            >
              {historyFilters.map((filter) => (
                <option key={filter}>{filter}</option>
              ))}
            </select>
          </label>
          <span aria-live="polite" className="result-count">
            {filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'}
          </span>
        </div>
        {filteredPatients.length ? (
          <PatientTable patients={filteredPatients} />
        ) : (
          <EmptyState
            title="No patients match your search"
            description="Try a different name, patient ID, or family-history status."
            action={
              <button
                className="button button--secondary"
                onClick={() => {
                  setSearchParams({}, { replace: true });
                  setStatus('All statuses');
                }}
                type="button"
              >
                Clear filters
              </button>
            }
          />
        )}
      </section>
      <p className="clinical-note">
        Synthetic demonstration records only. No real patient data is shown.
      </p>
    </>
  );
}

export function RegisterPatientPage({
  onRegister,
}: {
  onRegister: (input: PatientRegistrationInput, idempotencyKey: string) => Promise<{ id: string }>;
}) {
  const navigate = useNavigate();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  const [familyPermission, setFamilyPermission] = useState(false);
  const [consentDate, setConsentDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    sex: 'unknown' as Sex,
    phone: '',
    email: '',
    county: '',
    location: '',
    consultationReason: '',
    clinicalNote: '',
    recordedBy: '',
  });
  const today = new Date().toISOString().slice(0, 10);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setFields((current) => ({ ...current, [key]: '' }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const patient = await onRegister(
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth,
          sex: form.sex,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          county: form.county.trim() || null,
          location: form.location.trim() || null,
          consultationReason: form.consultationReason.trim(),
          clinicalNote: form.clinicalNote.trim() || null,
          consent: {
            granted: consentGranted,
            obtainedAt: consentGranted ? consentDate : null,
            recordedBy: consentGranted ? form.recordedBy.trim() : null,
            familyHistoryPermission: consentGranted && familyPermission,
          },
        },
        idempotencyKey.current,
      );
      navigate(`/patients/${patient.id}`);
    } catch (submitError) {
      setError(messageOf(submitError));
      if (submitError instanceof ApiClientError && submitError.fields)
        setFields(submitError.fields);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (key: string) =>
    fields[key] && <small className="field-error">{fields[key]}</small>;

  if (isStaticDemo) {
    return (
      <>
        <PageHeader
          title="Patient registration"
          description="Registration is unavailable in the public static demo."
        />
        <div className="info-callout">
          <Info size={17} />
          <p>
            Patient registration and persistent family-history editing require the local API and
            SQLite database. This GitHub Pages deployment contains synthetic, read-only
            demonstration records.
          </p>
        </div>
        <Link className="button button--secondary" to="/patients">
          Back to patients
        </Link>
      </>
    );
  }

  return (
    <>
      <Link className="back-link" to="/patients">
        <ArrowLeft size={16} /> Back to patients
      </Link>
      <PageHeader
        title="Register a patient"
        description="Create a synthetic patient record for this local demonstration."
      />
      <div className="registration-layout">
        <form className="surface-card registration-card phase3-form" onSubmit={submit}>
          <div className="demo-banner">
            <span className="demo-banner__dot" /> Demonstration data only
            <span>Never enter real patient information.</span>
          </div>
          <div className="form-section-heading">
            <span className="form-section-heading__icon">
              <UserRound size={18} />
            </span>
            <div>
              <h3>Patient information</h3>
              <p>Required fields are marked in the form.</p>
            </div>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-grid">
            <label className="field-label">
              First name *
              <input
                autoComplete="off"
                className="form-control field-control"
                maxLength={70}
                onChange={(e) => update('firstName', e.target.value)}
                required
                value={form.firstName}
              />
              {fieldError('firstName')}
            </label>
            <label className="field-label">
              Last name *
              <input
                autoComplete="off"
                className="form-control field-control"
                maxLength={70}
                onChange={(e) => update('lastName', e.target.value)}
                required
                value={form.lastName}
              />
              {fieldError('lastName')}
            </label>
            <label className="field-label">
              Date of birth *
              <input
                className="form-control field-control"
                max={today}
                onChange={(e) => update('dateOfBirth', e.target.value)}
                required
                type="date"
                value={form.dateOfBirth}
              />
              {fieldError('dateOfBirth')}
            </label>
            <label className="field-label">
              Sex recorded for clinical documentation *
              <select
                className="form-control field-control"
                onChange={(e) => update('sex', e.target.value)}
                value={form.sex}
              >
                {sexOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {fieldError('sex')}
            </label>
            <label className="field-label">
              Phone (optional)
              <input
                autoComplete="off"
                className="form-control field-control"
                onChange={(e) => update('phone', e.target.value)}
                type="tel"
                value={form.phone}
              />
              {fieldError('phone')}
            </label>
            <label className="field-label">
              Email (optional)
              <input
                autoComplete="off"
                className="form-control field-control"
                onChange={(e) => update('email', e.target.value)}
                type="email"
                value={form.email}
              />
              {fieldError('email')}
            </label>
            <label className="field-label">
              County (optional)
              <input
                className="form-control field-control"
                maxLength={100}
                onChange={(e) => update('county', e.target.value)}
                value={form.county}
              />
              {fieldError('county')}
            </label>
            <label className="field-label">
              Location (optional)
              <input
                className="form-control field-control"
                maxLength={120}
                onChange={(e) => update('location', e.target.value)}
                value={form.location}
              />
              {fieldError('location')}
            </label>
          </div>
          <label className="field-label">
            Reason for consultation *
            <textarea
              className="form-control field-control"
              maxLength={500}
              onChange={(e) => update('consultationReason', e.target.value)}
              required
              rows={3}
              value={form.consultationReason}
            />
            {fieldError('consultationReason')}
          </label>
          <label className="field-label">
            Relevant clinical notes (optional)
            <textarea
              className="form-control field-control"
              maxLength={3000}
              onChange={(e) => update('clinicalNote', e.target.value)}
              rows={3}
              value={form.clinicalNote}
            />
            {fieldError('clinicalNote')}
          </label>

          <section className="consent-panel">
            <div className="form-section-heading">
              <span className="form-section-heading__icon">
                <ClipboardList size={18} />
              </span>
              <div>
                <h3>Consent and family-history permission</h3>
                <p>
                  Family health details may include sensitive information about biological
                  relatives. Do not select consent unless it was explicitly obtained.
                </p>
              </div>
            </div>
            <label className="check-row">
              <input
                checked={consentGranted}
                onChange={(e) => {
                  setConsentGranted(e.target.checked);
                  if (!e.target.checked) setFamilyPermission(false);
                }}
                type="checkbox"
              />
              <span>Patient consent was explicitly obtained for this demonstration record.</span>
            </label>
            <label className="check-row">
              <input
                checked={familyPermission}
                disabled={!consentGranted}
                onChange={(e) => setFamilyPermission(e.target.checked)}
                type="checkbox"
              />
              <span>Permission to collect and document family health history was obtained.</span>
            </label>
            {consentGranted && (
              <div className="form-grid">
                <label className="field-label">
                  Consent date
                  <input
                    className="form-control field-control"
                    max={today}
                    onChange={(event) => setConsentDate(event.target.value)}
                    required
                    type="date"
                    value={consentDate}
                  />
                </label>
                <label className="field-label">
                  Healthcare professional recording consent *
                  <input
                    className="form-control field-control"
                    maxLength={120}
                    onChange={(e) => update('recordedBy', e.target.value)}
                    required
                    value={form.recordedBy}
                  />
                  {fieldError('recordedBy')}
                </label>
              </div>
            )}
            <p className="clinical-note">
              Consent remains not granted unless the first checkbox is selected. Family history
              cannot be added without explicit permission.
            </p>
          </section>
          <button className="button button--primary" disabled={submitting} type="submit">
            {submitting ? 'Saving record…' : 'Register synthetic patient'} <ArrowRight size={17} />
          </button>
        </form>
        <aside className="registration-aside">
          <span className="registration-aside__icon">
            <Info size={18} />
          </span>
          <h3>Clinical documentation prototype</h3>
          <p>
            Patient ID and registration date are generated automatically. This prototype is not a
            diagnostic system or production clinical record.
          </p>
          <span className="privacy-chip">Synthetic data only</span>
        </aside>
      </div>
    </>
  );
}

export function PatientDetailPage() {
  const { patientId } = useParams();
  const { patient, error, loading, refresh } = usePatient(patientId);
  if (loading) return <p className="loading-state">Loading patient record…</p>;
  if (!patient)
    return (
      <EmptyState
        title="Patient record unavailable"
        description={error || 'The record could not be loaded.'}
        action={
          <Link className="button button--secondary" to="/patients">
            Back to patients
          </Link>
        }
      />
    );

  return (
    <>
      <Link className="back-link" to="/patients">
        <ArrowLeft size={16} /> Back to patients
      </Link>
      <PageHeader
        eyebrow={patient.id}
        title={patient.fullName}
        description="Synthetic patient record · demonstration workspace"
        action={<StatusBadge value={patient.reviewStatus} />}
      />
      <nav className="patient-tabs" aria-label="Patient record sections">
        <a aria-current="page" href="#overview">
          Overview
        </a>
        <Link to={`/family-history?patient=${encodeURIComponent(patient.id)}`}>Family history</Link>
        <Link to={`/pedigree?patient=${encodeURIComponent(patient.id)}`}>Pedigree</Link>
        <Link to={`/reviews?patient=${encodeURIComponent(patient.id)}`}>Clinical review</Link>
      </nav>
      <div className="detail-grid">
        <section className="surface-card detail-card" id="overview">
          <div className="card-heading">
            <div>
              <h3>Patient overview</h3>
              <p>Demographics and registration details</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Age</dt>
              <dd>{patient.age} years</dd>
            </div>
            <div>
              <dt>Date of birth</dt>
              <dd>{patient.dateOfBirth}</dd>
            </div>
            <div>
              <dt>Sex recorded</dt>
              <dd>{patient.sex.replaceAll('_', ' ')}</dd>
            </div>
            <div>
              <dt>Patient ID</dt>
              <dd>{patient.id}</dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>
                <CalendarDays size={15} /> {new Date(patient.registeredAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{patient.phone || patient.email || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Consultation reason</dt>
              <dd>{patient.consultationReason}</dd>
            </div>
          </dl>
        </section>
        {isStaticDemo ? (
          <section className="surface-card detail-card consent-panel">
            <h3>Consent status</h3>
            <span className="privacy-chip">Consent not granted</span>
            <p>
              This static preview does not collect or persist consent or family-health information.
            </p>
          </section>
        ) : (
          <ConsentEditor patient={patient} onSaved={() => void refresh()} />
        )}
        <section className="surface-card detail-card detail-wide">
          <div className="card-heading">
            <div>
              <h3>Family health information</h3>
              <p>{patient.relatives.length} biological relative(s) recorded</p>
            </div>
            <Link
              className="button button--secondary"
              to={`/family-history?patient=${encodeURIComponent(patient.id)}`}
            >
              Manage history <ArrowRight size={16} />
            </Link>
          </div>
          {patient.relatives.length ? (
            <RelativeList relatives={patient.relatives} />
          ) : (
            <p className="muted-copy">No biological relatives have been recorded.</p>
          )}
          <h4>Missing or unverified information</h4>
          {patient.missingInformation.length ? (
            <ul className="missing-list">
              {patient.missingInformation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">No missing information indicators.</p>
          )}
        </section>
        <section className="surface-card detail-card">
          <h3>Clinical notes</h3>
          {patient.clinicalNotes.length ? (
            patient.clinicalNotes.map((note) => (
              <article className="note-entry" key={note.id}>
                <p>{note.text}</p>
                <small>
                  {note.recordedBy || 'Recorded'} · {new Date(note.createdAt).toLocaleString()}
                </small>
              </article>
            ))
          ) : (
            <p className="muted-copy">No clinical notes recorded.</p>
          )}
        </section>
        <section className="surface-card detail-card">
          <h3>Registration and update history</h3>
          <ul className="timeline">
            {patient.history.map((event) => (
              <li key={event.id}>
                <strong>{event.summary}</strong>
                <small>{new Date(event.createdAt).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="clinical-note">
        Reported family history is not a diagnosis. Clinical interpretation requires qualified
        review.
      </p>
    </>
  );
}

function ConsentEditor({ patient, onSaved }: { patient: PatientDetail; onSaved: () => void }) {
  const [granted, setGranted] = useState(patient.consent.status === 'granted');
  const [permission, setPermission] = useState(patient.consent.familyHistoryPermission);
  const [recordedBy, setRecordedBy] = useState(patient.consent.recordedBy ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <section className="surface-card detail-card consent-panel">
      <h3>Consent status</h3>
      <span className="privacy-chip">
        {patient.consent.status === 'granted' ? 'Consent granted' : 'Consent not granted'}
      </span>
      {patient.consent.status === 'granted' ? (
        <p>
          Obtained {patient.consent.obtainedAt} · Recorded by {patient.consent.recordedBy}
        </p>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError('');
            try {
              await saveConsent(patient.id, {
                granted,
                obtainedAt: granted ? new Date().toISOString().slice(0, 10) : null,
                recordedBy: granted ? recordedBy : null,
                familyHistoryPermission: granted && permission,
              });
              onSaved();
            } catch (saveError) {
              setError(messageOf(saveError));
            } finally {
              setSaving(false);
            }
          }}
        >
          <label className="check-row">
            <input
              checked={granted}
              onChange={(e) => setGranted(e.target.checked)}
              type="checkbox"
            />{' '}
            Explicit consent was obtained
          </label>
          <label className="check-row">
            <input
              checked={permission}
              disabled={!granted}
              onChange={(e) => setPermission(e.target.checked)}
              type="checkbox"
            />{' '}
            Permission to document family history was obtained
          </label>
          {granted && (
            <label className="field-label">
              Recorded by
              <input
                className="form-control field-control"
                onChange={(e) => setRecordedBy(e.target.value)}
                required
                value={recordedBy}
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button--secondary" disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Update consent'}
          </button>
        </form>
      )}
    </section>
  );
}

function RelativeList({
  relatives,
  onEdit,
  onDelete,
}: {
  relatives: BiologicalRelative[];
  onEdit?: (relative: BiologicalRelative) => void;
  onDelete?: (relative: BiologicalRelative) => void;
}) {
  const grouped = [
    [
      'Maternal branch',
      relatives.filter((relative) =>
        [
          'mother',
          'maternal_grandmother',
          'maternal_grandfather',
          'maternal_aunt',
          'maternal_uncle',
        ].includes(relative.relationship),
      ),
    ],
    [
      'Paternal branch',
      relatives.filter((relative) =>
        [
          'father',
          'paternal_grandmother',
          'paternal_grandfather',
          'paternal_aunt',
          'paternal_uncle',
        ].includes(relative.relationship),
      ),
    ],
    [
      'Other biological relatives',
      relatives.filter((relative) =>
        ['sister', 'brother', 'daughter', 'son', 'other_biological_relative'].includes(
          relative.relationship,
        ),
      ),
    ],
  ] as const;
  return (
    <div className="relative-groups">
      {grouped.map(
        ([label, members]) =>
          members.length > 0 && (
            <section key={label}>
              <h4>{label}</h4>
              {members.map((relative) => (
                <article className="relative-card" key={relative.id}>
                  <div className="relative-card__heading">
                    <strong>
                      {relationshipLabels[relative.relationship]}
                      {relative.relationshipDetail ? ` · ${relative.relationshipDetail}` : ''}
                    </strong>
                    <span>
                      {relative.informationUnknown
                        ? 'Information unknown'
                        : `${relative.status}${relative.age !== null ? ` · age ${relative.age}` : ''}`}
                    </span>
                  </div>
                  <p>
                    {relative.conditions.length
                      ? relative.conditions
                          .map(
                            (condition) =>
                              `${condition.name}${condition.ageAtOnset !== null ? ` (onset age ${condition.ageAtOnset})` : ''}`,
                          )
                          .join(', ')
                      : 'No condition recorded'}
                  </p>
                  <small>
                    Source: {relative.source.replaceAll('_', ' ')}
                    {relative.source !== 'clinically_verified' && ' · Not clinically verified'}
                    {relative.notes ? ` · ${relative.notes}` : ''}
                  </small>
                  {(onEdit || onDelete) && (
                    <div className="relative-card__actions">
                      {onEdit && (
                        <button
                          className="button button--secondary button--small"
                          onClick={() => onEdit(relative)}
                          type="button"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          className="button button--danger button--small"
                          onClick={() => onDelete(relative)}
                          type="button"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </section>
          ),
      )}
    </div>
  );
}

const blankRelative = (): BiologicalRelativeInput => ({
  relationship: 'mother',
  relationshipDetail: null,
  sex: 'unknown',
  status: 'unknown',
  age: null,
  ageAtDeath: null,
  informationUnknown: false,
  source: 'patient_reported',
  notes: null,
  conditions: [],
});

function RelativeForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: BiologicalRelativeInput;
  onSave: (relative: BiologicalRelativeInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [conditionSearch, setConditionSearch] = useState('');
  const [conditionName, setConditionName] = useState<ConditionOption>('Unknown');
  const [customName, setCustomName] = useState('');
  const [onsetAge, setOnsetAge] = useState('');
  const [formError, setFormError] = useState('');
  const conditions = useMemo(
    () =>
      CONDITION_OPTIONS.filter((condition) =>
        condition.toLowerCase().includes(conditionSearch.toLowerCase()),
      ),
    [conditionSearch],
  );
  function update<K extends keyof BiologicalRelativeInput>(
    key: K,
    next: BiologicalRelativeInput[K],
  ) {
    setValue((current) => ({ ...current, [key]: next }));
  }
  function addCondition() {
    if (conditionName === 'Other condition' && !customName.trim()) {
      setFormError('Enter the custom condition name.');
      return;
    }
    const nextCondition: RelativeConditionInput = {
      name: conditionName,
      ...(conditionName === 'Other condition' ? { customName: customName.trim() } : {}),
      ageAtOnset: onsetAge ? Number(onsetAge) : null,
    };
    if (
      !value.conditions.some(
        (condition) =>
          condition.name === nextCondition.name &&
          condition.customName === nextCondition.customName,
      )
    ) {
      update('conditions', [...value.conditions, nextCondition]);
    }
    setCustomName('');
    setOnsetAge('');
    setFormError('');
  }
  return (
    <form
      className="relative-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        setFormError('');
        try {
          await onSave(value);
        } catch (error) {
          setFormError(messageOf(error));
        }
      }}
    >
      <div className="form-section-heading">
        <span className="form-section-heading__icon">
          <UserRound size={18} />
        </span>
        <div>
          <h3>Relative details</h3>
          <p>Leave unknown information blank; do not estimate.</p>
        </div>
      </div>
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      <div className="form-grid">
        <label className="field-label">
          Relationship *
          <select
            className="form-control field-control"
            onChange={(e) =>
              update('relationship', e.target.value as BiologicalRelativeInput['relationship'])
            }
            value={value.relationship}
          >
            {RELATIONSHIP_OPTIONS.map((relationship) => (
              <option key={relationship} value={relationship}>
                {relationshipLabels[relationship]}
              </option>
            ))}
          </select>
        </label>
        {value.relationship === 'other_biological_relative' && (
          <label className="field-label">
            Relationship detail *
            <input
              className="form-control field-control"
              onChange={(e) => update('relationshipDetail', e.target.value)}
              value={value.relationshipDetail ?? ''}
            />
          </label>
        )}
        <label className="field-label">
          Sex, if known
          <select
            className="form-control field-control"
            onChange={(e) => update('sex', e.target.value as Sex)}
            value={value.sex}
          >
            {sexOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Current status
          <select
            className="form-control field-control"
            onChange={(e) => update('status', e.target.value as RelativeStatus)}
            value={value.status}
          >
            <option value="unknown">Unknown</option>
            <option value="alive">Alive</option>
            <option value="deceased">Deceased</option>
          </select>
        </label>
        <label className="field-label">
          {value.status === 'deceased' ? 'Age at death' : 'Age / approximate age'}
          <input
            className="form-control field-control"
            max={130}
            min={0}
            onChange={(e) =>
              update(
                value.status === 'deceased' ? 'ageAtDeath' : 'age',
                e.target.value === '' ? null : Number(e.target.value),
              )
            }
            type="number"
            value={value.status === 'deceased' ? (value.ageAtDeath ?? '') : (value.age ?? '')}
          />
        </label>
        <label className="field-label">
          Information source
          <select
            className="form-control field-control"
            onChange={(e) => update('source', e.target.value as InformationSource)}
            value={value.source}
          >
            <option value="patient_reported">Patient-reported</option>
            <option value="documented">Documented</option>
            <option value="clinically_verified">Clinically verified</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>
      <label className="check-row">
        <input
          checked={value.informationUnknown}
          onChange={(e) => update('informationUnknown', e.target.checked)}
          type="checkbox"
        />{' '}
        Information about this relative is unknown
      </label>
      <fieldset className="condition-picker">
        <legend>Known health conditions</legend>
        <label className="field-label">
          Search conditions
          <input
            className="form-control field-control"
            onChange={(e) => setConditionSearch(e.target.value)}
            placeholder="Search available conditions"
            value={conditionSearch}
          />
        </label>
        <div className="form-grid condition-picker__controls">
          <label className="field-label">
            Condition
            <select
              className="form-control field-control"
              onChange={(e) => setConditionName(e.target.value as ConditionOption)}
              value={conditionName}
            >
              {conditions.map((condition) => (
                <option key={condition}>{condition}</option>
              ))}
            </select>
          </label>
          {conditionName === 'Other condition' && (
            <label className="field-label">
              Custom condition
              <input
                className="form-control field-control"
                onChange={(e) => setCustomName(e.target.value)}
                value={customName}
              />
            </label>
          )}
          <label className="field-label">
            Age at diagnosis / onset (optional)
            <input
              className="form-control field-control"
              max={130}
              min={0}
              onChange={(e) => setOnsetAge(e.target.value)}
              type="number"
              value={onsetAge}
            />
          </label>
        </div>
        <button
          className="button button--secondary button--small"
          onClick={addCondition}
          type="button"
        >
          <Plus size={14} /> Add condition
        </button>
        {value.conditions.length > 0 && (
          <ul className="condition-list">
            {value.conditions.map((condition, index) => (
              <li key={`${condition.name}-${condition.customName ?? ''}`}>
                {condition.customName || condition.name}
                {condition.ageAtOnset !== null ? ` · onset ${condition.ageAtOnset}` : ''}
                <button
                  aria-label={`Remove ${condition.customName || condition.name}`}
                  onClick={() =>
                    update(
                      'conditions',
                      value.conditions.filter((_, current) => current !== index),
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="clinical-note">
          Condition entries are descriptive only. No inheritance, carrier status, diagnosis, or risk
          estimate is inferred.
        </p>
      </fieldset>
      <label className="field-label">
        Additional notes
        <textarea
          className="form-control field-control"
          maxLength={2000}
          onChange={(e) => update('notes', e.target.value || null)}
          rows={3}
          value={value.notes ?? ''}
        />
      </label>
      <div className="relative-editor__actions">
        <button className="button button--primary" disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save relative'}
        </button>
        <button className="button button--secondary" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function FamilyHistoryPage() {
  const [params] = useSearchParams();
  const patientId = params.get('patient') ?? undefined;
  const { patient, error, loading, refresh } = usePatient(patientId);
  const [editing, setEditing] = useState<BiologicalRelative | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  if (!patientId) {
    return (
      <>
        <PageHeader
          title="Family history"
          description="Choose a synthetic patient record before documenting biological relatives."
          action={
            <Link className="button button--primary" to="/patients">
              <Search size={16} /> Find a patient
            </Link>
          }
        />
        <section className="surface-card workspace-intro">
          <span className="workspace-intro__icon">
            <ClipboardList size={22} />
          </span>
          <span className="eyebrow">Family history workspace</span>
          <h3>Start with a patient record</h3>
          <p>Information is recorded with its source and may remain incomplete or unverified.</p>
          <Link className="button button--primary" to="/patients">
            Browse patients <ArrowRight size={17} />
          </Link>
        </section>
      </>
    );
  }
  if (loading) return <p className="loading-state">Loading family history…</p>;
  if (!patient)
    return (
      <EmptyState
        title="Family history unavailable"
        description={error || 'Patient record could not be loaded.'}
        action={
          <Link className="button button--secondary" to="/patients">
            Back to patients
          </Link>
        }
      />
    );
  const currentPatient = patient;

  async function handleSave(relative: BiologicalRelativeInput, relativeId?: string) {
    setSaving(true);
    setActionError('');
    try {
      await saveRelative(currentPatient.id, relative, relativeId);
      setAdding(false);
      setEditing(null);
      await refresh();
      window.dispatchEvent(
        new CustomEvent('familygene:patients-updated', { detail: await listPatients() }),
      );
    } catch (saveError) {
      setActionError(messageOf(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(relative: BiologicalRelative) {
    const confirmed = window.confirm(
      `Remove ${relationshipLabels[relative.relationship]} from this patient's family history? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await removeRelative(currentPatient.id, relative.id);
      await refresh();
      window.dispatchEvent(
        new CustomEvent('familygene:patients-updated', { detail: await listPatients() }),
      );
      setActionError('');
    } catch (deleteError) {
      setActionError(messageOf(deleteError));
    }
  }

  return (
    <>
      <Link className="back-link" to={`/patients/${encodeURIComponent(patient.id)}`}>
        <ArrowLeft size={16} /> Back to patient
      </Link>
      <PageHeader
        eyebrow={patient.id}
        title="Family history"
        description={`${patient.fullName} · collected information is not a diagnosis`}
        action={
          patient.familyHistoryPermission ? (
            <button
              className="button button--primary"
              onClick={() => {
                setEditing(null);
                setAdding(true);
              }}
              type="button"
            >
              <Plus size={17} /> Add relative
            </button>
          ) : undefined
        }
      />
      {!patient.familyHistoryPermission && (
        <div className="info-callout">
          <Info size={17} />
          <p>
            Family-history permission is not recorded. Update the patient's consent before adding
            relatives.
          </p>
          <Link to={`/patients/${patient.id}`}>Review consent</Link>
        </div>
      )}
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {adding && (
        <section className="surface-card">
          <RelativeForm
            initial={blankRelative()}
            onSave={(relative) => handleSave(relative)}
            onCancel={() => setAdding(false)}
            saving={saving}
          />
        </section>
      )}
      {editing && (
        <section className="surface-card">
          <RelativeForm
            initial={relativeToInput(editing)}
            onSave={(relative) => handleSave(relative, editing.id)}
            onCancel={() => setEditing(null)}
            saving={saving}
          />
        </section>
      )}
      <section className="surface-card family-history-card">
        <div className="card-heading">
          <div>
            <h3>Recorded biological relatives</h3>
            <p>
              {patient.relatives.length} relative(s) · sources and uncertainty are shown explicitly
            </p>
          </div>
        </div>
        {patient.relatives.length ? (
          <RelativeList
            relatives={patient.relatives}
            onEdit={setEditing}
            onDelete={(relative) => void handleDelete(relative)}
          />
        ) : (
          <p className="muted-copy">
            No relatives recorded yet. Add information only when consent permits; leave unknown
            details blank.
          </p>
        )}
      </section>
      <div className="info-callout workspace-safety">
        <Info size={17} />
        <p>
          Family health details may be sensitive. This prototype does not infer a diagnosis,
          inheritance pattern, carrier status, genotype, or genetic-risk percentage.
        </p>
      </div>
    </>
  );
}

function relativeToInput(relative: BiologicalRelative): BiologicalRelativeInput {
  return {
    relationship: relative.relationship,
    relationshipDetail: relative.relationshipDetail,
    sex: relative.sex,
    status: relative.status,
    age: relative.age,
    ageAtDeath: relative.ageAtDeath,
    informationUnknown: relative.informationUnknown,
    source: relative.source,
    notes: relative.notes,
    conditions: relative.conditions.map((condition) => ({
      name: (condition.isCustom ? 'Other condition' : condition.name) as ConditionOption,
      ...(condition.isCustom ? { customName: condition.name } : {}),
      ageAtOnset: condition.ageAtOnset,
    })),
  };
}

export function ClinicalReviewsPage() {
  return (
    <>
      <PageHeader
        title="Clinical reviews"
        description="Follow-up items for clinician review. Queue labels describe workflow status only."
      />
      <section className="surface-card review-queue-card">
        <div className="card-heading">
          <div>
            <h3>Cases awaiting attention</h3>
            <p>All identifiers and cases below are fictional demo data.</p>
          </div>
          <span className="queue-count">{demoReviews.length} cases</span>
        </div>
        <ReviewQueue reviews={demoReviews} />
      </section>
      <p className="clinical-note">
        A review prompt is not a diagnosis or a statement of genetic risk.
      </p>
    </>
  );
}
