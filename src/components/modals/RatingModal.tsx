import { useState } from 'react';
import { Star } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { Button } from '../ui/Button';
import { ModalShell } from './ModalShell';

export interface RatingModalProps {
  /** Name of the user being rated — rendered in the subtitle. */
  target: string;
  onClose: () => void;
  /** Fired with the chosen 1–5 rating when the user submits. */
  onSubmit: (rating: number) => void;
}

/**
 * Five-star rating dialog. Used after a WhatsApp interaction (buyer side)
 * or when a seller wants to rate a recent buyer.
 *
 * The submit button stays disabled until at least one star is picked.
 */
export function RatingModal({ target, onClose, onSubmit }: RatingModalProps) {
  const { t } = useLang();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  const display = hover || rating;

  return (
    <ModalShell maxWidth={380} className="p-7 text-center">
      <div className="w-[52px] h-[52px] rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
        <Star size={24} className="text-brand-700" />
      </div>
      <div className="font-semibold text-lg mb-1.5">{t('rateTitle')}</div>
      <div className="text-[13px] text-gray-500 mb-5">
        {t('rateSub')} <strong>{target}</strong>?
      </div>

      <div className="flex justify-center gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = display >= i;
          return (
            <Star
              key={i}
              size={32}
              fill={filled ? '#f59e0b' : 'none'}
              stroke={filled ? '#f59e0b' : '#d1d5db'}
              className={['cursor-pointer transition-transform', filled ? 'scale-110' : 'scale-100'].join(' ')}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(i)}
            />
          );
        })}
      </div>

      <div className="flex gap-2.5">
        <Button variant="ghost" full onClick={onClose}>{t('skip')}</Button>
        <Button full disabled={!rating} onClick={() => onSubmit(rating)}>
          {t('sendRating')}
        </Button>
      </div>
    </ModalShell>
  );
}
