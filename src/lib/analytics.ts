/**
 * Analytics — the single, typed entry point for Mixpanel tracking.
 *
 * Design goals (why this file looks the way it does):
 *
 *  1. **Clean / one source of truth.** Every event the product spec defines
 *     lives in the `MixpanelEvents` map below, keyed by its snake_case name and
 *     typed with its exact properties. Call sites use `track('whatsapp_clicked',
 *     {…})` and get full autocomplete + a compile error if a property is wrong
 *     or missing. No stringly-typed `mixpanel.track(...)` scattered around.
 *
 *  2. **Memory-efficient / optimised.** The Mixpanel SDK (~tens of KB) is *never*
 *     in the first-paint bundle. We `import('mixpanel-browser')` lazily on the
 *     first track/identify call and cache the resulting instance in a single
 *     module-level promise. Every public function is fire-and-forget — it never
 *     blocks render or awaits the network.
 *
 *  3. **Safe by default.** With no `VITE_MIXPANEL_TOKEN` (local dev, previews)
 *     the loader resolves to `null` and every call becomes a cheap no-op — zero
 *     network traffic, no console noise.
 *
 *  4. **GDPR.** Per the tracking spec we never send email. Users are identified
 *     by their database `id`; Mixpanel's own `distinct_id` covers anonymous
 *     visitors, so we never pass a manual `unique id`. Data is sent to
 *     Mixpanel's EU residency cluster.
 */
import type { Mixpanel } from 'mixpanel-browser';
import type { Role } from './api-types';
import type { UserPublic } from './api-types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TOKEN = (import.meta.env.VITE_MIXPANEL_TOKEN as string | undefined)?.trim();

/** EU data-residency ingestion host — required for GDPR compliance. */
const EU_API_HOST = 'https://api-eu.mixpanel.com';

// ---------------------------------------------------------------------------
// Event registry — the typed contract for every tracked event.
// ---------------------------------------------------------------------------
//
// `unique id` is intentionally absent everywhere: Mixpanel attaches its own
// `distinct_id` automatically (see file header). `role` / `locale` ride along
// as super-properties registered at identify time, so per-event types below
// only carry what the *call site* knows.

/** Which surface the user came through when entering the auth flow. */
export type AuthEntry = 'login' | 'get_started' | 'register';
/** Buyer- vs seller-facing variant of an otherwise shared event. */
export type AccountType = 'buyer' | 'seller';
/** Where a transformer-info helper was opened from. */
export type TransformerInfoSource =
  | 'create_account'
  | 'buyer_dashboard'
  | 'seller_dashboard';
/** Buyer dashboard sort/filter chips. */
export type BuyerFilter = 'all' | 'cheapest' | 'top_rated';

export interface MixpanelEvents {
  // --- Website home -------------------------------------------------------
  website_visitors: Record<string, never>;
  get_started_clicked: Record<string, never>;
  register_clicked: Record<string, never>;
  log_in_clicked: Record<string, never>;
  see_all_providers_clicked: Record<string, never>;
  enter_your_address_clicked: {
    address: string;
    method: 'locate_me' | 'typed';
    results_count: number;
  };

  // --- Buyer + seller mutual ---------------------------------------------
  im_a_buyer_toggle_clicked: { account_type: AccountType; entry: AuthEntry };
  privacy_clicked: {
    account_type: AccountType;
    document: 'terms' | 'privacy';
    entry: AuthEntry;
  };
  create_account: { account_type: AccountType; user_id: string; entry: AuthEntry };
  your_info_clicked: {
    account_type: AccountType;
    has_whatsapp: boolean;
    has_location: boolean;
    transformer_no: string | null;
  };
  transformer_info_clicked: {
    user_id: string | null;
    source: TransformerInfoSource;
  };
  complete_profile_clicked: {
    account_type: AccountType;
    user_id: string;
    transformer_no: string | null;
  };
  login_clicked: { account_type: AccountType; user_id: string };
  dashboard_views: {
    account_type: AccountType;
    user_id: string;
    listings_count: number;
    daytime_listings: number;
    nighttime_listings: number;
  };
  profile_data_clicked: {
    account_type: AccountType;
    user_id: string;
    daytime_price: number | null;
    nighttime_price: number | null;
    monthly_capacity: number | null;
  };
  update_profile: {
    account_type: AccountType;
    user_id: string;
    updated_whatsapp: string | null;
    updated_transformer_no: string | null;
  };
  rate_clicked: {
    account_type: AccountType;
    buyer_user_id: string | null;
    seller_user_id: string | null;
  };
  rate_seller_clicked: {
    account_type: AccountType;
    buyer_user_id: string | null;
    seller_user_id: string | null;
    rating: number | null;
    skip: boolean;
  };
  logout_account: {
    account_type: AccountType;
    user_id: string;
    listings_count: number | null;
    whatsapp_clicks: number | null;
  };
  delete_account: {
    account_type: AccountType;
    user_id: string;
    listings_count: number | null;
    whatsapp_clicks: number | null;
  };

