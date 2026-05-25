import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';
import { LOCALES, type TranslationKey } from '../i18n';
import type { Locale } from '../types';

/**
 * Shape of the language context value consumers receive.
 *
 * - `lang`     — the active locale code ("de" or "en").
 * - `t(key)`   — translate function; returns the key unchanged if missing.
 * - `toggle()` — flips between the two supported locales.
 */
export interface LanguageContextValue {
  lang: Locale;
  t: (key: TranslationKey) => string;
  toggle: () => void;
}

/**
 * Internal context — exported so the `useLang` hook can subscribe.
 * Consumers should use the hook, not this directly.
 */
export const LanguageContext = createContext<LanguageContextValue>({
  lang: 'de',
  t: (key) => key,
  toggle: () => {},
});

interface LanguageProviderProps {
  children: ReactNode;
  /** Optional starting locale — defaults to German since the primary audience is DE. */
  initial?: Locale;
}

/**
 * Wraps the app and supplies the active locale + translate helper.
 *
 * Kept deliberately minimal: no persistence yet. Once the backend lands we'll
 * sync `lang` with the user profile (and localStorage as a fallback).
 */
export function LanguageProvider({ children, initial = 'de' }: LanguageProviderProps) {
  const [lang, setLang] = useState<Locale>(initial);

  const toggle = useCallback(() => {
    setLang((prev) => (prev === 'de' ? 'en' : 'de'));
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => LOCALES[lang][key] ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, t, toggle }), [lang, t, toggle]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
