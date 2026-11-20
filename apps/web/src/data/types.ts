export type FamilyHistoryStatus = 'Recorded' | 'In progress' | 'Not started';
export type ReviewStatus = 'Reviewed' | 'Awaiting review' | 'Not required';
export type ReviewPriority = 'Routine' | 'Follow-up' | 'Time-sensitive';

export interface Patient {
  id: string;
  name: string;
  age: number;
  registeredAt: string;
  familyHistory: FamilyHistoryStatus;
  reviewStatus: ReviewStatus;
  informationNote: string;
}

export interface ReviewItem {
  id: string;
  reason: string;
  priority: ReviewPriority;
  status: 'Awaiting review' | 'In review';
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  date: string;
  kind: 'patient' | 'history' | 'pedigree' | 'review';
  patientId?: string;
}
