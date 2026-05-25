import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Button } from '../ui/Button';
import { MapPicker } from '../MapPicker';
import { ModalShell } from './ModalShell';

export interface LocationPickerModalProps {
  initialAddress: string;
  onClose: () => void;
  /** Fired with the user's confirmed address. */
  onConfirm: (address: string) => void;
}

/**
 * Full-screen-ish dialog around the `MapPicker`. Used when the buyer wants
 * to change their searched location without losing context.
 *
 * The confirm button only enables when the typed address differs from the
 * starting one — so users can dismiss the modal without making accidental
 * changes.
 */
export function LocationPickerModal({
  initialAddress,
  onClose,
  onConfirm,
}: LocationPickerModalProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState(initialAddress || '');

  const changed =
    !!draft &&
    draft.trim() !== (initialAddress || '').trim() &&
    draft.length > 5;

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
          disabled={!changed}
          onClick={() => { onConfirm(draft); onClose(); }}
        >
          {t('confirmBtn')}
        </Button>
      </div>
    </ModalShell>
  );
}
