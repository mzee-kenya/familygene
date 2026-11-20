import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  icon: ReactNode;
  tone: 'blue' | 'teal' | 'violet' | 'amber';
}

export function StatCard({ label, value, change, icon, tone }: StatCardProps) {
  return (
    <article className="surface-card stat-card">
      <div className={`stat-card__icon stat-card__icon--${tone}`} aria-hidden="true">
        {icon}
      </div>
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
      <p className="stat-card__change">{change}</p>
    </article>
  );
}
