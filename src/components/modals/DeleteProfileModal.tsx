import { Trash2 } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { Button } from '../ui/Button';
import { ModalShell } from './ModalShell';

export interface DeleteProfileModalProps {
  onClose: () => void;
  /** Fired when the user confirms deletion — the parent owns the data wipe. */
  onConfirm: () => void;
}

/**
 * GDPR-compliant deletion confirmation. Made deliberately scary (red icon,
 * destructive button) so accidental clicks aren't possible.
 */
export function DeleteProfileModal({ onClose, onConfirm }: DeleteProfileModalProps) {
  const { t } = useLang();
  return (
    <ModalShell maxWidth={420} className="p-7 text-center">
      <div className="w-[52px] h-[52px] rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
        <Trash2 size={22} className="text-red-600" />
      </div>
      <div className="font-bold text-lg mb-2">{t('deleteProfileTitle')}</div>
      <div className="text-[13px] text-gray-500 leading-relaxed mb-6">
        {t('deleteProfileDesc')}
      </div>
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onConfirm}
          className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg px-[22px] py-[11px] text-[15px] font-medium cursor-pointer flex items-center justify-center gap-1.5 border-none transition-colors"
        >
          <Trash2 size={15} />
          {t('deleteProfileConfirm')}
        </button>
        <Button variant="ghost" full onClick={onClose}>{t('deleteProfileCancel')}</Button>
      </div>
    </ModalShell>
  );
}
