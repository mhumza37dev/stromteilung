import { Zap } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useIsMobile } from '../hooks/useIsMobile';
import { Button } from './ui/Button';

export interface ProfileBannerProps {
  /** Open the "add transformer number" flow. */
  onAdd: () => void;
  /** Dismiss the banner for the current session. */
  onDismiss?: () => void;
}

/**
 * Amber prompt shown on the buyer/seller dashboards when the user hasn't
 * supplied their transformer number yet. Layout adapts to mobile so the CTA
 * is always reachable with one tap.
 */
export function ProfileBanner({ onAdd }: ProfileBannerProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-[10px] px-3.5 py-3 mb-5">
        <div className="flex items-start gap-2.5">
          <div className="bg-amber-100 p-[7px] rounded-lg flex-shrink-0">
            <Zap size={15} className="text-amber-600" />
          </div>
          <div className="flex-1 text-[13px] text-amber-800 leading-relaxed">
            <strong>{t('profileBannerTitle')}</strong> — {t('profileBannerDesc')}
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button small full onClick={onAdd}>{t('addNow')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-[10px] px-3.5 py-3 flex items-center gap-3 mb-5">
      <div className="bg-amber-100 p-2 rounded-lg flex-shrink-0">
        <Zap size={16} className="text-amber-600" />
      </div>
      <div className="flex-1 text-[13px] text-amber-800 leading-relaxed">
        <strong className="block mb-0.5">{t('profileBannerTitle')}</strong>
        {t('profileBannerDesc')}
      </div>
      <Button small onClick={onAdd}>{t('addNow')}</Button>
    </div>
  );
}
