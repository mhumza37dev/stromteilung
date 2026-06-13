import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Edit2, Mail, MapPin, Phone, Trash2, User, X, Zap } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';
import { useMyProfile, useUpsertMyProfile } from '../hooks/api/useProfile';
import { Nav } from '../components/layout/Nav';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { DeleteProfileModal } from '../components/modals/DeleteProfileModal';
import { LocationPickerModal } from '../components/modals/LocationPickerModal';
import { accountTypeFor, setUserTraits, track } from '../lib/analytics';
import type { Role } from '../types';

export interface ProfilePageProps {
  role: Role;
  onBack: () => void;
  onLogout: () => void;
  /** Confirmed account deletion. Async + may reject so the modal can surface
   *  the error and keep the user signed in. */
  onDeleteProfile: () => void | Promise<void>;
}

/** A single editable / read-only row in the profile card. */
interface ProfileRow {
  key: 'name' | 'email' | 'whatsapp' | 'transformer' | 'address';
  icon: ReactNode;
  label: string;
  value: string;
  editable: boolean;
  type?: string;
  placeholder?: string;
  /** Address opens the map picker instead of an inline text input. */
  picker?: 'map';
}

/**
 * Editable account screen, wired to the live backend.
 *
 * - `email` + `role` come from the auth user (read-only — changing email is
 *   a separate flow that ships in M6 alongside password reset).
 * - `display_name`, `whatsapp`, `transformer` come from `/users/me/profile`.
 *   Each row PUTs the full profile so an inline edit always converges to a
 *   consistent server-side state.
 * - The "Delete profile" button is intentionally separated by a Card border
 *   so accidental taps are unlikely.
 */
