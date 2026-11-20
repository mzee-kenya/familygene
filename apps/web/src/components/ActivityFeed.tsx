import { ClipboardCheck, FilePlus2, GitBranch, History } from 'lucide-react';
import type { ActivityItem } from '../data/types';
import { Link } from 'react-router-dom';

const activityIcons = {
  patient: FilePlus2,
  history: History,
  pedigree: GitBranch,
  review: ClipboardCheck,
};

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <ol className="activity-feed">
      {activities.map((activity) => {
        const Icon = activityIcons[activity.kind];
        const content = (
          <>
            <span className={`activity-feed__icon activity-feed__icon--${activity.kind}`}>
              <Icon size={16} />
            </span>
            <span className="activity-feed__copy">
              <strong>{activity.title}</strong>
              <span>{activity.detail}</span>
            </span>
            <time>{activity.date}</time>
          </>
        );

        return (
          <li key={activity.id}>
            {activity.patientId ? (
              <Link to={`/patients/${activity.patientId}`}>{content}</Link>
            ) : (
              <div>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