  // --- Seller -------------------------------------------------------------
  seller_add_listing: {
    user_id: string;
    daytime_price: number;
    nighttime_price: number | null;
    monthly_capacity: number;
  };
  remove_listing: {
    user_id: string;
    daytime_price: number;
    nighttime_price: number | null;
    monthly_capacity: number;
  };
  edit_listing: {
    user_id: string;
    updated_daytime_price: number;
    updated_nighttime_price: number | null;
    updated_monthly_capacity: number;
  };
  notification_icon_clicked: {
    user_id: string;
    new_notifications: number;
    total_notifications: number;
  };

  // --- Buyer --------------------------------------------------------------
  /** NORTH STAR — a buyer reaches out to a seller over WhatsApp. */
  whatsapp_clicked: {
    buyer_user_id: string | null;
    seller_user_id: string;
    daytime_cost: number;
    nighttime_cost: number | null;
    capacity: number;
    distance: number;
    transformer_no: string | null;
    rating: number | null;
    review_count: number;
  };
  filter_clicked: { buyer_user_id: string | null; filter: BuyerFilter };
}

export type EventName = keyof MixpanelEvents;

// ---------------------------------------------------------------------------
// Lazy, cached SDK singleton
// ---------------------------------------------------------------------------

/**
 * Resolves to an initialised Mixpanel instance, or `null` when tracking is
 * disabled (no token). Cached so the dynamic import + init happen exactly once
 * for the lifetime of the tab.
 */
let instance: Promise<Mixpanel | null> | null = null;

function getMixpanel(): Promise<Mixpanel | null> {
  if (instance) return instance;

  if (!TOKEN) {
    instance = Promise.resolve(null);
    return instance;
  }

  instance = import('mixpanel-browser')
    .then(({ default: mixpanel }) => {
      mixpanel.init(TOKEN, {
        api_host: EU_API_HOST,
        persistence: 'localStorage',
        // We send our own well-defined events; don't auto-fire pageviews.
        track_pageview: false,
        // Honour Do-Not-Track headers — friendlier under GDPR.
        ignore_dnt: false,
        // batch_requests defaults to true; kept implicit.
      });
      // Tag every event with the build environment for easy filtering.
      mixpanel.register({ app_env: import.meta.env.MODE });
      return mixpanel;
    })
    .catch((err) => {
      // A failed analytics load must never break the app.
      console.warn('[analytics] Mixpanel failed to load', err);
      return null;
    });

  return instance;
}

// ---------------------------------------------------------------------------
// Session stats — lightweight counters that outlive individual screens.
// ---------------------------------------------------------------------------
//
// Some events (`logout_account`, `delete_account`) need running totals that the
// component firing them can't see — e.g. App.tsx knows nothing about how many
// WhatsApp clicks the buyer made this session. Rather than thread React state
// through the whole tree, we keep one tiny module-level object and reset it on
// `resetUser()`. Memory cost: a single object with two numbers.

const sessionStats = {
  whatsappClicks: 0,
  /** Last-known seller listing count, refreshed on each seller dashboard view. */
  listingsCount: null as number | null,
};

/** North-star side effect: count a buyer's outbound WhatsApp contacts. */
export function bumpWhatsappClicks(): void {
  sessionStats.whatsappClicks += 1;
}

/** Snapshot the seller's listing count so logout/delete can report it. */
export function setListingsCount(n: number): void {
  sessionStats.listingsCount = n;
}

export function getWhatsappClicks(): number {
  return sessionStats.whatsappClicks;
}

