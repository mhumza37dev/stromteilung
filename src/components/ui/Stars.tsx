import { Star } from 'lucide-react';

export interface StarsProps {
  /** Rating value, 0–5. Anything above 5 is clamped visually. */
  rating: number;
  /** Pixel size for each star icon. */
  size?: number;
}

/**
 * Renders a five-star row with `rating` (rounded) filled in amber.
 *
 * Decoupled from any review data — pass a number and it draws.
 */
export function Stars({ rating, size = 14 }: StarsProps) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex gap-px">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= rounded;
        return (
          <Star
            key={i}
            size={size}
            fill={filled ? '#f59e0b' : 'none'}
            stroke={filled ? '#f59e0b' : '#d1d5db'}
          />
        );
      })}
    </span>
  );
}
