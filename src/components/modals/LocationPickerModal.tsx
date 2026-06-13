import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Button } from '../ui/Button';
import { MapPicker, type MapPickerValue } from '../MapPicker';
import { ModalShell } from './ModalShell';

export interface LocationPickerModalProps {
  initial: MapPickerValue;
  onClose: () => void;
  /** Fired with the user's confirmed address + coordinates. */
  onConfirm: (value: MapPickerValue) => void;
}

/**
 * Full-screen-ish dialog around the `MapPicker`. Used when the buyer wants
 * to change their searched location without losing context.
 *
 * Confirm enables once the user has placed a pin (i.e. we have lat/lng) and
 * the address actually differs from the starting one — so the modal can be
 * dismissed without accidental writes.
 */
export function LocationPickerModal({
  initial,
  onClose,
  onConfirm,
}: LocationPickerModalProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState<MapPickerValue>(initial);

  const hasCoords = draft.lat != null && draft.lng != null;
  const addressChanged =
    !!draft.address &&
    draft.address.trim() !== (initial.address || '').trim() &&
    draft.address.length > 5;
  const coordsChanged =
    draft.lat !== initial.lat || draft.lng !== initial.lng;
  const canConfirm = hasCoords && (addressChanged || coordsChanged);

  return (
    <ModalShell
      onClose={onClose}
      maxWidth={560}
      closeLabel={t('cancel')}
      className={isMobile ? 'p-5' : 'p-7'}
    >
      <div className="flex items-center gap-2.5 mb-[18px] pr-8">
        <div className="bg-brand-100 p-2.5 rounded-[10px]">
          <MapPin size={20} className="text-brand-700" />
        </div>
        <div className="font-semibold text-[17px]">{t('chooseLocationTitle')}</div>
      </div>
      <MapPicker value={draft} onChange={setDraft} />
      <div className="flex gap-2.5 mt-5">
        <Button variant="ghost" full onClick={onClose}>{t('cancel')}</Button>
        <Button
          full
          disabled={!canConfirm}
          onClick={() => { onConfirm(draft); onClose(); }}
        >
          {t('confirmBtn')}
        </Button>
      </div>
    </ModalShell>
  );
}
