import { useEffect, useRef, useState, type CSSProperties } from 'react';
import maplibregl, {
  type Map as MLMap,
  Marker,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { useLang } from '../hooks/useLang';

/**
 * Free, no-API-key raster basemap served from openstreetmap.org.
 *
 * Defined as an inline style (no remote `style.json` round-trip), which keeps
 * the first render fast and removes one network dependency before the map can
 * appear. The earlier blank-map bug was NOT the tiles — it was the canvas
 * container collapsing to 0px height (see the `h-full w-full` note in the
 * render); these tiles render fine once the container is sized.
 */
const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
};

/**
 * Build the draggable map pin as a teardrop SVG with a vertical gradient in
 * the brand greens (lighter at the top, deeper at the tip) plus a soft drop
 * shadow — matching the design. Returned as a detached element so MapLibre's
 * `Marker({ element })` can own it. We render our own shape rather than tint
 * the default marker because the default is a flat single-colour SVG with no
 * gradient hook.
 */
function createPinElement(): HTMLDivElement {
  const PIN_W = 25;
  const PIN_H = 35;
  const el = document.createElement('div');
  el.style.width = `${PIN_W}px`;
  el.style.height = `${PIN_H}px`;
  el.style.cursor = 'grab';
  // Unique gradient id so multiple pins (or HMR remounts) never collide.
  const gid = `pin-grad-${Math.round(performance.now())}`;
  el.innerHTML = `
    <svg width="${PIN_W}" height="${PIN_H}" viewBox="0 0 30 40"
         xmlns="http://www.w3.org/2000/svg" style="display:block">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stop-color="#22c55e"/>
          <stop offset="55%" stop-color="#16a34a"/>
          <stop offset="100%" stop-color="#166534"/>
        </linearGradient>
        <filter id="${gid}-sh" x="-50%" y="-30%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.6"
                        flood-color="#14532d" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path filter="url(#${gid}-sh)"
            d="M15 1C7.82 1 2 6.82 2 14c0 9.25 11.13 23.1 12.06 24.24a1.2 1.2 0 0 0 1.88 0C16.87 37.1 28 23.25 28 14 28 6.82 22.18 1 15 1Z"
            fill="url(#${gid})" stroke="#ffffff" stroke-width="2"/>
      <circle cx="15" cy="14" r="4.6" fill="#ffffff" fill-opacity="0.92"/>
    </svg>`;
  return el;
}

/** Geographic centre of Germany — initial framing when no value is set. */
const GERMANY_CENTER: [number, number] = [10.4515, 51.1657];
const DEFAULT_ZOOM = 5.2;
const PICKED_ZOOM  = 15;

/**
 * Warm beige tint pulled over the basemap to match the design prototype.
 *
 * IMPORTANT: this is applied to a *separate overlay element*, never to the
 * element that hosts the MapLibre `<canvas>`. A CSS `filter` (or `transform`)
 * on the canvas's own container makes the browser rasterise the WebGL canvas
 * into the filter's compositing buffer, which is empty on first paint — the
 * map renders blank/white until *any* later style change forces a
 * re-composite (e.g. poking a property in DevTools, which is exactly the
 * "blank until I edit a style" symptom we hit). Tinting via a sibling overlay
 * with `mix-blend-mode` keeps the canvas un-filtered, so it paints normally.
 */
const WARM_TINT_OVERLAY: CSSProperties = {
  background:
    'linear-gradient(0deg, rgba(180,150,90,0.14), rgba(180,150,90,0.14))',
  mixBlendMode: 'multiply',
};

export interface MapPickerValue {
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface MapPickerProps {
  value: MapPickerValue;
  /** Fired whenever address or coordinates change. */
  onChange: (value: MapPickerValue) => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Forward-geocode through Nominatim. Searches worldwide — no country filter —
 * so any address resolves.
 */
async function searchNominatim(
  query: string,
  signal?: AbortSignal,
): Promise<NominatimResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) return [];
  return res.json();
}

