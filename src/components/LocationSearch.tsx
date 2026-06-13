import { useState } from 'react';
import { ArrowRight, Crosshair, Loader2, MapPin, X } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { ADDRESS_SUGGESTIONS } from '../data/suggestions';
import { track } from '../lib/analytics';

/** Count mock address matches for a query — mirrors the suggestions filter. */
function resultsFor(query: string): number {
  return ADDRESS_SUGGESTIONS.filter((s) =>
    s.toLowerCase().includes(query.toLowerCase().slice(0, 3)),
  ).length;
}

/**
 * Hero address search — the focal CTA on the landing page. A floating-label
 * input, autocomplete dropdown, simulated "locate me" button and an arrow
 * submit button.
 *
 * No external behaviour is wired in yet — the input value is local state so
 * marketing visitors can play with it before signing up.
 */
export function LocationSearch() {
  const { t } = useLang();
  const [value, setValue] = useState('Maximilianstraße 24, München');
  const [focused, setFocused] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Float the label whenever there's content or the field is focused.
  const labelFloating = focused || value.length > 0;

  const handleLocate = () => {
    setLocating(true);
    setShowSuggestions(false);
    window.setTimeout(() => {
      const located = 'Schillerstraße 12, 10627 Berlin';
      setValue(located);
      setLocating(false);
      track('enter_your_address_clicked', {
        address: located,
        method: 'locate_me',
        results_count: resultsFor(located),
      });
    }, 1400);
  };

  const handleSearch = () => {
    track('enter_your_address_clicked', {
      address: value,
      method: 'typed',
      results_count: resultsFor(value),
    });
  };

  const suggestions = ADDRESS_SUGGESTIONS.filter((s) =>
    s.toLowerCase().includes(value.toLowerCase().slice(0, 3)),
  ).slice(0, 4);

  return (
    <div className="mb-1 w-full box-border">
      <div className="flex gap-2 items-stretch w-full">
        {/* Floating-label input */}
        <div className="relative flex-1 min-w-0">
          <div
            className={[
              'relative h-14 flex items-center w-full box-border rounded-[10px] bg-white transition-colors border-[1.5px]',
              focused ? 'border-brand-700' : 'border-gray-300',
            ].join(' ')}
          >
            <label
              className={[
                'absolute left-4 pointer-events-none z-[2] transition-all duration-150 bg-white',
                labelFloating
                  ? 'top-[-8px] left-3 text-[11px] font-semibold px-1.5 ' +
                    (focused ? 'text-brand-700' : 'text-gray-500')
                  : 'top-1/2 -translate-y-1/2 text-[15px] text-gray-500 font-normal',
              ].join(' ')}
            >
              {t('enterAddress')}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setShowSuggestions(e.target.value.length > 2);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => { setFocused(false); setShowSuggestions(false); }, 150)}
              className="flex-1 min-w-0 w-full h-full border-none outline-none pr-11 pl-4 text-[15px] text-gray-900 bg-transparent rounded-[10px] box-border"
            />
            {value && (
              <button
                type="button"
                onClick={() => { setValue(''); setShowSuggestions(false); }}
                aria-label={t('clearInput')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-gray-400 p-1 flex items-center justify-center rounded-full hover:text-gray-600"
              >
                <X size={16} strokeWidth={2.2} />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && value.length > 2 && suggestions.length > 0 && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-gray-200 rounded-[10px] z-30 shadow-[0_8px_24px_rgba(0,0,0,0.08)] overflow-hidden">
              {suggestions.map((s) => (
                <div
                  key={s}
                  onMouseDown={() => { setValue(s); setShowSuggestions(false); }}
                  className="px-3.5 py-2.5 cursor-pointer text-[13px] flex gap-2 items-center border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <MapPin size={13} className="text-gray-400" />
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit arrow button */}
        <button
          type="button"
          aria-label={t('searchHere')}
          onClick={handleSearch}
          className="w-14 h-14 bg-brand-700 hover:bg-brand-800 border-none rounded-[10px] cursor-pointer flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <ArrowRight size={20} className="text-white" strokeWidth={2.2} />
        </button>
      </div>

      {/* Locate-me text link */}
      <button
        type="button"
        onClick={handleLocate}
        disabled={locating}
        className={[
          'mt-2.5 bg-transparent border-none py-1 text-[13px] font-medium text-brand-700 inline-flex items-center gap-1.5',
          locating ? 'cursor-default opacity-70' : 'cursor-pointer hover:text-brand-800',
        ].join(' ')}
      >
        {locating ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
        {locating ? t('locating') : t('locateMe')}
      </button>
    </div>
  );
}
