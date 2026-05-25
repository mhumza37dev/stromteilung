import { useLang } from '../hooks/useLang';
import { useIsMobile } from '../hooks/useIsMobile';
import { useMyReceivedRatings } from '../hooks/api/useRatings';
import { Nav } from '../components/layout/Nav';
import { Card } from '../components/ui/Card';
import { Stars } from '../components/ui/Stars';
import { Skeleton, SkeletonLines } from '../components/ui/Skeleton';
import type { Role } from '../types';
import type { RatingPublic } from '../lib/api-types';

export interface RatingsPageProps {
  role: Role;
  onBack: () => void;
  onLogout: () => void;
}

/**
 * "Received ratings" screen, wired to `/ratings/received`.
 *
 * Renders three states without flicker:
 * 1. Loading  → skeleton matching the final layout (no jump)
 * 2. Empty    → friendly empty state inside the same Card frame
 * 3. Loaded   → aggregate + individual rows
 */
export function RatingsPage({ role, onBack, onLogout }: RatingsPageProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const query = useMyReceivedRatings();

  const items = query.data?.items ?? [];
  const avg = query.data?.avg_rating ?? null;
  const count = query.data?.review_count ?? 0;
  const avgLabel = avg !== null ? avg.toFixed(1) : '—';

  return (
    <div className="min-h-screen bg-surface">
      <Nav role={role} onBack={onBack} onLogout={onLogout} />
      <div
        className={[
          'max-w-[560px] mx-auto',
          isMobile ? 'px-4 py-5' : 'px-6 py-[30px]',
        ].join(' ')}
      >
        <div className="mb-6">
          <div className="font-bold text-2xl">{t('ratingsPageTitle')}</div>
        </div>

        {/* Aggregate ---------------------------------------------------- */}
        <Card className="mb-4 flex items-center gap-3.5">
          {query.isLoading ? (
            <>
              <Skeleton shape="sm" width={50} height={36} />
              <div className="flex-1">
                <Skeleton shape="sm" width="35%" height={14} className="mb-2" />
                <Skeleton shape="sm" width="20%" height={12} />
              </div>
            </>
          ) : (
            <>
              <div className="font-extrabold text-[34px] text-brand-700 leading-none">
                {avgLabel}
              </div>
              <div>
                <Stars rating={Math.round(avg ?? 0)} size={16} />
                <div className="text-[13px] text-gray-400 mt-1">
                  {count} {t('reviews')}
                </div>
              </div>
            </>
          )}
        </Card>

        {/* List --------------------------------------------------------- */}
        <Card>
          {query.isLoading ? (
            <SkeletonLines count={5} />
          ) : items.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">
              {t('reviews')} —
            </div>
          ) : (
            items.map((r, i) => (
              <RatingRow
                key={r.id}
                rating={r}
                isLast={i === items.length - 1}
              />
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

function RatingRow({
  rating: r,
  isLast,
}: {
  rating: RatingPublic;
  isLast: boolean;
}) {
  // We don't yet fetch the rater's display name — use the first 8 chars of
  // their UUID as a stand-in until M4 adds the join.
  const initial = r.rater_id.charAt(0).toUpperCase();
  const dateLabel = new Date(r.created_at).toLocaleDateString('de-DE');

  return (
    <div
      className={[
        isLast ? '' : 'pb-3.5 mb-3.5 border-b border-gray-100',
      ].join(' ')}
    >
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
            {initial}
          </div>
          <span className="font-medium text-sm">
            {r.rater_id.slice(0, 8)}…
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Stars rating={r.stars} size={13} />
          <span className="text-xs text-gray-400">{dateLabel}</span>
        </div>
      </div>
      {r.text_body && (
        <div className="text-sm text-gray-700 leading-normal pl-9">
          {r.text_body}
        </div>
      )}
    </div>
  );
}
