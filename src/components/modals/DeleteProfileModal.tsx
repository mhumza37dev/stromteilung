import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { Button } from '../ui/Button';
import { ModalShell } from './ModalShell';

export interface DeleteProfileModalProps {
  onClose: () => void;
  /**
   * Fired when the user confirms deletion — the parent owns the data wipe.
   * May be async; if it rejects we keep the modal open and show the error so
   * the user isn't silently signed out of a still-live account.
   */
  onConfirm: () => void | Promise<void>;
}

/**
 * GDPR-compliant deletion confirmation. Made deliberately scary (red icon,
 * destructive button) so accidental clicks aren't possible.
 *
 * Owns the in-flight + error state for the confirm action: the button shows a
 * spinner while the deletion request is running and surfaces a message if it
 * fails, rather than optimistically closing.
 */
export function DeleteProfileModal({ onClose, onConfirm }: DeleteProfileModalProps) {
  const { t } = useLang();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setDeleting(true);
    try {
      await onConfirm();
      // On success the parent unmounts this modal (session cleared → navigates
      // away), so we don't need to reset state here.
    } catch {
      setError(t('deleteProfileError'));
      setDeleting(false);
    }
  };

  return (
    <ModalShell maxWidth={420} className="p-7 text-center">
      <div className="w-[52px] h-[52px] rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
        <Trash2 size={22} className="text-red-600" />
      </div>
      <div className="font-bold text-lg mb-2">{t('deleteProfileTitle')}</div>
      <div className="text-[13px] text-gray-500 leading-relaxed mb-6">
        {t('deleteProfileDesc')}
      </div>
      {error && (
        <div className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={deleting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-70 disabled:cursor-default text-white rounded-lg px-[22px] py-[11px] text-[15px] font-medium cursor-pointer flex items-center justify-center gap-1.5 border-none transition-colors"
        >
          {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          {t('deleteProfileConfirm')}
        </button>
        <Button variant="ghost" full onClick={onClose} disabled={deleting}>
          {t('deleteProfileCancel')}
        </Button>
      </div>
    </ModalShell>
  );
}
