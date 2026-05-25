import { useState, type MouseEvent } from 'react';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { ADDRESS_PIN_POSITIONS, ADDRESS_SUGGESTIONS } from '../data/suggestions';

export interface MapPickerProps {
  /** Currently selected address (controlled). */
  value: string;
  /** Fired whenever the address changes — typed, suggested or map-clicked. */
  onChange: (value: string) => void;
}

interface PinPosition { x: number; y: number }

/**
 * Decorative SVG map + searchable address field + draggable-ish pin.
 *
 * This is a self-contained mock of a Maps integration. It will be replaced
 * by a real map library (Mapbox / MapLibre) once the backend ships, but the
 * API (`value` / `onChange`) is intentionally minimal so the parent stays
 * stable across that swap.
 */
export function MapPicker({ value, onChange }: MapPickerProps) {
  const { t } = useLang();
  const [inputVal, setInputVal] = useState(value);
  const [focused, setFocused] = useState(false);
  const [showSugg, setShowSugg] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pin, setPin] = useState<PinPosition | null>(
    value && ADDRESS_PIN_POSITIONS[value] ? ADDRESS_PIN_POSITIONS[value] : null,
  );

  /** Sync the local + parent state and place a pin. */
  const selectAddress = (address: string, position?: PinPosition) => {
    setInputVal(address);
    onChange(address);
    setPin(
      position ||
        ADDRESS_PIN_POSITIONS[address] ||
        { x: 42 + Math.random() * 16, y: 38 + Math.random() * 16 },
    );
    setShowSugg(false);
  };

  /**
   * Treat clicks anywhere on the map as a coarse address pin. Since this is a
   * mock map, we approximate by binning x-coordinates into the canned list.
   */
  const handleMapClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-noprop]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const idx = Math.min(
      Math.floor((x / 100) * ADDRESS_SUGGESTIONS.length),
      ADDRESS_SUGGESTIONS.length - 1,
    );
    selectAddress(ADDRESS_SUGGESTIONS[idx], { x, y });
  };

  /** Simulate a browser geolocation lookup with a short loading state. */
  const handleLocate = () => {
    setLocating(true);
    window.setTimeout(() => {
      selectAddress('Schillerstraße 12, 10627 Berlin', { x: 37, y: 43 });
      setLocating(false);
    }, 1400);
  };

  const filteredSuggestions =
    showSugg && inputVal.length > 2
      ? ADDRESS_SUGGESTIONS.filter((s) =>
          s.toLowerCase().includes(inputVal.toLowerCase().slice(0, 3)),
        )
      : [];

  return (
    <div>
      <label className="text-[13px] font-medium text-gray-700 block mb-1.5">
        {t('addressTitle')} <span className="text-red-600">*</span>
      </label>

      <div
        onClick={handleMapClick}
        className={[
          'relative h-[260px] rounded-[10px] overflow-hidden border-[1.5px] transition-colors cursor-crosshair',
          focused ? 'border-brand-700' : 'border-gray-200',
        ].join(' ')}
      >
        <DecorativeCityMap />

        {/* Search input overlay — interactive, so we stop propagation */}
        <div
          data-noprop="1"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 left-3 right-3 z-10"
        >
          <div
            className={[
              'flex items-center bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.15)] px-2.5 h-[42px] gap-2 border-[1.5px]',
              focused ? 'border-brand-700' : 'border-transparent',
            ].join(' ')}
          >
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={inputVal}
              placeholder={t('addressPlaceholder')}
              onChange={(e) => {
                setInputVal(e.target.value);
                onChange(e.target.value);
                setShowSugg(e.target.value.length > 2);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => { setFocused(false); setShowSugg(false); }, 150)}
              className="flex-1 min-w-0 border-none outline-none text-sm text-gray-900 bg-transparent"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => { setInputVal(''); onChange(''); setPin(null); setShowSugg(false); }}
                className="bg-transparent border-none cursor-pointer text-gray-400 p-0 flex flex-shrink-0 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>
          {filteredSuggestions.length > 0 && (
            <div className="bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.14)] mt-1 overflow-hidden">
              {filteredSuggestions.map((s) => (
                <div
                  key={s}
                  onMouseDown={() => selectAddress(s)}
                  className="px-3.5 py-2.5 cursor-pointer text-[13px] flex gap-2 items-center border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <MapPin size={13} className="text-gray-400" />
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pin marker — drops above the click location */}
        {pin && (
          <div
            className="absolute z-[15] pointer-events-none transition-all duration-300 ease-out"
            style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}
          >
            <div className="flex flex-col items-center">
              <div
                className="w-7 h-7 rounded-[50%_50%_50%_0] bg-brand-700 border-[2.5px] border-white shadow-[0_3px_10px_rgba(0,0,0,0.3)]"
                style={{ transform: 'rotate(-45deg)' }}
              />
              <div className="w-1.5 h-1.5 rounded-full bg-black/20 -mt-0.5" />
            </div>
          </div>
        )}

        {/* Locate-me chip — inside the map, bottom-left */}
        <div
          data-noprop="1"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-3 z-10"
        >
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className={[
              'flex items-center gap-1.5 bg-white border-none rounded-full px-3 py-1.5 text-xs font-medium text-brand-700 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.15)]',
              locating ? 'opacity-70 cursor-default' : '',
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

        {/* Hint shown when no pin has been placed yet */}
        {!pin && (
          <div className="absolute bottom-3 right-3 bg-white/90 rounded px-2.5 py-1 text-[11px] text-gray-400 pointer-events-none">
            {t('clickToPin')}
          </div>
        )}
      </div>

      {/* Selected address line + sub-hint */}
      {inputVal && (
        <div className="mt-2 text-xs flex gap-[5px] items-center">
          <MapPin size={11} className="text-brand-700" />
          <span className="text-gray-700 font-medium">{inputVal}</span>
        </div>
      )}
      <div className="text-xs text-gray-400 mt-1">{t('addressSub')}</div>
    </div>
  );
}

/**
 * Hand-drawn city-block SVG. Pure decoration — kept as a separate component
 * to keep the picker readable.
 */
function DecorativeCityMap() {
  return (
    <svg
      viewBox="0 0 400 260"
      width="100%"
      height="100%"
      className="block pointer-events-none"
    >
      <rect width="400" height="260" fill="#ede8e0" />
      {/* Parks */}
      <rect x="228" y="0"   width="104" height="88" rx="2" fill="#c8ddb5" />
      <rect x="0"   y="162" width="88"  height="98" rx="2" fill="#c8ddb5" />
      <rect x="294" y="162" width="106" height="98" rx="2" fill="#c8ddb5" />
      {/* River */}
      <path
        d="M0 104 Q80 94 160 108 Q240 122 320 106 Q360 98 400 108 L400 122 Q360 114 320 120 Q240 136 160 122 Q80 110 0 118 Z"
        fill="#aacde8"
      />
      {/* Major roads */}
      <rect x="0"   y="112" width="400" height="7" fill="#fff" />
      <rect x="0"   y="50"  width="400" height="6" fill="#fff" />
      <rect x="0"   y="186" width="400" height="6" fill="#fff" />
      <rect x="144" y="0"   width="8"   height="260" fill="#fff" />
      <rect x="258" y="0"   width="7"   height="260" fill="#fff" />
      {/* Secondary roads */}
      <rect x="0"   y="24"  width="400" height="3" fill="#f2ece4" />
      <rect x="0"   y="146" width="400" height="3" fill="#f2ece4" />
      <rect x="0"   y="220" width="400" height="3" fill="#f2ece4" />
      <rect x="62"  y="0"   width="3"   height="260" fill="#f2ece4" />
      <rect x="108" y="0"   width="3"   height="260" fill="#f2ece4" />
      <rect x="196" y="0"   width="3"   height="260" fill="#f2ece4" />
      <rect x="308" y="0"   width="3"   height="260" fill="#f2ece4" />
      <rect x="356" y="0"   width="3"   height="260" fill="#f2ece4" />
      {/* Park trees */}
      {[
        [256, 22, 7], [288, 16, 9], [272, 44, 8], [308, 36, 6],
        [316, 62, 8], [250, 64, 6], [24, 186, 8], [52, 196, 9],
        [36, 218, 7], [68, 212, 8], [312, 190, 9], [344, 202, 7],
        [326, 224, 8],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#aed48a" opacity="0.85" />
      ))}
    </svg>
  );
}
