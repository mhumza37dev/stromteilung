import { Globe } from 'lucide-react';
import { useLang } from '../../hooks/useLang';

/**
 * Compact locale toggle shown in the navbar.
 *
 * Always displays the *other* locale code (the one a click would switch to)
 * so users immediately understand what the button does.
 */
export function LangPill() {
  const { lang, toggle } = useLang();
  return (
    <button
      onClick={toggle}
      type="button"
      className="flex items-center gap-1.5 bg-brand-50 border-[1.5px] border-brand-200 rounded-full px-3 py-1 text-[13px] font-bold cursor-pointer text-brand-700 hover:bg-brand-100 transition-colors"
    >
      <Globe size={13} />
      {lang === 'de' ? 'EN' : 'DE'}
    </button>
  );
}
