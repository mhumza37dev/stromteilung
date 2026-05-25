import { type HTMLAttributes, type ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Standard white surface used to group related content (forms, lists, etc.).
 *
 * Keeps padding, radius and border consistent with the rest of the
 * marketplace UI. Accepts any extra div props for one-off overrides.
 */
export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={[
        'bg-white border border-gray-200/70 rounded-xl px-[22px] py-5',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
