import { Info, Zap } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { renderBold } from '../../utils/renderText';
import { Button } from '../ui/Button';
import { ModalShell } from './ModalShell';
import type { TranslationKey } from '../../i18n';

export interface TransformerPopupProps {
  onClose: () => void;
}

const STEPS: TranslationKey[] = ['popup1', 'popup2', 'popup3'];

/**
 * Informational popup explaining where users can locate their transformer
 * number. Surfaced from onboarding and from the "?" link inside the
 * transformer-number modal.
 */
export function TransformerPopup({ onClose }: TransformerPopupProps) {
  const { t } = useLang();

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="bg-brand-100 p-2.5 rounded-[10px]">
          <Zap size={20} className="text-brand-700" />
        </div>
        <div>
          <div className="font-semibold text-base">{t('popupTitle')}</div>
          <div className="text-xs text-gray-400">{t('popupSubtitle')}</div>
        </div>
      </div>
      <div className="text-sm text-gray-700 leading-[1.65]">
        {STEPS.map((key, i) => (
          <div key={key} className="flex gap-3 mb-3">
            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-[13px] flex-shrink-0">
              {i + 1}
            </div>
            <div>{renderBold(t(key))}</div>
          </div>
        ))}
        <div className="bg-brand-50 border border-brand-200 rounded-lg px-3.5 py-2.5 text-[13px] text-brand-800">
          <Info size={14} className="inline -translate-y-[1px] mr-1.5" />
          {t('popupInfo')}
        </div>
      </div>
      <div className="mt-5">
        <Button full onClick={onClose}>{t('understood')}</Button>
      </div>
    </ModalShell>
  );
}