export function ProfilePage({
  role,
  onBack,
  onLogout,
  onDeleteProfile,
}: ProfilePageProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const profileQuery = useMyProfile();
  const upsertProfile = useUpsertMyProfile();

  const [showDelete, setShowDelete] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const profile = profileQuery.data ?? null;

  // Fire `profile_data_clicked` once the profile screen has its data — gives a
  // "profile viewed" signal with the buyer's monthly capacity (seller listing
  // prices live on listings, not the profile, so they're null here).
  const profileViewTracked = useRef(false);
  useEffect(() => {
    if (profileViewTracked.current || !profile) return;
    profileViewTracked.current = true;
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
    track('profile_data_clicked', {
      account_type: accountTypeFor(role),
      user_id: profile.user_id,
      daytime_price: null,
      nighttime_price: null,
      monthly_capacity: profile.monthly_demand_kwh,
    });
  }, [profile, role]);

  const name = profile?.display_name ?? '—';
  const email = user?.email ?? '—';
  const whatsapp = profile?.whatsapp_e164 ?? '';
  const address = profile?.address_text ?? '';
  // The public profile joins in the human-readable code (e.g. "TR-2847"),
  // so show that rather than a placeholder tick.
  const transformer = profile?.transformer_code ?? '';

  const startEdit = (key: string, current: string) => {
    setEditKey(key);
    setDraft(current);
  };
  const cancelEdit = () => {
    setEditKey(null);
    setDraft('');
  };

  /**
   * Persist a single-field edit. Because the backend's profile endpoint is a
   * PUT (replace), we send the full current state with the one field swapped.
   */
  const saveEdit = (key: ProfileRow['key']) => {
    if (!profile) return;
    // The endpoint is a full replace (PUT), so carry over every field —
    // including the saved geo + current transformer — and only swap the one
    // the user just edited. Otherwise editing e.g. WhatsApp would silently
    // wipe the user's pinned location or transformer.
    const body = {
      display_name: profile.display_name,
      whatsapp_e164: profile.whatsapp_e164,
      address_text: profile.address_text,
      latitude: profile.latitude,
      longitude: profile.longitude,
      transformer_code: profile.transformer_code,
      monthly_demand_kwh: profile.monthly_demand_kwh,
    };
    if (key === 'whatsapp') body.whatsapp_e164 = draft;
    if (key === 'transformer') body.transformer_code = draft || null;
    upsertProfile.mutate(body, {
      onSuccess: () => {
        track('update_profile', {
          account_type: accountTypeFor(role),
          user_id: profile.user_id,
          updated_whatsapp: body.whatsapp_e164,
          updated_transformer_no: body.transformer_code,
        });
        // Keep the People profile in sync with the just-saved values.
        setUserTraits({
          whatsapp: body.whatsapp_e164,
          transformer: body.transformer_code,
        });
        setEditKey(null);
        setDraft('');
      },
    });
  };

  const rows: ProfileRow[] = [
    { key: 'name',        icon: <User   size={16} className="text-gray-500" />, label: t('fieldName'),        value: name,        editable: false },
    { key: 'email',       icon: <Mail   size={16} className="text-gray-500" />, label: t('fieldEmail'),       value: email,       editable: false },
    { key: 'address',     icon: <MapPin size={16} className="text-gray-500" />, label: t('addressTitle'),     value: address  || t('notProvided'), editable: true, picker: 'map' },
    { key: 'whatsapp',    icon: <Phone  size={16} className="text-gray-500" />, label: t('fieldWhatsapp'),    value: whatsapp || t('notProvided'), editable: true, type: 'tel' },
    { key: 'transformer', icon: <Zap    size={16} className="text-gray-500" />, label: t('fieldTransformer'), value: transformer || t('notProvided'), editable: true, type: 'text', placeholder: 'TR-2847' },
  ];

  const avatarBg = role === 'buyer' ? 'bg-blue-100' : 'bg-brand-100';
  const avatarFg = role === 'buyer' ? 'text-blue-700' : 'text-brand-700';

  return (
    <div className="min-h-screen bg-surface">
      {showDelete && (
        <DeleteProfileModal
          onClose={() => setShowDelete(false)}
          onConfirm={onDeleteProfile}
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
              // `display_name` has a server-side min_length of 2; fall back to
              // the email local-part so a freshly-registered user (no profile
              // yet) can still pin a location without 422-ing the backend.
              display_name:
                profile?.display_name ||
                user?.email?.split('@')[0] ||
                'User',
              whatsapp_e164: profile?.whatsapp_e164 ?? null,
              address_text: v.address || null,
              latitude: v.lat,
              longitude: v.lng,
              monthly_demand_kwh: profile?.monthly_demand_kwh ?? null,
            })
          }
        />
      )}
      <Nav role={role} onBack={onBack} onLogout={onLogout} />

      <div
        className={[
          'max-w-[560px] mx-auto',
          isMobile ? 'px-4 py-5' : 'px-6 py-[30px]',
        ].join(' ')}
      >
        <div className="mb-6">
          <div className="font-bold text-2xl">{t('profileTitle')}</div>
        </div>

        <Card className="mb-4">
          {/* Avatar header */}
          <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-gray-200/70">
            <div
              className={[
                'w-[52px] h-[52px] rounded-full flex items-center justify-center flex-shrink-0',
                avatarBg,
                avatarFg,
              ].join(' ')}
            >
              <User size={24} />
            </div>
            <div>
              {profileQuery.isLoading ? (
                <Skeleton shape="sm" width={180} height={18} />
              ) : (
                <div className="font-bold text-base">{name}</div>
              )}
              <div className="mt-1">
                <Badge color={role === 'buyer' ? 'blue' : 'green'}>
                  {role === 'buyer' ? t('buyer') : t('seller')}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            {rows.map((r) => {
              const isEditing = editKey === r.key;
              const isEmpty =
                (r.key === 'whatsapp' && !whatsapp) ||
                (r.key === 'transformer' && !transformer) ||
                (r.key === 'address' && !address);

              // Map-picker rows are whole-row clickable so the tap target is
              // obvious and the small pencil icon stops being a discoverability
              // trap. Other rows keep the inline-edit pattern.
              if (r.picker === 'map') {
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    className="w-full flex items-center gap-3 px-1 py-3 border-b border-gray-100 last:border-b-0 bg-transparent text-left cursor-pointer rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-[34px] h-[34px] rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 mb-0.5">{r.label}</div>
                      {profileQuery.isLoading ? (
                        <Skeleton shape="sm" width="60%" height={14} />
                      ) : (
                        <div
                          className={[
                            'text-sm font-medium truncate',
                            isEmpty ? 'text-gray-400' : 'text-gray-900',
                          ].join(' ')}
                        >
                          {r.value}
                        </div>
                      )}
                    </div>
                    <div
                      aria-hidden
                      className="border border-gray-200 rounded-md px-2 py-1.5 text-gray-500 flex items-center flex-shrink-0"
                    >
                      <Edit2 size={14} />
                    </div>
                  </button>
                );
              }

              return (
                <div
                  key={r.key}
                  className="flex items-center gap-3 px-1 py-3 border-b border-gray-100 last:border-b-0"
                >
                  <div className="w-[34px] h-[34px] rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 mb-0.5">{r.label}</div>
                    {profileQuery.isLoading && r.key !== 'email' ? (
                      <Skeleton shape="sm" width="60%" height={14} />
                    ) : isEditing ? (
                      <input
                        autoFocus
                        type={r.type}
                        value={draft}
                        placeholder={r.placeholder}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(r.key);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-md border-[1.5px] border-brand-700 text-sm outline-none box-border text-gray-900 bg-white"
                      />
                    ) : (
                      <div
                        className={[
                          'text-sm font-medium',
                          isEmpty ? 'text-gray-400' : 'text-gray-900',
                        ].join(' ')}
                      >
                        {r.value}
                      </div>
                    )}
                  </div>
                  {r.editable &&
                    (isEditing ? (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => saveEdit(r.key)}
                          disabled={upsertProfile.isPending}
                          aria-label={t('save')}
                          className="bg-brand-700 hover:bg-brand-800 disabled:opacity-50 border-none rounded-md px-2 py-1.5 cursor-pointer text-white flex items-center transition-colors"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          aria-label={t('cancel')}
                          className="bg-transparent border border-gray-200 rounded-md px-2 py-1.5 cursor-pointer text-gray-500 flex items-center hover:bg-gray-50"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(r.key, isEmpty ? '' : r.value)}
                        aria-label={t('editField')}
                        className="bg-transparent border border-gray-200 rounded-md px-2 py-1.5 cursor-pointer text-gray-500 flex items-center flex-shrink-0 hover:bg-gray-50"
                      >
                        <Edit2 size={14} />
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </Card>

        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border-[1.5px] border-red-200 rounded-[10px] px-[22px] py-3 text-[15px] font-medium cursor-pointer transition-colors"
        >
          <Trash2 size={16} />
          {t('deleteProfile')}
        </button>
      </div>
    </div>
  );
}
