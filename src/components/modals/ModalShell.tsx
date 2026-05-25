import { type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ModalShellProps {
  children: ReactNode;
  onClose?: () => void;
  /** Maximum width of the modal body — defaults to the medium 440px. */
  maxWidth?: number;
  /** ARIA label for the close (X) button. */
  closeLabel?: string;
  /** Override default padding (e.g. for compact rating dialogs). */
  className?: string;
}

/**
 * Re-usable modal scaffolding — a translucent overlay, a centered white
 * container, and an optional close button in the top-right corner.
 *
 * Every modal in the app should compose this shell rather than duplicate
 * the overlay / container styling.
 */
export function ModalShell({
  children,
  onClose,
  maxWidth = 440,
  closeLabel = 'Close',
  className = 'p-7',
}: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-[1000] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={['bg-white rounded-2xl w-full relative max-h-[92vh] overflow-y-auto box-border', className].join(' ')}
        style={{ maxWidth }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-gray-400 flex p-1 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