export function getListingsCount(): number | null {
  return sessionStats.listingsCount;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Track an event. Fully typed: the property object must match the event's
 * entry in `MixpanelEvents`. Fire-and-forget — never awaited by callers.
 */
export function track<E extends EventName>(
  event: E,
  ...props: MixpanelEvents[E] extends Record<string, never>
    ? [props?: undefined]
    : [props: MixpanelEvents[E]]
): void {
  const [properties] = props;
  void getMixpanel().then((mp) => mp?.track(event, properties));
}

/**
 * Bind the current user to the Mixpanel identity and populate the People
 * profile with the attributes we know at auth time. Called from AuthContext on
 * login / register / session bootstrap.
 *
 * `$email`, `$name`, `$created` are Mixpanel's reserved People properties — the
 * UI shows them as the profile's email / display name / signup date. `$name`
 * is derived from the email local-part as a sensible default until the saved
 * profile's real display name arrives via `setUserTraits()`.
 */
export function identifyUser(user: UserPublic): void {
  void getMixpanel().then((mp) => {
    if (!mp) return;
    mp.identify(user.id);
    mp.register({ role: user.role, locale: user.locale });

    const local = user.email.split('@')[0]?.replace(/[._+-]/g, ' ').trim();
    const name = local
      ? local.charAt(0).toUpperCase() + local.slice(1)
      : undefined;

    mp.people.set({
      $email: user.email,
      ...(name ? { $name: name } : {}),
      role: user.role,
      locale: user.locale,
      is_active: user.is_active,
      $created: user.created_at,
    });
  });
}

/** Traits sourced from the user's saved profile (loaded after identify). */
export interface UserTraits {
  name?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  transformer?: string | null;
  monthlyDemandKwh?: number | null;
  /** Pinned coordinates — used to reverse-geocode a reliable city. */
  lat?: number | null;
  lng?: number | null;
}

// Reverse-geocode cache — keyed by coarse "lat,lng" so we hit Nominatim at most
// once per location for the tab's lifetime (it rate-limits to ~1 req/s).
const cityCache = new Map<string, string | null>();

/** Coarse key (~100m) so tiny pin nudges reuse the cached city. */
function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/**
 * Reverse-geocode coordinates to a *reliable* city via Nominatim's structured
 * `address` object — reading the real `city`/`town`/`village` field instead of
 * guessing from a freeform string (which yields the province or country). The
 * same Nominatim service powers the app's map picker. Returns `null` rather
 * than falling back to a region/country, so we never set a wrong city.
 */
async function reverseGeocodeCity(
  lat: number,
  lng: number,
): Promise<string | null> {
  const key = coordKey(lat, lng);
  const cached = cityCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('addressdetails', '1');
    // zoom=10 asks for city-level granularity.
    url.searchParams.set('zoom', '10');
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      cityCache.set(key, null);
      return null;
    }
    const data = await res.json();
    const a = (data?.address ?? {}) as Record<string, string | undefined>;
    // OSM's recommended city fallback chain — deliberately stops *before*
    // county/state/country so we never label a country as the city.
    const city =
      a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? null;
    cityCache.set(key, city);
    return city;
  } catch {
    cityCache.set(key, null);
    return null;
  }
}

/**
 * Enrich the Mixpanel People profile with traits from the user's saved
 * profile. Call this once the profile has loaded (it's idempotent — later
 * calls overwrite). `$name` / `$phone` are Mixpanel-reserved.
 *
 * The city deserves a note: Mixpanel auto-sets `$city` from the request IP via
 * GeoIP, which is often wrong (e.g. an ISP routing a Karachi user through
 * Islamabad). When we have the user's pinned coordinates we reverse-geocode a
 * reliable city and set `$city` explicitly — both on the People profile and as
 * a super-property — overriding the GeoIP guess. Without coordinates we leave
 * `$city` to GeoIP rather than guessing from the address text.
 */
export function setUserTraits(traits: UserTraits): void {
  void getMixpanel().then((mp) => {
    if (!mp) return;
    const props: Record<string, unknown> = {};
    if (traits.name) props.$name = traits.name;
    if (traits.whatsapp) props.$phone = traits.whatsapp;
    if (traits.transformer) props.transformer_code = traits.transformer;
    if (traits.monthlyDemandKwh != null) {
      props.monthly_demand_kwh = traits.monthlyDemandKwh;
    }
    if (traits.address) props.address = traits.address;
    if (Object.keys(props).length) mp.people.set(props);

    // City resolves asynchronously off the pinned coordinates (cached).
    if (traits.lat != null && traits.lng != null) {
      void reverseGeocodeCity(traits.lat, traits.lng).then((city) => {
        if (!city) return;
        mp.people.set({ $city: city });
        // Carry the corrected city onto future events too.
        mp.register({ $city: city });
      });
    }
  });
}

/** Map a domain role to the buyer/seller variant used in event props. */
export function accountTypeFor(role: Role): AccountType {
  return role === 'buyer' ? 'buyer' : 'seller';
}

/**
 * Clear the Mixpanel identity and reset session counters. Called from
 * AuthContext on logout / account deletion so the next user starts clean.
 */
export function resetUser(): void {
  sessionStats.whatsappClicks = 0;
  sessionStats.listingsCount = null;
  void getMixpanel().then((mp) => {
    if (!mp) return;
    // Fresh anonymous distinct_id + cleared super-props/People identity, so the
    // next (anonymous or new) user's events can't be attributed to this one.
    mp.reset();
    // reset() also wipes super-properties; re-register the build-wide one that
    // isn't user-specific so post-logout events keep it. (`role`/`locale`/
    // `$city` are intentionally left for the next identify to repopulate.)
    mp.register({ app_env: import.meta.env.MODE });
  });
}
