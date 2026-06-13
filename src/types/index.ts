/**
 * Domain types used across the Stromteilung marketplace.
 *
 * Keeping these in one place gives us a single source of truth and makes it
 * easy to swap mock data for real API responses when the backend lands.
 */

/**
 * A marketplace participant. Mirrors the backend `UserRole` enum so we can
 * pass `user.role` straight through to screens without re-narrowing.
 *
 * The UI only renders distinct flows for `buyer` and `seller`; an `admin`
 * is rendered as a seller (admins use the seller dashboard plus the admin
 * surface, which lands in M6).
 */
export type Role = 'buyer' | 'seller' | 'admin';

/** Possible screens the app can render. The history stack uses these literals. */
export type Screen =
  | 'landing'
  | 'auth'
  | 'onboarding'
  | 'buyer-dash'
  | 'seller-dash'
  | 'profile'
  | 'ratings';

/** Whether the auth screen is showing the login or register flow. */
export type AuthMode = 'login' | 'register';

/** A green-energy seller entry shown in the buyer dashboard / hero list. */
export interface Seller {
  id: number;
  /** Display name — company or "Familie Foo". */
  name: string;
  /** Daytime price in €/kWh. */
  rate: number;
  /** Optional nightly price (22:00–06:00) in €/kWh. */
  nightRate: number | null;
  /** Monthly supply capacity in kWh. */
  capacity: number;
  /** Average review rating, 0–5. */
  rating: number;
  /** Number of reviews behind the rating. */
  reviews: number;
  /** Distance from buyer in meters (within 500m radius). */
  distance: number;
  /** Local grid transformer identifier (e.g. "TR-2847"). */
  transformer: string;
  /** Street-level location label. */
  location: string;
  /** Digits-only WhatsApp number for direct contact. */
  whatsapp: string;
}

/** Captured during onboarding and editable from the profile screen. */
export interface UserProfile {
  name?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
  /** Latitude resolved by the map picker (Nominatim or browser geolocation). */
  lat?: number | null;
  /** Longitude resolved by the map picker. */
  lng?: number | null;
  transformer?: string;
  /** Buyers: monthly demand in kWh (as string for input parity). */
  requirement?: string;
  /** Sellers: day price in €/kWh. */
  rate?: string;
  /** Sellers: optional night price. */
  nightRate?: string;
  /** Sellers: monthly capacity in kWh. */
  capacity?: string;
}

/** Seller dashboard listing — a single offer card the seller can edit. */
export interface Listing {
  id: number;
  rate: number;
  nightRate: number | null;
  capacity: number;
  active: boolean;
}

/** Supported locales for the multilingual UI. */
export type Locale = 'de' | 'en';
