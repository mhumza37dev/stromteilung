import { useContext } from 'react';
import { LanguageContext, type LanguageContextValue } from '../contexts/LanguageContext';

/**
 * Subscribe to the active locale and translate function.
 *
 * Usage:
 * ```tsx
 * const { t, lang, toggle } = useLang();
 * return <button onClick={toggle}>{t('login')}</button>;
 * ```
 */
export function useLang(): LanguageContextValue {
  return useContext(LanguageContext);
}
