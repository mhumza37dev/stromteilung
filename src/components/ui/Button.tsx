import { type ButtonHTMLAttributes, type ReactNode } from 'react';

/**
 * Visual variants supported by the shared button component.
 *
 * - primary  — solid brand green; default for affirmative CTAs.
 * - outline  — transparent fill, brand border + text; secondary actions.
 * - ghost    — neutral fill with a hairline border; tertiary actions.
 */
export type ButtonVariant = 'primary' | 'outline' | 'ghost';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  children: ReactNode;
  variant?: ButtonVariant;
  /** Optional leading icon — accepts any ReactNode (typically a lucide icon). */
  icon?: ReactNode;
  /** Compact sizing for inline / table-row actions. */
  small?: boolean;
  /** Expand to fill the parent container's width. */
  full?: boolean;
  /** Optional additional Tailwind classes for one-off tweaks. */
  className?: string;
}

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-1.5 font-medium border-none outline-none rounded-lg box-border transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const SIZE_CLASSES = {
  small: 'text-[13px] px-3.5 py-[7px]',
  default: 'text-[15px] px-[22px] py-[11px]',
} as const;

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800',
  outline: 'bg-transparent text-brand-700 border-[1.5px] border-brand-700 hover:bg-brand-50',
  ghost:   'bg-transparent text-gray-500 border-[1.5px] border-gray-200 hover:bg-gray-50',
};

/**
 * Project-wide button. Wraps a native `<button>` and applies our three
 * brand-aligned variants. Defers other native props (onClick, type, etc.) to
 * the underlying element so it stays drop-in compatible.
 */
export function Button({
  children,
  variant = 'primary',
  icon,
  small = false,
  full = false,
  className = '',
  ...rest
}: ButtonProps) {
  const composed = [
    BASE_CLASSES,
    small ? SIZE_CLASSES.small : SIZE_CLASSES.default,
    VARIANT_CLASSES[variant],
    full ? 'w-full' : '',
    rest.disabled ? '' : 'cursor-pointer',
    className,
  ].join(' ');

  return (
    <button {...rest} className={composed}>
      {icon}
      {children}
    </button>
  );
}
