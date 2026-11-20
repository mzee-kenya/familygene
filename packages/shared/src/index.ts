export const RELATIONSHIP_OPTIONS = [
  'mother',
  'father',
  'maternal_grandmother',
  'maternal_grandfather',
  'paternal_grandmother',
  'paternal_grandfather',
  'sister',
  'brother',
  'daughter',
  'son',
  'maternal_aunt',
  'maternal_uncle',
  'paternal_aunt',
  'paternal_uncle',
  'other_biological_relative',
] as const;

export type Relationship = (typeof RELATIONSHIP_OPTIONS)[number];
export type Sex = 'female' | 'male' | 'intersex' | 'unknown' | 'prefer_not_to_say';
export type RelativeStatus = 'alive' | 'deceased' | 'unknown';
export type InformationSource =
  'patient_reported' | 'documented' | 'clinically_verified' | 'unknown';
export type ConsentStatus = 'granted' | 'not_granted';
export type FamilyHistoryStatus = 'Not started' | 'In progress' | 'Recorded';
export type ReviewStatus = 'Reviewed' | 'Awaiting review' | 'Not required';

export const CONDITION_OPTIONS = [
  'Sickle cell disease',
  'Thalassemia',
  'Breast cancer',
  'Colorectal cancer',
  'Type 2 diabetes',
  'Hypertension',
  'Heart disease',
  'Stroke',
  'Other condition',
  'No known condition',
  'Unknown',
] as const;

export type ConditionOption = (typeof CONDITION_OPTIONS)[number];

export interface PatientRegistrationInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
  phone: string | null;
  email: string | null;
  county: string | null;
  location: string | null;
  consultationReason: string;
  consent: {
    granted: boolean;
    obtainedAt: string | null;
    recordedBy: string | null;
    familyHistoryPermission: boolean;
  };
  clinicalNote: string | null;
}

export interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  age: number;
  sex: Sex;
  county: string | null;
  location: string | null;
  registeredAt: string;
  familyHistory: FamilyHistoryStatus;
  reviewStatus: ReviewStatus;
  consentStatus: ConsentStatus;
  familyHistoryPermission: boolean;
  relativesCount: number;
}

export interface ConsentRecord {
  status: ConsentStatus;
  obtainedAt: string | null;
  recordedBy: string | null;
  familyHistoryPermission: boolean;
  updatedAt: string;
}

export interface RelativeConditionInput {
  name: ConditionOption;
  customName?: string;
  ageAtOnset: number | null;
}

export interface RelativeConditionRecord {
  id: number;
  name: string;
  isCustom: boolean;
  ageAtOnset: number | null;
}

export interface BiologicalRelativeInput {
  relationship: Relationship;
  relationshipDetail: string | null;
  sex: Sex;
  status: RelativeStatus;
  age: number | null;
  ageAtDeath: number | null;
  informationUnknown: boolean;
  source: InformationSource;
  notes: string | null;
  conditions: RelativeConditionInput[];
}

export interface BiologicalRelative extends Omit<BiologicalRelativeInput, 'conditions'> {
  id: string;
  patientId: string;
  conditions: RelativeConditionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalNote {
  id: string;
  text: string;
  recordedBy: string | null;
  createdAt: string;
}

export interface PatientHistoryEvent {
  id: string;
  eventType: string;
  summary: string;
  recordedBy: string | null;
  createdAt: string;
}

export interface PatientDetail extends PatientSummary {
  phone: string | null;
  email: string | null;
  consultationReason: string;
  consent: ConsentRecord;
  relatives: BiologicalRelative[];
  clinicalNotes: ClinicalNote[];
  history: PatientHistoryEvent[];
  missingInformation: string[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface CreateClinicalNoteInput {
  text: string;
  recordedBy?: string | null;
}
