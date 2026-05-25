/**
 * Type contracts mirroring the backend's Pydantic schemas.
 *
 * Hand-written for now — when the surface stabilises we'll generate these
 * from `/openapi.json` (FastAPI publishes it for free). Kept in lock-step
 * with `backend/app/schemas/` until then.
 */

// --- Shared problem+json shape (RFC 7807 via AppError handler) -------------

export interface ApiProblem {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// --- Auth ------------------------------------------------------------------

export type Role = 'buyer' | 'seller' | 'admin';
export type ApiLocale = 'de' | 'en';

export interface UserPublic {
  id: string;
  email: string;
  role: Role;
  locale: ApiLocale;
  is_active: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface AuthResponse {
  user: UserPublic;
  tokens: TokenPair;
}

export interface RegisterBody {
  email: string;
  password: string;
  role?: Role;
  locale?: ApiLocale;
}

export interface LoginBody {
  email: string;
  password: string;
}

// --- Profile ---------------------------------------------------------------

export interface ProfilePublic {
  user_id: string;
  display_name: string;
  whatsapp_e164: string | null;
  address_text: string | null;
  transformer_id: string | null;
  monthly_demand_kwh: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpsertBody {
  display_name: string;
  whatsapp_e164?: string | null;
  address_text?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  transformer_code?: string | null;
  monthly_demand_kwh?: number | null;
}

// --- Sellers / nearby ------------------------------------------------------

export interface NearbySeller {
  seller_id: string;
  display_name: string;
  address_text: string | null;
  whatsapp_e164: string | null;
  transformer_code: string | null;
  distance_m: number;
  day_rate: string;          // Decimal serialized as string
  night_rate: string | null;
  capacity_kwh: number;
  listing_id: string;
  avg_rating: number | null;
  review_count: number;
}

export interface NearbySellersResponse {
  items: NearbySeller[];
  count: number;
}

// --- Transformers ----------------------------------------------------------

export interface TransformerPublic {
  id: string;
  code: string;
  city: string;
}

// --- Listings --------------------------------------------------------------

export interface ListingPublic {
  id: string;
  seller_id: string;
  day_rate: string;
  night_rate: string | null;
  capacity_kwh: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListingCreateBody {
  day_rate: string | number;
  night_rate?: string | number | null;
  capacity_kwh: number;
}

export interface ListingUpdateBody {
  day_rate?: string | number;
  night_rate?: string | number | null;
  capacity_kwh?: number;
  active?: boolean;
}

// --- Inquiries -------------------------------------------------------------

export interface InquiryPublic {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string | null;
  created_at: string;
}

export interface InquiryCreateBody {
  seller_id: string;
  listing_id?: string | null;
}

// --- Ratings ---------------------------------------------------------------

export interface RatingPublic {
  id: string;
  rater_id: string;
  target_id: string;
  inquiry_id: string | null;
  stars: number;
  text_body: string | null;
  created_at: string;
}

export interface RatingsAggregate {
  avg_rating: number | null;
  review_count: number;
  items: RatingPublic[];
}

export interface RatingCreateBody {
  target_id: string;
  stars: number;
  inquiry_id?: string | null;
  text_body?: string | null;
}
