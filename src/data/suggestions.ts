/**
 * Address autocomplete suggestions surfaced by the address search inputs.
 *
 * Mock list — once the backend is in place, swap this for a real geocoding
 * service (e.g. Nominatim or a paid provider with German coverage).
 */
export const ADDRESS_SUGGESTIONS = [
  'Maximilianstraße 24, 80333 München',
  'Schillerstraße 12, 10627 Berlin',
  'Goethestraße 8, 60313 Frankfurt am Main',
  'Beethovenstraße 5, 50674 Köln',
  'Kantstraße 20, 10623 Berlin',
] as const;

/**
 * Pixel-percent positions (0-100) on the SVG map used by the picker so each
 * canned address pin lands consistently between renders.
 */
export const ADDRESS_PIN_POSITIONS: Record<string, { x: number; y: number }> = {
  'Maximilianstraße 24, 80333 München':     { x: 48, y: 52 },
  'Schillerstraße 12, 10627 Berlin':         { x: 37, y: 43 },
  'Goethestraße 8, 60313 Frankfurt am Main': { x: 56, y: 36 },
  'Beethovenstraße 5, 50674 Köln':           { x: 43, y: 60 },
  'Kantstraße 20, 10623 Berlin':             { x: 53, y: 47 },
};

/**
 * The demo credentials accepted by the login form while we don't have a real
 * backend yet. Documented here so it's the single source of truth.
 */
export const DEMO_CREDENTIALS = {
  email: 'demo@stromteilung.de',
  password: 'demo123',
};
