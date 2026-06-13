import { useState } from 'react';
import { BarChart2, Info, Loader2, Phone, Plus, X, Zap } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';
import { useUpsertMyProfile } from '../hooks/api/useProfile';
import { useCreateListing } from '../hooks/api/useListings';
import { Nav } from '../components/layout/Nav';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { MapPicker } from '../components/MapPicker';
import { TransformerPopup } from '../components/modals/TransformerPopup';
import { ApiError } from '../lib/api';
import { accountTypeFor, track } from '../lib/analytics';
import type { Role, UserProfile } from '../types';

export interface OnboardingProps {
  role: Role;
  /**
   * Notify the parent that the profile has been persisted.
   *
   * The parent navigates to the role-specific dashboard. We deliberately
   * call this *after* the upsert resolves so the dashboard's first paint
   * already has the profile in the React Query cache (no flicker).
   */
  onComplete: () => void;
  onBack: () => void;
}

/**
 * Two-step onboarding wizard following registration.
 *
 * Step 1 — Identity & location (shared by both roles).
 * Step 2 — Role-specific:
 *           buyer → monthly demand;
 *           seller → first listing (day rate + capacity + optional night rate).
 *
 * Progress bar at the top mirrors the step count and label so users know how
 * much is left.
 */
export function Onboarding({ role, onComplete, onBack }: OnboardingProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const upsertProfile = useUpsertMyProfile();
  const createListing = useCreateListing();

  const [step, setStep] = useState<1 | 2>(1);
  const [showPopup, setShowPopup] = useState(false);
  const [showNightRate, setShowNightRate] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [data, setData] = useState<UserProfile>({
    whatsapp: '',
    address: '',
    transformer: '',
    requirement: '',
    rate: '',
    nightRate: '',
    capacity: '',
  });

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  /** Build the backend body and submit. Triggered by the final "Let's go" CTA. */
  const handleFinish = async () => {
    setSubmitError(null);

    // Display name fallback — derived from the email until we add an explicit
    // field. The user can rename later via the Profile page.
    const displayName =
      user?.email?.split('@')[0]?.replace(/[.+_-]/g, ' ') ?? 'New user';

    try {
      await upsertProfile.mutateAsync({
        display_name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        whatsapp_e164: data.whatsapp || null,
        address_text: data.address || null,
        latitude: data.lat ?? null,
        longitude: data.lng ?? null,
        transformer_code: data.transformer || null,
        monthly_demand_kwh: data.requirement ? parseInt(data.requirement, 10) : null,
      });

      // Sellers entered a day rate + capacity in step 2 — turn that into their
      // first listing. Without this the seller finishes onboarding with an
      // empty dashboard (the bug: the rate/capacity they typed was discarded).
      // Must run *after* the profile upsert so the listing can inherit the
      // profile's geo / transformer when the seller didn't pin a separate one.
      if (role === 'seller') {
        await createListing.mutateAsync({
          day_rate: data.rate as string,
          night_rate: data.nightRate ? data.nightRate : null,
          capacity_kwh: parseInt(data.capacity ?? '', 10),
          address_text: data.address || null,
          latitude: data.lat ?? null,
          longitude: data.lng ?? null,
          transformer_code: data.transformer || null,
        });
      }

      track('complete_profile_clicked', {
        account_type: accountTypeFor(role),
        user_id: user?.id ?? '',
        transformer_no: data.transformer || null,
      });
      onComplete();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not save your profile. Please try again.',
      );
    }
  };

  // The final CTA stays busy until both the profile upsert *and* (for sellers)
  // the listing create have settled, so the user can't double-submit or
  // navigate away mid-flight.
  const submitting = upsertProfile.isPending || createListing.isPending;

  const stepLabels = [
    t('stepIdentity'),
    role === 'buyer' ? t('stepDemand') : t('stepOffer'),
  ];

  /** Block the "next" button until the current step has enough info. */
  const canAdvance = (): boolean => {
    if (step === 1) {
      return (data.whatsapp?.length ?? 0) >= 10 && (data.address?.length ?? 0) > 5;
    }
    return role === 'buyer'
      ? (data.requirement?.length ?? 0) > 0
      : (data.rate?.length ?? 0) > 0 && (data.capacity?.length ?? 0) > 0;
  };

  return (
    <div className="min-h-screen bg-surface">
      {showPopup && <TransformerPopup onClose={() => setShowPopup(false)} />}
      <Nav onBack={onBack} />

      <div
        className={[
          'flex flex-col items-center',
          isMobile ? 'px-4 py-6' : 'px-6 py-10',
        ].join(' ')}
      >
        <div className="w-full max-w-[520px]">
          <div className="text-center mb-7">
            <div className="font-bold text-[22px]">{t('setupProfile')}</div>
          </div>

          {/* Step progress bars */}
          <div className="flex gap-2 mb-7">
            {stepLabels.map((label, i) => {
              const idx = i + 1;
              const active = idx === step;
              const reached = idx <= step;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={[
                      'w-full h-1 rounded-full transition-colors',
                      reached ? 'bg-brand-700' : 'bg-gray-200',
                    ].join(' ')}
                  />
                  <div
                    className={[
                      'text-[11px]',
                      active ? 'text-brand-700 font-semibold' : 'text-gray-400',
                    ].join(' ')}
                  >
                    {label}
                  </div>
                </div>
              );
            })}
          </div>

          <Card>
            {step === 1 && (
              <div>
                <div className="flex gap-2.5 items-start mb-[22px]">
                  <div className="bg-brand-100 p-2.5 rounded-[10px]">
                    <Phone size={18} className="text-brand-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-[17px]">{t('identityHeader')}</div>
                    <div className="text-[13px] text-gray-400">{t('identitySub')}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <Input
                    label={t('whatsappTitle')}
                    type="tel"
                    value={data.whatsapp ?? ''}
                    onChange={(v) => update('whatsapp', v)}
                    placeholder={t('whatsappPlaceholder')}
                    hint={t('whatsappHint')}
                    required
                  />
                  <MapPicker
                    value={{
                      address: data.address ?? '',
                      lat: data.lat ?? null,
                      lng: data.lng ?? null,
                    }}
                    onChange={(v) =>
                      setData((prev) => ({
                        ...prev,
                        address: v.address,
                        lat: v.lat,
                        lng: v.lng,
                      }))
                    }
                  />
                  <div>
                    <Input
                      label={`${t('transformerTitle')} ${t('transformerOptional')}`}
                      value={data.transformer ?? ''}
                      onChange={(v) => update('transformer', v)}
                      placeholder={t('transformerPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        track('transformer_info_clicked', {
                          user_id: user?.id ?? null,
                          source: 'create_account',
                        });
                        setShowPopup(true);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 bg-transparent text-brand-700 border-none py-1 text-[13px] font-medium cursor-pointer"
                    >
                      <Info size={14} />
                      {t('findTransformerBtn')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && role === 'buyer' && (
              <div>
                <div className="flex gap-2.5 items-start mb-[22px]">
                  <div className="bg-blue-100 p-2.5 rounded-[10px]">
                    <BarChart2 size={18} className="text-blue-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-[17px]">{t('requirementTitle')}</div>
                    <div className="text-[13px] text-gray-400">{t('requirementSub')}</div>
                  </div>
                </div>
                <Input
                  label={t('requirementLabel')}
                  type="number"
                  value={data.requirement ?? ''}
                  onChange={(v) => update('requirement', v)}
                  placeholder={t('requirementPlaceholder')}
                  hint={t('requirementHint')}
                  required
                />
              </div>
            )}

            {step === 2 && role === 'seller' && (
              <div>
                <div className="flex gap-2.5 items-start mb-[22px]">
                  <div className="bg-brand-100 p-2.5 rounded-[10px]">
                    <Zap size={18} className="text-brand-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-[17px]">{t('offerTitle')}</div>
                    <div className="text-[13px] text-gray-400">{t('offerSub')}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3.5">
                  <Input
                    label={t('rateLabel')}
                    type="number"
                    value={data.rate ?? ''}
                    onChange={(v) => update('rate', v)}
                    placeholder={t('ratePlaceholder')}
                    hint={t('rateHint')}
                    required
                  />
                  {showNightRate ? (
                    <div>
                      <Input
                        label={t('nightRateLabel')}
                        type="number"
                        value={data.nightRate ?? ''}
                        onChange={(v) => update('nightRate', v)}
                        placeholder={t('nightRatePlaceholder')}
                        hint={t('nightRateHint')}
                      />
                      <button
                        type="button"
                        onClick={() => { setShowNightRate(false); update('nightRate', ''); }}
                        className="mt-2 inline-flex items-center gap-1.5 bg-transparent text-red-600 border-none py-1 text-[13px] font-medium cursor-pointer"
                      >
                        <X size={14} />
                        {t('removeNightRate')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNightRate(true)}
                      className="inline-flex items-center gap-1.5 bg-transparent text-brand-700 border-none py-1 text-[13px] font-medium cursor-pointer self-start"
                    >
                      <Plus size={14} />
                      {t('addNightRate')}
                    </button>
                  )}
                  <Input
                    label={t('capacityLabel')}
                    type="number"
                    value={data.capacity ?? ''}
                    onChange={(v) => update('capacity', v)}
                    placeholder={t('capacityPlaceholder')}
                    hint={t('capacityHint')}
                    required
                  />
                </div>
              </div>
            )}

            {submitError && (
              <div className="mt-5 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {submitError}
              </div>
            )}

            <div className="flex justify-between mt-7">
              <Button
                variant="ghost"
                disabled={step === 1 || submitting}
                onClick={() => step > 1 && setStep((s) => (s - 1) as 1 | 2)}
              >
                ← {t('back')}
              </Button>
              <Button
                disabled={!canAdvance() || submitting}
                onClick={() => {
                  if (step < 2) {
                    track('your_info_clicked', {
                      account_type: accountTypeFor(role),
                      has_whatsapp: !!data.whatsapp,
                      has_location: !!data.address || data.lat != null,
                      transformer_no: data.transformer || null,
                    });
                    setStep(2);
                  } else {
                    handleFinish();
                  }
                }}
                icon={
                  step === 2 && submitting
                    ? <Loader2 size={14} className="animate-spin" />
                    : undefined
                }
              >
                {step === 2 ? t('letsGo') : `${t('next')} →`}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
