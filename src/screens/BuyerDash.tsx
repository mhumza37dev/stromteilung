import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronDown, Copy, MapPin, MessageCircle, Share2, Star,
} from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useIsMobile } from '../hooks/useIsMobile';
import { useMyProfile, useUpsertMyProfile } from '../hooks/api/useProfile';
import { useNearbySellers } from '../hooks/api/useNearbySellers';
import { useRecordInquiry } from '../hooks/api/useInquiry';
import { useCreateRating } from '../hooks/api/useRatings';
import { Nav } from '../components/layout/Nav';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Stars } from '../components/ui/Stars';
import { ProfileBanner } from '../components/ProfileBanner';
import { RatingModal } from '../components/modals/RatingModal';
import { TransformerModal } from '../components/modals/TransformerModal';
import { LocationPickerModal } from '../components/modals/LocationPickerModal';
import { Skeleton } from '../components/ui/Skeleton';
import {
  bumpWhatsappClicks,
  setUserTraits,
  track,
  type BuyerFilter,
} from '../lib/analytics';
import type { NearbySeller } from '../lib/api-types';

/** Map the internal filter key to the analytics-spec value. */
const FILTER_EVENT: Record<Filter, BuyerFilter> = {
  all: 'all',
  cheap: 'cheapest',
  top: 'top_rated',
};

export interface BuyerDashProps {
  onLogout: () => void;
  onProfile: () => void;
}

type Filter = 'all' | 'cheap' | 'top';

/**
 * Buyer's home view, wired to the live backend.
 *
 * - **Location** comes from the buyer's saved profile (no in-place geocoder
 *   in v1; users edit their address via the Profile page).
 * - **Seller list** comes from `/sellers/nearby` — React Query keeps the
 *   previous list visible while the new one loads so filter changes never
 *   blank the grid.
 * - **WhatsApp clicks** fire-and-forget an inquiry to the backend (the
 *   backend dedupes within 1h so a double-click is harmless), then the
 *   rating modal pops 3 seconds later.
 */
