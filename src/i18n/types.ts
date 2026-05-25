/**
 * Shape of a single translation bundle.
 *
 * Defined as the keyof from the German bundle, then enforced on the English
 * bundle. This guarantees both locales stay in sync — TypeScript fails the
 * build if a key is added to one bundle but forgotten in the other.
 */
import type { de } from './de';

export type TranslationKey = keyof typeof de;

export type Translation = { [K in TranslationKey]: string };
