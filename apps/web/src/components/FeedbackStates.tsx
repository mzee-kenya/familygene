import type { ReactNode } from 'react';
import { FileQuestion, LoaderCircle } from 'lucide-react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        <FileQuestion size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading workspace' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="loading-state__icon" size={21} />
      <span>{label}</span>
    </div>
  );
}
