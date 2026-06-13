import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BarChart2, Bell, Check, Edit2, Map as MapIcon, MapPin, Pause, Play, Plus, RefreshCw, Trash2, X, Zap,
} from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';
import { useMyProfile, useUpsertMyProfile } from '../hooks/api/useProfile';
import {
  useCreateListing,
  useDeleteListing,
  useMyListings,
  useUpdateListing,
} from '../hooks/api/useListings';
import { Nav } from '../components/layout/Nav';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ProfileBanner } from '../components/ProfileBanner';
import { RatingModal } from '../components/modals/RatingModal';
import { TransformerModal } from '../components/modals/TransformerModal';
import { LocationPickerModal } from '../components/modals/LocationPickerModal';
import { setListingsCount, setUserTraits, track } from '../lib/analytics';
import type { ListingPublic } from '../lib/api-types';

export interface SellerDashProps {
  onLogout: () => void;
  onProfile: () => void;
  onRatings: () => void;
}

/**
 * Seller's home view, wired to the live backend.
 *
 * - **Listings** are fetched once via `useMyListings` and mutated optimistically
 *   (TanStack Query rolls back on error). Inline edits never trigger a full
 *   refetch — the cache is updated in place so the UI stays buttery.
 * - **Listing location/transformer** can be overridden per listing. When the
 *   form opens for a new listing we prefill from the seller's profile so the
 *   common case (one address, one transformer) takes zero extra clicks.
 * - **Notification panel** is a placeholder in M3; M4 wires real events.
 */