export function BuyerDash({ onLogout, onProfile }: BuyerDashProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();

  // --- Data fetches ----------------------------------------------------
  const profileQuery = useMyProfile();
  const nearbyQuery = useNearbySellers({
    // Omitting lat/lng makes the backend resolve the buyer's profile geo
    // server-side. Wait until the profile loads so we don't fire a guaranteed
    // 422 against an unset address.
    lat: null,
    lng: null,
    radiusM: 1500,
    enabled:
      !profileQuery.isLoading &&
      !!profileQuery.data &&
      !!profileQuery.data.address_text,
  });

  // --- Mutations -------------------------------------------------------
  const recordInquiry = useRecordInquiry();
  const submitRating  = useCreateRating();
  const upsertProfile = useUpsertMyProfile();

  // --- Local UI state --------------------------------------------------
  const [filter, setFilter] = useState<Filter>('all');
  const [rateTarget, setRateTarget] = useState<NearbySeller | null>(null);
  const [rated, setRated] = useState<Record<string, boolean>>({});
  const [referralCopied, setReferralCopied] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showTransformerModal, setShowTransformerModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // --- Derived ---------------------------------------------------------
  const profile = profileQuery.data ?? null;
  // Memoised so the reference is stable across renders — keeps the
  // `dashboard_views` effect and `filteredSellers` memo from re-running on
  // every render.
  const sellers = useMemo(() => nearbyQuery.data?.items ?? [], [nearbyQuery.data]);

  // Single source of truth for "we don't yet know what to show". Without this
  // the grid flashed: while the profile loaded the nearby query was disabled
  // (so `isLoading` was false) → the empty state rendered for a frame → then
  // the profile resolved, the nearby query enabled and started fetching → the
  // skeleton appeared → then the list. Gating on both phases collapses that
  // "empty → loader → list" sequence into a single skeleton.
  //
  // `nearbyQuery.isPending` stays true from the moment the query is created
  // (even while disabled) until the first successful response, so once the
  // profile has an address we keep showing the skeleton straight through the
  // hand-off into the real fetch.
  const resolvingSellers =
    profileQuery.isLoading ||
    (!!profile?.address_text && nearbyQuery.isPending);

  // Fire `dashboard_views` exactly once per mount, after the nearby sellers
  // have resolved so the listing counts are meaningful.
  const dashboardTracked = useRef(false);
  useEffect(() => {
    if (dashboardTracked.current || resolvingSellers || !profile) return;
    dashboardTracked.current = true;
    // Enrich the Mixpanel People profile + correct the GeoIP city.
    setUserTraits({
      name: profile.display_name,
      whatsapp: profile.whatsapp_e164,
      address: profile.address_text,
      transformer: profile.transformer_code,
      monthlyDemandKwh: profile.monthly_demand_kwh,
      lat: profile.latitude,
      lng: profile.longitude,
    });
    track('dashboard_views', {
      account_type: 'buyer',
      user_id: profile.user_id,
      listings_count: sellers.length,
      daytime_listings: sellers.length,
      nighttime_listings: sellers.filter((s) => s.night_rate != null).length,
    });
  }, [resolvingSellers, profile, sellers]);

  const filteredSellers = useMemo(() => {
    if (filter === 'all') return sellers;
    if (filter === 'cheap') return [...sellers].sort((a, b) => Number(a.day_rate) - Number(b.day_rate));
    return [...sellers].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
  }, [sellers, filter]);

  const showBanner = profile && !profile.transformer_id && !bannerDismissed;

  // --- Handlers --------------------------------------------------------

  const handleWhatsAppClick = (seller: NearbySeller) => {
    // NORTH STAR — a buyer reaching out is the core value event. Fire it with
    // the full seller context so funnels can segment on price/distance/rating.
    track('whatsapp_clicked', {
      buyer_user_id: profile?.user_id ?? null,
      seller_user_id: seller.seller_id,
      daytime_cost: Number(seller.day_rate),
      nighttime_cost: seller.night_rate != null ? Number(seller.night_rate) : null,
      capacity: seller.capacity_kwh,
      distance: seller.distance_m,
      transformer_no: seller.transformer_code,
      rating: seller.avg_rating,
      review_count: seller.review_count,
    });
    // Bump the session counter so logout/delete can report total reach-outs.
    bumpWhatsappClicks();

    // Fire-and-forget — never block the redirect on this network call.
    recordInquiry.mutate(
      { seller_id: seller.seller_id, listing_id: seller.listing_id },
      { onError: () => {/* silent — analytics, not user-blocking */} },
    );
    // Pop the rating prompt a few seconds after they leave for WhatsApp.
    window.setTimeout(() => setRateTarget(seller), 3000);
  };

  const handleRatingSubmit = (stars: number) => {
    if (!rateTarget) return;
    track('rate_seller_clicked', {
      account_type: 'buyer',
      buyer_user_id: profile?.user_id ?? null,
      seller_user_id: rateTarget.seller_id,
      rating: stars,
      skip: false,
    });
    submitRating.mutate(
      { target_id: rateTarget.seller_id, stars },
      {
        onSuccess: () => {
          setRated((p) => ({ ...p, [rateTarget.seller_id]: true }));
          setRateTarget(null);
        },
        onError: () => {
          // Keep the modal open so the user can retry; surface a small hint
          // via the existing error styling later if needed.
          setRateTarget(null);
        },
      },
    );
  };

  const copyReferral = () => {
    navigator.clipboard?.writeText('stromteilung.de/einladen/K-2847').catch(() => {});
    setReferralCopied(true);
    window.setTimeout(() => setReferralCopied(false), 2000);
  };

  // --- Render ----------------------------------------------------------

  const locationLabel = profile?.address_text ?? t('emptyTitle');

  return (
    <div className="min-h-screen bg-surface">
      {rateTarget && (
        <RatingModal
          target={rateTarget.display_name}
          onClose={() => {
            track('rate_seller_clicked', {
              account_type: 'buyer',
              buyer_user_id: profile?.user_id ?? null,
              seller_user_id: rateTarget.seller_id,
              rating: null,
              skip: true,
            });
            setRateTarget(null);
          }}
          onSubmit={handleRatingSubmit}
        />
      )}
      {showTransformerModal && (
        <TransformerModal
          onClose={() => setShowTransformerModal(false)}
          onSave={(code) =>
            upsertProfile.mutate({
              display_name: profile?.display_name ?? '',
              whatsapp_e164: profile?.whatsapp_e164 ?? null,
              address_text: profile?.address_text ?? null,
              transformer_code: code,
              monthly_demand_kwh: profile?.monthly_demand_kwh ?? null,
            })
          }
        />
      )}
      {showLocationModal && (
        <LocationPickerModal
          initial={{
            address: profile?.address_text ?? '',
            lat: profile?.latitude ?? null,
            lng: profile?.longitude ?? null,
          }}
          onClose={() => setShowLocationModal(false)}
          onConfirm={(v) =>
            upsertProfile.mutate({
              // Server enforces display_name min_length=2 — fall back to a
              // non-empty value so an empty profile state still saves cleanly.
              display_name: profile?.display_name || 'User',
              whatsapp_e164: profile?.whatsapp_e164 ?? null,
              address_text: v.address || null,
              latitude: v.lat,
              longitude: v.lng,
              monthly_demand_kwh: profile?.monthly_demand_kwh ?? null,
            })
          }
        />
      )}

      <Nav role="buyer" onLogout={onLogout} onProfile={onProfile} />

      {/* Location bar — opens the map picker so the buyer can re-pin in place
          without losing dashboard context. */}
      <button
        type="button"
        onClick={() => setShowLocationModal(true)}
        className="w-full bg-white border-b border-gray-200/70 px-6 py-3 flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors text-left"
      >
        <MapPin size={16} className="text-brand-700" />
        <span className="text-sm font-medium text-gray-900 truncate flex-1">
          {locationLabel}
        </span>
        <span className="text-xs text-gray-400">· {t('radiusLabel')}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      <div className={['max-w-[1100px] mx-auto', isMobile ? 'p-4' : 'p-6'].join(' ')}>
        {showBanner && (
          <ProfileBanner
            onAdd={() => setShowTransformerModal(true)}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}

        {/* Filter chips — visible whenever we expect to render results */}
        {(resolvingSellers || filteredSellers.length > 0) && (
          <div className="flex gap-2 mb-[22px] flex-wrap items-center">
            <span className="text-[13px] text-gray-500 font-medium">
              {resolvingSellers
                ? '…'
                : `${filteredSellers.length} ${t('foundSellers')}`}
            </span>
            <div className="flex gap-1.5 ml-auto">
              {(
                [
                  ['all', t('filterAll')],
                  ['cheap', t('filterCheap')],
                  ['top', t('filterTop')],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFilter(value);
                    track('filter_clicked', {
                      buyer_user_id: profile?.user_id ?? null,
                      filter: FILTER_EVENT[value],
                    });
                  }}
                  className={[
                    'px-3.5 py-1.5 rounded-full border-[1.5px] text-[13px] cursor-pointer transition-colors',
                    filter === value
                      ? 'bg-brand-50 border-brand-700 text-brand-700 font-semibold'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- States: loading / empty / list ---------------------- */}
        {resolvingSellers ? (
          <SellerCardGridSkeleton isMobile={isMobile} />
        ) : filteredSellers.length === 0 ? (
          <EmptyState
            referralCopied={referralCopied}
            onCopyReferral={copyReferral}
            t={t}
          />
        ) : (
          <div
            className={[
              'grid gap-4',
              isMobile
                ? 'grid-cols-1'
                : 'grid-cols-[repeat(auto-fill,minmax(270px,1fr))]',
            ].join(' ')}
          >
            {filteredSellers.map((s) => (
              <SellerCard
                key={s.seller_id}
                seller={s}
                rated={!!rated[s.seller_id]}
                onWhatsAppClick={() => handleWhatsAppClick(s)}
                onRateClick={() => {
                  track('rate_clicked', {
                    account_type: 'buyer',
                    buyer_user_id: profile?.user_id ?? null,
                    seller_user_id: s.seller_id,
                  });
                  setRateTarget(s);
                }}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components — extracted to keep BuyerDash's render block readable.
// ---------------------------------------------------------------------------

/**
 * Build a WhatsApp deep link that resolves correctly per device:
 * - Mobile → `https://wa.me/…`, which the OS hands off to the installed app.
 * - Desktop/web → `https://web.whatsapp.com/send`, opening WhatsApp Web in the
 *   browser instead of bouncing through wa.me's "open in app?" interstitial
 *   (which on desktop just re-opens our own tab).
 */
function whatsappLink(e164: string, text: string): string {
  const phone = e164.replace(/[^\d]/g, '');
  const msg = encodeURIComponent(text);
  const isMobile =
    typeof navigator !== 'undefined' &&
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  return isMobile
    ? `https://wa.me/${phone}?text=${msg}`
    : `https://web.whatsapp.com/send?phone=${phone}&text=${msg}`;
}

interface SellerCardProps {
  seller: NearbySeller;
  rated: boolean;
  onWhatsAppClick: () => void;
  onRateClick: () => void;
  t: (key: never) => string;
}

function SellerCard({ seller: s, rated, onWhatsAppClick, onRateClick, t }: SellerCardProps) {
  const tt = t as (k: string) => string;
  // Prefill the chat with a localized opener, personalised with the seller's
  // name. WhatsApp carries it via the `text` query param.
  const waMessage = tt('whatsappMessage').replace('{name}', s.display_name);
  const waHref = s.whatsapp_e164
    ? whatsappLink(s.whatsapp_e164, waMessage)
    : '#';
  return (
    <div className="bg-white border border-gray-200/70 rounded-[14px] overflow-hidden">
      {/* Header — gradient with name + price */}
      <div className="bg-gradient-to-br from-brand-50 to-brand-100 px-[18px] pt-[18px] pb-3.5 border-b border-gray-200/70">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-bold text-base text-gray-900 mb-1">
              {s.display_name}
            </div>
            <div className="text-xs text-gray-500 flex gap-1 items-center">
              <MapPin size={11} />
              {s.address_text ?? '—'}
            </div>
          </div>
          <div className="bg-white rounded-lg px-2.5 py-1.5 text-center shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
            {s.night_rate != null ? (
              <div className="flex gap-2.5">
                <div>
                  <div className="font-extrabold text-[17px] text-brand-700">
                    ☀ {Number(s.day_rate).toFixed(2)}
                  </div>
                  <div className="text-[9px] text-gray-400">{(t as (k: string) => string)('perKwh')}</div>
                </div>
                <div className="border-l border-gray-200 pl-2.5">
                  <div className="font-extrabold text-[17px] text-blue-700">
                    🌙 {Number(s.night_rate).toFixed(2)}
                  </div>
                  <div className="text-[9px] text-gray-400">{(t as (k: string) => string)('perKwh')}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="font-extrabold text-[20px] text-brand-700">
                  {Number(s.day_rate).toFixed(2)}
                </div>
                <div className="text-[10px] text-gray-400">{(t as (k: string) => string)('perKwh')}</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-[18px] py-3.5">
        <div className="grid grid-cols-3 gap-2 mb-3.5">
          {(
            [
              [(t as (k: string) => string)('colCapacity'), `${s.capacity_kwh} kWh`],
              [(t as (k: string) => string)('colDistance'), `${s.distance_m}m`],
              [(t as (k: string) => string)('colTrafo'), s.transformer_code ?? '—'],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-surface rounded-md px-2 py-1.5 text-center">
              <div className="text-xs font-semibold text-gray-900">{value}</div>
              <div className="text-[10px] text-gray-400">{label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mb-3.5">
          <Stars rating={s.avg_rating ?? 0} />
          <span className="text-[13px] font-semibold">
            {s.avg_rating != null ? s.avg_rating.toFixed(1) : '–'}
          </span>
          <span className="text-xs text-gray-400">
            ({s.review_count} {(t as (k: string) => string)('reviews')})
          </span>
          {rated && (
            <span className="ml-auto">
              <Badge color="green">✓ {(t as (k: string) => string)('ratedBadge')}</Badge>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!s.whatsapp_e164}
            onClick={(e) => {
              // No number → nothing to open; keep the dead link inert.
              if (!s.whatsapp_e164) {
                e.preventDefault();
                return;
              }
              // Fire analytics, but DON'T preventDefault — the anchor's own
              // navigation (href + target=_blank) is what actually opens
              // WhatsApp Web / the app. Calling preventDefault here was
              // swallowing the click so nothing opened.
              onWhatsAppClick();
            }}
            className={`flex-1 bg-[#25d366] hover:bg-[#1ebe5d] text-white border-none rounded-lg py-2.5 flex items-center justify-center gap-1.5 text-sm font-medium cursor-pointer no-underline transition-colors ${!s.whatsapp_e164 ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          >
            <MessageCircle size={15} />
            {(t as (k: string) => string)('whatsappBtn')}
          </a>
          {!rated && (
            <button
              type="button"
              onClick={onRateClick}
              className="bg-amber-100 hover:bg-amber-200 border-none rounded-lg px-3.5 py-2.5 cursor-pointer text-amber-600 transition-colors"
            >
              <Star size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  referralCopied,
  onCopyReferral,
  t,
}: {
  referralCopied: boolean;
  onCopyReferral: () => void;
  t: (key: never) => string;
}) {
  const tt = t as (k: string) => string;
  return (
    <div className="text-center py-[60px] px-6">
      <div className="w-[72px] h-[72px] rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
        <MapPin size={30} className="text-amber-600" />
      </div>
      <div className="font-bold text-[22px] mb-2">{tt('emptyTitle')}</div>
      <div className="text-[15px] text-gray-400 max-w-[380px] mx-auto mb-7 leading-relaxed">
        {tt('emptyDesc')}
      </div>
      <div className="bg-white border border-gray-200/70 rounded-[14px] p-6 max-w-[400px] mx-auto">
        <div className="font-semibold text-[15px] mb-2">{tt('referralTitle')}</div>
        <div className="text-[13px] text-gray-400 mb-3.5">{tt('referralDesc')}</div>
        <div className="flex gap-2 bg-surface border border-gray-200 rounded-lg px-3 py-2 mb-3.5 items-center">
          <code className="text-[13px] flex-1 text-gray-700">
            stromteilung.com/einladen/K-2847
          </code>
          <button
            type="button"
            onClick={onCopyReferral}
            className="bg-transparent border-none cursor-pointer text-brand-700"
          >
            {referralCopied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <Button
          full
          variant="outline"
          icon={<Share2 size={14} />}
          onClick={onCopyReferral}
        >
          {referralCopied ? tt('copied') : tt('copyLink')}
        </Button>
      </div>
    </div>
  );
}

function SellerCardGridSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      className={[
        'grid gap-4',
        isMobile ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(270px,1fr))]',
      ].join(' ')}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200/70 rounded-[14px] overflow-hidden">
          <div className="bg-gradient-to-br from-brand-50 to-brand-100 px-[18px] pt-[18px] pb-3.5 border-b border-gray-200/70">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <Skeleton shape="sm" width="80%" height={16} className="mb-2" />
                <Skeleton shape="sm" width="55%" height={12} />
              </div>
              <Skeleton shape="md" width={70} height={42} />
            </div>
          </div>
          <div className="px-[18px] py-3.5">
            <div className="grid grid-cols-3 gap-2 mb-3.5">
              <Skeleton shape="sm" height={36} />
              <Skeleton shape="sm" height={36} />
              <Skeleton shape="sm" height={36} />
            </div>
            <Skeleton shape="sm" width="60%" height={14} className="mb-3.5" />
            <Skeleton shape="md" width="100%" height={36} />
          </div>
        </div>
      ))}
    </div>
  );
}
