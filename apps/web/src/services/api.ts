import type {
  ApiErrorResponse,
  BiologicalRelative,
  BiologicalRelativeInput,
  PatientDetail,
  PatientRegistrationInput,
  PatientSummary,
} from '@familygene/shared';
import { demoPatients } from '../data/demo-data';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
export const isStaticDemo = import.meta.env.VITE_DEMO_MODE === 'true';

function staticPatientSummaries(): PatientSummary[] {
  return demoPatients.map((patient) => {
    const birthDate = new Date();
    birthDate.setUTCFullYear(birthDate.getUTCFullYear() - patient.age);
    return {
      id: patient.id,
      firstName: patient.name.split(' ')[0] ?? patient.name,
      lastName: patient.name.split(' ').slice(1).join(' '),
      fullName: patient.name,
      dateOfBirth: birthDate.toISOString().slice(0, 10),
      age: patient.age,
      sex: 'unknown',
      county: null,
      location: null,
      registeredAt: new Date(patient.registeredAt).toISOString(),
      familyHistory: patient.familyHistory,
      reviewStatus: patient.reviewStatus,
      consentStatus: 'not_granted',
      familyHistoryPermission: false,
      relativesCount: 0,
    };
  });
}

function staticPatientDetail(patientId: string): PatientDetail {
  const patient = staticPatientSummaries().find((record) => record.id === patientId);
  if (!patient) throw new ApiClientError('Patient record was not found.', undefined, 404);
  return {
    ...patient,
    phone: null,
    email: null,
    consultationReason: 'Synthetic demonstration record',
    consent: {
      status: 'not_granted',
      obtainedAt: null,
      recordedBy: null,
      familyHistoryPermission: false,
      updatedAt: patient.registeredAt,
    },
    relatives: [],
    clinicalNotes: [],
    history: [
      {
        id: `${patient.id}-registered`,
        eventType: 'patient_registered',
        summary: 'Synthetic demonstration patient registered.',
        recordedBy: null,
        createdAt: patient.registeredAt,
      },
    ],
    missingInformation: [
      'Family-history consent has not been granted.',
      'No biological relatives have been recorded.',
      'No phone or email contact recorded.',
    ],
  };
}

function staticWriteUnavailable(): never {
  throw new ApiClientError(
    'This public GitHub Pages demo is read-only. Registration and family-history changes are available only in the local full-stack prototype.',
    undefined,
    405,
  );
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
    public readonly status = 500,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiClientError('The service could not be reached. Check that the API is running.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body as ApiErrorResponse | null;
    throw new ApiClientError(
      error?.error?.message ?? 'The request could not be completed.',
      error?.error?.fields,
      response.status,
    );
  }
  return body as T;
}

export async function getApiHealth(): Promise<{ status: string }> {
  return request<{ status: string }>('/health');
}

export async function listPatients(search = ''): Promise<PatientSummary[]> {
  if (isStaticDemo) {
    const normalized = search.trim().toLowerCase();
    return staticPatientSummaries().filter(
      (patient) =>
        !normalized ||
        patient.fullName.toLowerCase().includes(normalized) ||
        patient.id.toLowerCase().includes(normalized),
    );
  }
  const query = search ? `?q=${encodeURIComponent(search)}` : '';
  const result = await request<{ patients: PatientSummary[] }>(`/patients${query}`);
  return result.patients;
}

export async function getPatient(patientId: string): Promise<PatientDetail> {
  if (isStaticDemo) return staticPatientDetail(patientId);
  const result = await request<{ patient: PatientDetail }>(
    `/patients/${encodeURIComponent(patientId)}`,
  );
  return result.patient;
}

export async function registerPatient(
  input: PatientRegistrationInput,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<PatientSummary> {
  if (isStaticDemo) return staticWriteUnavailable();
  const result = await request<{ patient: PatientSummary }>('/patients', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
  return result.patient;
}

export async function saveRelative(
  patientId: string,
  input: BiologicalRelativeInput,
  relativeId?: string,
): Promise<BiologicalRelative[]> {
  if (isStaticDemo) return staticWriteUnavailable();
  const path = `/patients/${encodeURIComponent(patientId)}/relatives${relativeId ? `/${encodeURIComponent(relativeId)}` : ''}`;
  const result = await request<{ relatives: BiologicalRelative[] }>(path, {
    method: relativeId ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  });
  return result.relatives;
}

export async function removeRelative(patientId: string, relativeId: string): Promise<void> {
  if (isStaticDemo) return staticWriteUnavailable();
  await request(
    `/patients/${encodeURIComponent(patientId)}/relatives/${encodeURIComponent(relativeId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function saveConsent(
  patientId: string,
  consent: PatientRegistrationInput['consent'],
): Promise<PatientDetail> {
  if (isStaticDemo) return staticWriteUnavailable();
  const result = await request<{ patient: PatientDetail }>(
    `/patients/${encodeURIComponent(patientId)}/consent`,
    { method: 'PUT', body: JSON.stringify(consent) },
  );
  return result.patient;
}
