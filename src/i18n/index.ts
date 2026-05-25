/**
 * Public barrel for the i18n module.
 *
 * Consumers import from `@/i18n` (or relative path) and never need to know
 * which file owns which bundle. Adding a new locale = drop a new file here
 * and extend the `LOCALES` map.
 */
import { de } from './de';
import { en } from './en';
import type { Locale } from '../types';
import type { Translation, TranslationKey } from './types';

export const LOCALES: Record<Locale, Translation> = { de, en };

export type { Translation, TranslationKey };
