import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReviewItem } from '../data/types';
import { StatusBadge } from './StatusBadge';

export function ReviewQueue({
  reviews,
  compact = false,
}: {
  reviews: ReviewItem[];
  compact?: boolean;
}) {
  return (
    <div className={`review-list${compact ? ' review-list--compact' : ''}`}>
      {reviews.map((review) => (
        <article className="review-item" key={review.id}>
          <div className="review-item__top">
            <span className="review-item__patient">{review.id}</span>
            <StatusBadge value={review.priority} />
          </div>
          <p>{review.reason}</p>
          <div className="review-item__bottom">
            <span>{review.status}</span>
            <Link className="text-link" to={`/patients/${review.id}`}>
              Open case <ArrowUpRight size={14} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