/** Reverse-geocode a click/drag back into a human-readable address. */
async function reverseNominatim(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  const res = await fetch(url.toString(), {
    signal,
    headers: { 'Accept-Language': 'de' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.display_name === 'string' ? data.display_name : null;
}

/**
 * Real MapLibre + Nominatim address picker.
 *
 * Emits `{ address, lat, lng }` for:
 *  - typing + selecting a suggestion (debounced Nominatim search)
 *  - clicking on the map (reverse-geocoded back to an address)
 *  - dragging the pin (reverse-geocoded)
 *  - the "locate me" chip (real `navigator.geolocation` + reverse geocode)
 *
 * The map style is CartoDB Positron, tinted with a CSS filter so the cool
 * default palette warms into the beige/green tone used by the prototype.
 */
export function MapPicker({ value, onChange }: MapPickerProps) {
  const { t } = useLang();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<MLMap | null>(null);
  const markerRef    = useRef<Marker | null>(null);
  /**
   * Refs to the latest callback + value so the once-only map init effect
   * doesn't capture stale closures (map handlers persist for the map's
   * lifetime and need to call the *current* onChange).
   */
  const onChangeRef  = useRef(onChange);
  const valueRef     = useRef(value);
  onChangeRef.current = onChange;
  valueRef.current    = value;

  const [inputVal, setInputVal]     = useState(value.address);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching]   = useState(false);
  const [showSugg, setShowSugg]     = useState(false);
  const [focused, setFocused]       = useState(false);
  const [locating, setLocating]     = useState(false);
  const [geoError, setGeoError]     = useState<string | null>(null);
  /** Set when the basemap style can't load — turns a blank box into a hint. */
  const [tilesFailed, setTilesFailed] = useState(false);

  /**
   * Monotonic id for the in-flight reverse-geocode. Clicking/dragging fast
   * fires several reverse lookups; only the newest one is allowed to write
   * back, so a slow earlier response can't clobber a newer pin.
   */
  const reverseSeqRef = useRef(0);

  /**
   * Commit a picked coordinate: show an optimistic "locating…" label, then
   * reverse-geocode to a real address. Always resolves to *something* (falls
   * back to raw lat/lng) and never throws, so a flaky Nominatim call can't
   * leave the picker stuck. Kept in a ref so the once-mounted map handlers
   * always call the current closure (fresh `t`, `onChange`).
   */
  const commitPickRef = useRef<
    ((lng: number, lat: number) => Promise<void>) | undefined
  >(undefined);
  commitPickRef.current = async (lng, lat) => {
    const seq = ++reverseSeqRef.current;
    setInputVal(t('locating'));
    onChangeRef.current({ address: t('locating'), lat, lng });
    let finalAddress: string;
    try {
      const addr = await reverseNominatim(lat, lng);
      finalAddress = addr ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      finalAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    // A newer pick superseded us — drop this stale result.
    if (seq !== reverseSeqRef.current) return;
    setInputVal(finalAddress);
    onChangeRef.current({ address: finalAddress, lat, lng });
  };

  // --- Map lifecycle -------------------------------------------------------

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initial = valueRef.current;
    const hasInitialCoords = initial.lat != null && initial.lng != null;

    let map: MLMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: OSM_RASTER_STYLE,
        center: hasInitialCoords
          ? [initial.lng as number, initial.lat as number]
          : GERMANY_CENTER,
        zoom: hasInitialCoords ? PICKED_ZOOM : DEFAULT_ZOOM,
        attributionControl: { compact: true },
      });
    } catch (err) {
      // WebGL unavailable / context-creation failure — keep the rest of the
      // form usable (search + locate still work) instead of crashing.
      console.error('MapPicker: failed to initialise map', err);
      return;
    }
    mapRef.current = map;

    // Surface basemap load failures instead of leaving a silent blank box. We
    // only flag failures that happen *before* the style loads (host blocked /
    // unreachable); a single flaky tile after load shouldn't blank a working
    // map, so once loaded we just log.
    let styleLoaded = false;
    map.on('load', () => { styleLoaded = true; });
    map.on('error', (e) => {
      console.warn('MapPicker map error', e?.error ?? e);
      if (!styleLoaded) setTilesFailed(true);
    });

    // Drop / move the marker on map click, then reverse-geocode.
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      placeMarker(lng, lat);
      void commitPickRef.current?.(lng, lat);
    });

    if (hasInitialCoords) {
      placeMarker(initial.lng as number, initial.lat as number);
    }

    // Modals open with an animation and the container can be 0×0 on the first
    // frame, which leaves MapLibre with a broken/zero-size canvas. A
    // ResizeObserver re-measures whenever the box actually gets its size (and
    // on later layout changes), which is far more reliable than a fixed timer.
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => map.resize())
        : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    // Belt-and-braces for environments without ResizeObserver.
    const resizeTimer = window.setTimeout(() => map.resize(), 150);
    map.once('load', () => map.resize());

    return () => {
      window.clearTimeout(resizeTimer);
      ro?.disconnect();
      map.remove();
      mapRef.current    = null;
      markerRef.current = null;
    };
    // We deliberately mount the map once and pull fresh state via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fly / re-pin when the parent supplies new coordinates.
  useEffect(() => {
    if (!mapRef.current) return;
    setInputVal(value.address);
    if (value.lat != null && value.lng != null) {
      mapRef.current.flyTo({
        center: [value.lng, value.lat],
        zoom: PICKED_ZOOM,
        duration: 600,
      });
      placeMarker(value.lng, value.lat);
    } else {
      markerRef.current?.remove();
      markerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.lat, value.lng]);

  /**
   * Place or move the marker. Markers are draggable so users can fine-tune
   * the pin after a click without retyping.
   */
  function placeMarker(lng: number, lat: number) {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
      return;
    }
    // `anchor: 'bottom'` so the teardrop tip — not its centre — sits on the
    // coordinate, the way a map pin is expected to point.
    const marker = new maplibregl.Marker({
      element: createPinElement(),
      anchor: 'bottom',
      draggable: true,
    })
      .setLngLat([lng, lat])
      .addTo(map);
    marker.on('dragend', () => {
      const ll = marker.getLngLat();
      void commitPickRef.current?.(ll.lng, ll.lat);
    });
    markerRef.current = marker;
  }

  // --- Debounced address autocomplete --------------------------------------

  useEffect(() => {
    if (!showSugg || inputVal.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchNominatim(inputVal, controller.signal);
        setSuggestions(results);
      } catch {
        // Aborted or network error — silently ignore; the input keeps working.
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [inputVal, showSugg]);

  // --- Handlers ------------------------------------------------------------

  const handleSelectSuggestion = (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setInputVal(r.display_name);
    setSuggestions([]);
    setShowSugg(false);
    setGeoError(null);
    onChange({ address: r.display_name, lat, lng });
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: PICKED_ZOOM, duration: 600 });
      placeMarker(lng, lat);
    }
  };

  const handleClear = () => {
    setInputVal('');
    setSuggestions([]);
    setShowSugg(false);
    setGeoError(null);
    onChange({ address: '', lat: null, lng: null });
    markerRef.current?.remove();
    markerRef.current = null;
  };

  const handleLocate = () => {
    setGeoError(null);
    if (!('geolocation' in navigator) || !navigator.geolocation) {
      setGeoError(t('geoUnsupported'));
      return;
    }
    // Browsers only hand out geolocation over a secure context. On http the
    // permission prompt silently never resolves, which is exactly the
    // "acting up" the user saw — fail fast with a clear hint instead.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setGeoError(t('geoInsecure'));
      return;
    }

    setLocating(true);
    // Guard against a callback that never fires (some browsers ignore the
    // timeout option) so the spinner can't spin forever.
    let settled = false;
    const watchdog = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setLocating(false);
      setGeoError(t('geoTimeout'));
    }, 15000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(watchdog);
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [longitude, latitude],
            zoom: PICKED_ZOOM,
            duration: 600,
          });
          placeMarker(longitude, latitude);
        }
        void commitPickRef.current?.(longitude, latitude);
      },
      (err) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(watchdog);
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? t('geoDenied')
            : err.code === err.TIMEOUT
              ? t('geoTimeout')
              : t('geoUnavailable'),
        );
      },
      { timeout: 12000, enableHighAccuracy: false, maximumAge: 60000 },
    );
  };

  // --- Render --------------------------------------------------------------

  const hasPin = value.lat != null && value.lng != null;

  return (
    <div>
      <label className="text-[13px] font-medium text-gray-700 block mb-1.5">
        {t('addressTitle')} <span className="text-red-600">*</span>
      </label>

      <div
        className={[
          'relative h-[260px] rounded-[10px] overflow-hidden border-[1.5px] transition-colors',
          focused ? 'border-brand-700' : 'border-gray-200',
        ].join(' ')}
      >
        {/* Fill the sized parent with w/h-full rather than `absolute inset-0`.
            MapLibre adds its own `.maplibregl-map { position: relative }` to
            THIS element; since that class loads after Tailwind's utilities it
            wins the cascade and flips `absolute`→`relative`, at which point
            `inset-0` no longer stretches the box and it collapses to 0px tall
            (blank map). `h-full w-full` is immune to the position value. */}
        <div ref={containerRef} className="h-full w-full" />

        {/* Warm tint — a sibling overlay, NOT a filter on the canvas host, so
            the WebGL canvas paints normally (see WARM_TINT_OVERLAY). */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={WARM_TINT_OVERLAY}
        />

        {/* Basemap-failed fallback — search + locate still work above this */}
        {tilesFailed && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-gray-50 px-6 text-center text-xs text-gray-500 pointer-events-none">
            Karte konnte nicht geladen werden — Suche &amp; Standort funktionieren weiterhin.
          </div>
        )}

        {/* Search input overlay */}
        <div className="absolute top-3 left-3 right-3 z-10">
          <div
            className={[
              'flex items-center bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.15)] px-2.5 h-[42px] gap-2 border-[1.5px]',
              focused ? 'border-brand-700' : 'border-transparent',
            ].join(' ')}
          >
            {searching ? (
              <Loader2 size={15} className="text-gray-400 flex-shrink-0 animate-spin" />
            ) : (
              <Search size={15} className="text-gray-400 flex-shrink-0" />
            )}
            <input
              type="text"
              value={inputVal}
              placeholder={t('addressPlaceholder')}
              onChange={(e) => {
                setInputVal(e.target.value);
                setShowSugg(e.target.value.length > 2);
              }}
              onFocus={() => {
                setFocused(true);
                if (inputVal.length > 2) setShowSugg(true);
              }}
              onBlur={() =>
                window.setTimeout(() => {
                  setFocused(false);
                  setShowSugg(false);
                }, 200)
              }
              className="flex-1 min-w-0 border-none outline-none text-sm text-gray-900 bg-transparent"
            />
            {inputVal && (
              <button
                type="button"
                onClick={handleClear}
                className="bg-transparent border-none cursor-pointer text-gray-400 p-0 flex flex-shrink-0 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {showSugg && suggestions.length > 0 && (
            <div className="bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.14)] mt-1 overflow-hidden max-h-[180px] overflow-y-auto">
              {suggestions.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  onMouseDown={() => handleSelectSuggestion(r)}
                  className="w-full text-left px-3.5 py-2.5 cursor-pointer text-[13px] flex gap-2 items-start border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {r.display_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Locate-me chip */}
        <div className="absolute bottom-3 left-3 z-10">
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className={[
              'flex items-center gap-1.5 bg-white border-none rounded-full px-3 py-1.5 text-xs font-medium text-brand-700 shadow-[0_2px_8px_rgba(0,0,0,0.15)]',
              locating ? 'opacity-70 cursor-default' : 'cursor-pointer hover:bg-gray-50',
            ].join(' ')}
          >
            {locating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Crosshair size={13} />
            )}
            {locating ? t('locating') : t('locateMe')}
          </button>
        </div>

        {/* Hint shown when no pin has been placed */}
        {!hasPin && (
          <div className="absolute bottom-3 right-3 bg-white/90 rounded px-2.5 py-1 text-[11px] text-gray-500 pointer-events-none">
            {t('clickToPin')}
          </div>
        )}
      </div>

      {/* Geolocation error — actionable, never blocks the manual flow */}
      {geoError && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
          {geoError}
        </div>
      )}

      {/* Selected address line */}
      {value.address && (
        <div className="mt-2 text-xs flex gap-[5px] items-start">
          <MapPin size={11} className="text-brand-700 mt-0.5 flex-shrink-0" />
          <span
            className="text-gray-700 font-medium"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {value.address}
          </span>
        </div>
      )}
      <div className="text-xs text-gray-400 mt-1">{t('addressSub')}</div>
    </div>
  );
}
