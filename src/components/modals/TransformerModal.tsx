import { useState } from 'react';
import { Info, Zap } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ModalShell } from './ModalShell';
import { TransformerPopup } from './TransformerPopup';

export interface TransformerModalProps {
  onClose: () => void;
  /** Persist the new transformer number into the user profile. */
  onSave: (value: string) => void;
}

/**
 * Dialog for adding/updating the user's local transformer number (e.g.
 * "TR-2847"). Surfaced from the dashboard banner when the profile is
 * incomplete.
 *
 * Composes the `TransformerPopup` for the "where do I find this number?"
 * helper, so we don't duplicate that copy in two places.
 */
export function TransformerModal({ onClose, onSave }: TransformerModalProps) {
  const { t } = useLang();
  const [value, setValue] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      {showHelp && <TransformerPopup onClose={() => setShowHelp(false)} />}
      <ModalShell onClose={onClose}>
        <div className="flex items-center gap-2.5 mb-[18px]">
          <div className="bg-brand-100 p-2.5 rounded-[10px]">
            <Zap size={20} className="text-brand-700" />
          </div>
          <div className="font-semibold text-[17px]">{t('addTransformerTitle')}</div>
        </div>
        <Input
          label={t('transformerTitle')}
          value={value}
          onChange={setValue}
          placeholder={t('transformerPlaceholder')}
        />
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="mt-2.5 inline-flex items-center gap-1.5 bg-transparent text-brand-700 border-none py-1 text-[13px] font-medium cursor-pointer"
        >
          <Info size={14} />
          {t('findTransformerBtn')}
        </button>
        <div className="flex gap-2.5 mt-5">
          <Button variant="ghost" full onClick={onClose}>{t('cancel')}</Button>
          <Button full disabled={!value} onClick={() => { onSave(value); onClose(); }}>
            {t('save')}
          </Button>
        </div>
      </ModalShell>
    </>
  );
}
