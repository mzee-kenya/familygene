import type { FamilyHistoryStatus, ReviewPriority, ReviewStatus } from '../data/types';

type BadgeValue = FamilyHistoryStatus | ReviewPriority | ReviewStatus;

const toneByValue: Record<BadgeValue, string> = {
  Recorded: 'success',
  Reviewed: 'success',
  'Not started': 'neutral',
  Routine: 'neutral',
  'Not required': 'neutral',
  'In progress': 'warning',
  'Follow-up': 'warning',
  'Awaiting review': 'warning',
  'Time-sensitive': 'danger',
};

export function StatusBadge({ value }: { value: BadgeValue }) {
  return <span className={`status-badge status-badge--${toneByValue[value]}`}>{value}</span>;
}
