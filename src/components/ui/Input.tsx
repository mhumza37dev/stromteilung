import { type InputHTMLAttributes } from 'react';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'className'> {
  /** Label rendered above the field (and the asterisk if `required`). */
  label?: string;
  /** Helper text rendered below the field — use for short instructions. */
  hint?: string;
  /** Controlled value. */
  value: string;
  /** Called with the new string value (not the synthetic event) for ergonomics. */
  onChange: (value: string) => void;
}

/**
 * Form input with a small label/hint stack above and below. Keeps a
 * consistent look across onboarding, dashboards and modals.
 *
 * Designed for controlled use only — pair with `useState` (or formik / RHF
 * later) and pass `value` + `onChange` directly.
 */
export function Input({
  label,
  hint,
  required = false,
  value,
  onChange,
  type = 'text',
  ...rest
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[13px] font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
      )}
      <input
        {...rest}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full box-border px-3 py-2.5 rounded-lg border-[1.5px] border-gray-200 bg-white text-[15px] text-gray-900 outline-none focus:border-brand-700 transition-colors"
      />
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}
