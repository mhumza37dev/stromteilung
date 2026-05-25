import { type ReactNode } from 'react';

/** Tonal color tokens for the Badge — each maps to a curated bg/fg pair. */
export type BadgeColor = 'green' | 'blue' | 'amber' | 'gray';

export interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
}

/** Tailwind classes per color, kept in a lookup so the JSX stays terse. */
const COLOR_CLASSES: Record<BadgeColor, string> = {
  green: 'bg-brand-100 text-brand-700',
  blue:  'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  gray:  'bg-gray-100 text-gray-700',
};

/**
 * Tiny status pill — used for buyer/seller role indicators, "Active" labels,
 * "Rated" confirmations, etc. Defaults to the brand green.
 */
export function Badge({ children, color = 'green' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded',
        COLOR_CLASSES[color],
      ].join(' ')}
    >
      {children}
    </span>
  );
}