export function SellerDash({ onLogout, onProfile, onRatings }: SellerDashProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // --- Data ------------------------------------------------------------
  const profileQuery = useMyProfile();
  const listingsQuery = useMyListings();
  const profile = profileQuery.data ?? null;
  // Memoised so the reference is stable — keeps the analytics effects from
  // re-running on every render.
  const listings = useMemo(() => listingsQuery.data ?? [], [listingsQuery.data]);

  // --- Mutations -------------------------------------------------------
  const createListing = useCreateListing();
  const updateListing = useUpdateListing();
  const deleteListing = useDeleteListing();
  const upsertProfile = useUpsertMyProfile();

  // --- Local form state ------------------------------------------------
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formRate, setFormRate]           = useState('');
  const [formNightRate, setFormNightRate] = useState('');
  const [formShowNight, setFormShowNight] = useState(false);
  const [formCap, setFormCap]             = useState('');
  const [formAddress, setFormAddress]         = useState('');
  const [formLat, setFormLat]                 = useState<number | null>(null);
  const [formLng, setFormLng]                 = useState<number | null>(null);
  const [formTransformer, setFormTransformer] = useState('');
  const [formShowMap, setFormShowMap]         = useState(false);

  // --- Local UI state --------------------------------------------------
  const [showRate, setShowRate]               = useState(false);
  const [buyerRated, setBuyerRated]           = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showTransformerModal, setShowTransformerModal] = useState(false);

  const showBanner = profile && !profile.transformer_id && !bannerDismissed;

  // --- Analytics -------------------------------------------------------

  // Keep the session listing count fresh so logout/delete can report it.
  useEffect(() => {
    if (!listingsQuery.isLoading) setListingsCount(listings.length);
  }, [listingsQuery.isLoading, listings.length]);

  // Enrich the Mixpanel People profile + correct the GeoIP city once the
  // seller's profile has loaded.
  useEffect(() => {
    if (!profile) return;
    setUserTraits({
      name: profile.display_name,
      whatsapp: profile.whatsapp_e164,
      address: profile.address_text,
      transformer: profile.transformer_code,
      lat: profile.latitude,
      lng: profile.longitude,
    });
  }, [profile]);

  // Fire `dashboard_views` once per mount, after listings have loaded.
  const dashboardTracked = useRef(false);
  useEffect(() => {
    if (dashboardTracked.current || listingsQuery.isLoading) return;
    dashboardTracked.current = true;
    track('dashboard_views', {
      account_type: 'seller',
      user_id: user?.id ?? '',
      listings_count: listings.length,
      daytime_listings: listings.length,
      nighttime_listings: listings.filter((l) => l.night_rate != null).length,
    });
  }, [listingsQuery.isLoading, listings, user]);

  // --- Handlers --------------------------------------------------------

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormRate('');
    setFormNightRate('');
    setFormShowNight(false);
    setFormCap('');
    setFormAddress('');
    setFormLat(null);
    setFormLng(null);
    setFormTransformer('');
    setFormShowMap(false);
  };

  /** Open the form blank, prefilled from the seller's profile. */
  const openAddForm = () => {
    setEditingId(null);
    setFormRate('');
    setFormNightRate('');
    setFormShowNight(false);
    setFormCap('');
    setFormAddress(profile?.address_text ?? '');
    setFormLat(profile?.latitude ?? null);
    setFormLng(profile?.longitude ?? null);
    setFormTransformer(profile?.transformer_code ?? '');
    setShowForm(true);
  };

  const saveListing = () => {
    const nightRate = formShowNight && formNightRate ? formNightRate : null;
    const body = {
      day_rate: formRate,
      night_rate: nightRate,
      capacity_kwh: parseInt(formCap, 10),
      address_text: formAddress || null,
      latitude: formLat,
      longitude: formLng,
      transformer_code: formTransformer || null,
    };
    const dayPrice = Number(body.day_rate);
    const nightPrice = body.night_rate != null ? Number(body.night_rate) : null;
    if (editingId !== null) {
      updateListing.mutate(
        { id: editingId, body },
        {
          onSuccess: () => {
            track('edit_listing', {
              user_id: user?.id ?? '',
              updated_daytime_price: dayPrice,
              updated_nighttime_price: nightPrice,
              updated_monthly_capacity: body.capacity_kwh,
            });
            resetForm();
          },
        },
      );
    } else {
      createListing.mutate(body, {
        onSuccess: () => {
          track('seller_add_listing', {
            user_id: user?.id ?? '',
            daytime_price: dayPrice,
            nighttime_price: nightPrice,
            monthly_capacity: body.capacity_kwh,
          });
          resetForm();
        },
      });
    }
  };

  const startEdit = (listing: ListingPublic) => {
    setEditingId(listing.id);
    setFormRate(listing.day_rate);
    setFormCap(String(listing.capacity_kwh));
    setFormShowNight(listing.night_rate != null);
    setFormNightRate(listing.night_rate ?? '');
    setFormAddress(listing.address_text ?? profile?.address_text ?? '');
    // Prefer the listing's own coords; fall back to profile so the map
    // opens somewhere sensible even for old rows pinned before this change.
    setFormLat(listing.latitude ?? profile?.latitude ?? null);
    setFormLng(listing.longitude ?? profile?.longitude ?? null);
    setFormTransformer(listing.transformer_code ?? profile?.transformer_code ?? '');
    setShowForm(true);
  };

  /** Did the user accept the profile's prefilled values without editing? */
  const addressPrefilled =
    !editingId &&
    !!profile?.address_text &&
    formAddress === profile.address_text;
  const transformerPrefilled =
    !editingId &&
    !!profile?.transformer_code &&
    formTransformer === profile.transformer_code;

  // --- Stats -----------------------------------------------------------

  const activeCount = listings.filter((l) => l.active).length;
  const avgPrice =
    listings.length
      ? (
          listings.reduce((sum, l) => sum + Number(l.day_rate), 0) /
          listings.length
        ).toFixed(2)
      : '–';
  const totalCapacity = listings.reduce(
    (sum, l) => sum + (l.active ? l.capacity_kwh : 0),
    0,
  );

  const stats: Array<{ label: string; value: ReactNode; icon: ReactNode; bg: string }> = [
    {
      label: t('statActive'),
      value: activeCount,
      icon: <Zap size={16} className="text-brand-700" />,
      bg: 'bg-brand-50',
    },
    {
      label: t('statAvgPrice'),
      value: avgPrice,
      icon: <BarChart2 size={16} className="text-blue-700" />,
      bg: 'bg-blue-50',
    },
    {
      label: t('statTotalCap'),
      value: `${totalCapacity} kWh`,
      icon: <RefreshCw size={16} className="text-amber-600" />,
      bg: 'bg-amber-100',
    },
  ];

  // --- Notification panel (placeholder for M4) ------------------------

  const notificationsPanel = (
    <Card className="px-[18px] py-4">
      <div className="flex gap-2.5 items-start">
        <div className="bg-amber-100 p-2 rounded-[9px] flex-shrink-0">
          <Bell size={16} className="text-amber-600" />
        </div>
        <div>
          <div className="font-semibold text-sm mb-1">{t('newBuyerTitle')}</div>
          <div className="text-[13px] text-gray-500 mb-2">{t('newBuyerDesc')}</div>
          <div className="text-[11px] text-gray-400">{t('notifTime')}</div>
          {!buyerRated ? (
            <button
              type="button"
              onClick={() => {
                track('rate_clicked', {
                  account_type: 'seller',
                  buyer_user_id: null,
                  seller_user_id: user?.id ?? null,
                });
                setShowRate(true);
              }}
              className="mt-2 bg-brand-50 border border-brand-200 hover:bg-brand-100 rounded-md px-3 py-1.5 text-xs text-brand-700 cursor-pointer font-medium transition-colors"
            >
              {t('rateBuyerBtn')}
            </button>
          ) : (
            <div className="mt-2">
              <Badge color="green">✓ {t('ratedBadge')}</Badge>
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  // --- Render ----------------------------------------------------------

  return (
    <div className="min-h-screen bg-surface">
      {showRate && (
        <RatingModal
          target={`Max Müller (${t('buyer')})`}
          onClose={() => {
            track('rate_seller_clicked', {
              account_type: 'seller',
              buyer_user_id: null,
              seller_user_id: user?.id ?? null,
              rating: null,
              skip: true,
            });
            setShowRate(false);
          }}
          onSubmit={(stars) => {
            track('rate_seller_clicked', {
              account_type: 'seller',
              buyer_user_id: null,
              seller_user_id: user?.id ?? null,
              rating: stars,
              skip: false,
            });
            setBuyerRated(true);
            setShowRate(false);
          }}
        />
      )}
      {showTransformerModal && (
        <TransformerModal
          onClose={() => setShowTransformerModal(false)}
          onSave={(code) =>
            upsertProfile.mutate({
              // Full-replace PUT — carry over the saved geo so adding a
              // transformer doesn't wipe the seller's pinned location.
              // `display_name` has a server min_length of 2; fall back to the
              // email local-part for a profile that doesn't exist yet.
              display_name:
                profile?.display_name ||
                user?.email?.split('@')[0] ||
                'User',
              whatsapp_e164: profile?.whatsapp_e164 ?? null,
              address_text: profile?.address_text ?? null,
              latitude: profile?.latitude ?? null,
              longitude: profile?.longitude ?? null,
              transformer_code: code,
              monthly_demand_kwh: profile?.monthly_demand_kwh ?? null,
            })
          }
        />
      )}
      {formShowMap && (
        <LocationPickerModal
          initial={{
            address: formAddress,
            lat: formLat,
            lng: formLng,
          }}
          onClose={() => setFormShowMap(false)}
          onConfirm={(v) => {
            setFormAddress(v.address);
            setFormLat(v.lat);
            setFormLng(v.lng);
          }}
        />
      )}

      <Nav
        role="seller"
        onLogout={onLogout}
        onProfile={onProfile}
        onRatings={onRatings}
        notifications={notificationsPanel}
        notifCount={buyerRated ? 0 : 1}
        onNotifOpen={() =>
          track('notification_icon_clicked', {
            user_id: user?.id ?? '',
            new_notifications: buyerRated ? 0 : 1,
            total_notifications: 1,
          })
        }
      />

      <div
        className={[
          'max-w-[900px] mx-auto',
          isMobile ? 'px-4 py-5' : 'px-6 py-7',
        ].join(' ')}
      >
        {showBanner && (
          <ProfileBanner
            onAdd={() => {
              track('transformer_info_clicked', {
                user_id: user?.id ?? null,
                source: 'seller_dashboard',
              });
              setShowTransformerModal(true);
            }}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}

        <div className="mb-7">
          <div className="font-bold text-2xl mb-1">{t('sellerDashTitle')}</div>
          <div className="text-sm text-gray-400">{t('sellerDashSub')}</div>
        </div>

        {/* KPI tiles */}
        <div
          className={[
            'grid gap-3.5 mb-7',
            isMobile ? 'grid-cols-1' : 'grid-cols-3',
          ].join(' ')}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white border border-gray-200/70 rounded-xl px-[18px] py-4"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="text-[13px] text-gray-400">{s.label}</div>
                <div className={['p-1.5 rounded-md', s.bg].join(' ')}>{s.icon}</div>
              </div>
              <div className="font-bold text-[22px] text-gray-900">
                {listingsQuery.isLoading ? (
                  <Skeleton shape="sm" width={60} height={22} />
                ) : (
                  s.value
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Listings */}
        <div>
          <div className="flex justify-between items-center mb-3.5">
            <div className="font-semibold text-[17px]">{t('myListings')}</div>
            <Button small icon={<Plus size={13} />} onClick={openAddForm}>
              {t('addBtn')}
            </Button>
          </div>

          {showForm && (
            <Card className="mb-3.5 border-[1.5px] border-brand-200">
              <div className="font-semibold text-[15px] mb-3.5">
                {editingId !== null ? t('editListingTitle') : t('newListingTitle')}
              </div>
              <div className="flex flex-col gap-3">
                <Input
                  label={t('rateLabel')}
                  type="number"
                  value={formRate}
                  onChange={setFormRate}
                  placeholder={t('ratePlaceholder')}
                />
                {formShowNight ? (
                  <div>
                    <Input
                      label={t('nightRateLabel')}
                      type="number"
                      value={formNightRate}
                      onChange={setFormNightRate}
                      placeholder={t('nightRatePlaceholder')}
                      hint={t('nightRateHint')}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFormShowNight(false);
                        setFormNightRate('');
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 bg-transparent text-red-600 border-none py-1 text-xs font-medium cursor-pointer"
                    >
                      <X size={13} />
                      {t('removeNightRate')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFormShowNight(true)}
                    className="inline-flex items-center gap-1 bg-transparent text-brand-700 border-none py-1 text-xs font-medium cursor-pointer self-start"
                  >
                    <Plus size={13} />
                    {t('addNightRate')}
                  </button>
                )}
                <Input
                  label={t('capacityLabel')}
                  type="number"
                  value={formCap}
                  onChange={setFormCap}
                  placeholder={t('capacityPlaceholder')}
                />

                {/* Listing location — read-only chip + "choose on map" button */}
                <div>
                  <label className="text-[13px] font-medium text-gray-700 block mb-1.5">
                    {t('listingLocationLabel')}
                  </label>
                  <div className="flex gap-2 items-center flex-wrap">
                    <div
                      className={[
                        'flex-1 min-w-[220px] py-2 px-3 bg-surface border border-gray-200 rounded-md text-[13px] flex items-center gap-1.5 truncate',
                        formAddress ? 'text-gray-900' : 'text-gray-400',
                      ].join(' ')}
                    >
                      <MapPin size={13} className="text-brand-700 flex-shrink-0" />
                      <span className="truncate">
                        {formAddress || t('addressPlaceholder')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormShowMap(true)}
                      className="bg-transparent border border-brand-700 rounded-md px-3 py-2 cursor-pointer text-brand-700 text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-brand-50 transition-colors whitespace-nowrap"
                    >
                      <MapIcon size={13} />
                      {t('chooseOnMap')}
                    </button>
                  </div>
                  {addressPrefilled && (
                    <div className="text-[11px] text-gray-400 mt-1">
                      {t('prefilledFromProfile')}
                    </div>
                  )}
                </div>

                {/* Listing transformer */}
                <div>
                  <Input
                    label={t('listingTransformerLabel')}
                    value={formTransformer}
                    onChange={setFormTransformer}
                    placeholder={t('transformerPlaceholder')}
                  />
                  {transformerPrefilled && (
                    <div className="text-[11px] text-gray-400 mt-1">
                      {t('prefilledFromProfile')}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="ghost" small onClick={resetForm}>
                  {t('cancel')}
                </Button>
                <Button
                  small
                  disabled={
                    !formRate ||
                    !formCap ||
                    createListing.isPending ||
                    updateListing.isPending
                  }
                  onClick={saveListing}
                  icon={<Check size={13} />}
                >
                  {editingId !== null ? t('save') : t('create')}
                </Button>
              </div>
            </Card>
          )}

          {listingsQuery.isLoading ? (
            <ListingsSkeleton />
          ) : (
            <div className="flex flex-col gap-2.5">
              {listings.map((l) => (
                <ListingRow
                  key={l.id}
                  listing={l}
                  onEdit={() => startEdit(l)}
                  onToggle={() =>
                    updateListing.mutate({
                      id: l.id,
                      body: { active: !l.active },
                    })
                  }
                  onDelete={() =>
                    deleteListing.mutate(l.id, {
                      onSuccess: () =>
                        track('remove_listing', {
                          user_id: user?.id ?? '',
                          daytime_price: Number(l.day_rate),
                          nighttime_price:
                            l.night_rate != null ? Number(l.night_rate) : null,
                          monthly_capacity: l.capacity_kwh,
                        }),
                    })
                  }
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ListingRowProps {
  listing: ListingPublic;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  t: (key: never) => string;
}

function ListingRow({ listing: l, onEdit, onToggle, onDelete, t }: ListingRowProps) {
  const tt = t as (k: string) => string;
  return (
    <div
      className={[
        'bg-white border rounded-xl px-4 py-3.5 flex items-center gap-3',
        l.active ? 'border-brand-200' : 'border-gray-200/70',
      ].join(' ')}
    >
      <div
        className={[
          'p-2 rounded-[9px] flex-shrink-0',
          l.active ? 'bg-brand-50' : 'bg-gray-50',
        ].join(' ')}
      >
        <Zap size={16} className={l.active ? 'text-brand-700' : 'text-gray-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
          <span>☀ {Number(l.day_rate).toFixed(2)} €/kWh</span>
          {l.night_rate != null && (
            <span className="text-gray-500 font-medium">
              · 🌙 {Number(l.night_rate).toFixed(2)} €/kWh
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400">
          {l.capacity_kwh} {tt('perMonth')}
        </div>
        {(l.address_text || l.transformer_code) && (
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
            {l.address_text && (
              <span className="inline-flex items-center gap-1 max-w-full truncate">
                <MapPin size={11} className="text-brand-700 flex-shrink-0" />
                <span className="truncate">{l.address_text}</span>
              </span>
            )}
            {l.address_text && l.transformer_code && (
              <span className="text-gray-300">·</span>
            )}
            {l.transformer_code && (
              <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                <Zap size={11} className="text-brand-700 flex-shrink-0" />
                {l.transformer_code}
              </span>
            )}
          </div>
        )}
      </div>
      <Badge color={l.active ? 'green' : 'gray'}>
        {l.active ? tt('active') : tt('paused')}
      </Badge>
      <div className="flex gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="bg-transparent border border-gray-200 rounded-md px-2 py-1.5 cursor-pointer text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Edit2 size={13} />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={l.active ? tt('paused') : tt('active')}
          className="bg-transparent border border-gray-200 rounded-md px-2 py-1.5 cursor-pointer text-gray-500 hover:bg-gray-50 transition-colors"
        >
          {l.active ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="bg-transparent border border-red-200 rounded-md px-2 py-1.5 cursor-pointer text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function ListingsSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200/70 rounded-xl px-4 py-3.5 flex items-center gap-3"
        >
          <Skeleton shape="md" width={32} height={32} />
          <div className="flex-1">
            <Skeleton shape="sm" width="50%" height={14} className="mb-2" />
            <Skeleton shape="sm" width="30%" height={12} />
          </div>
          <Skeleton shape="pill" width={60} height={20} />
        </div>
      ))}
    </div>
  );
}
