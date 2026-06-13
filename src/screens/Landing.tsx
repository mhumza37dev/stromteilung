import { ArrowRight, Leaf, MapPin, MessageCircle, Search, Zap } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useIsMobile } from '../hooks/useIsMobile';
import { Nav } from '../components/layout/Nav';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LocationSearch } from '../components/LocationSearch';
import { HERO_SELLERS } from '../data/sellers';
import { track } from '../lib/analytics';
import type { AuthMode, Role } from '../types';

export interface LandingProps {
  /**
   * Begin the signup or login flow.
   * - `mode === null` for an unspecified role (we'll let the user pick)
   * - `intent` says whether they came from "Log in" or "Register" — Auth uses
   *   this to choose which form to show first.
   */
  onStart: (mode: Role | null, intent?: AuthMode) => void;
}

/**
 * Public-facing marketing page.
 *
 * Two-column hero (copy + live preview), followed by a three-step explainer
 * grid. All interactive copy comes from the active locale; switching the
 * language pill re-renders this page instantly.
 */
export function Landing({ onStart }: LandingProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();

  const stats: Array<[string, string]> = [
    ['1.240+', t('statProviders')],
    ['18',     t('statCities')],
    ['4,8★',   t('statRating')],
  ];

  const steps = [
    { n: '01', title: t('how1Title'), desc: t('how1Desc'), Icon: MapPin },
    { n: '02', title: t('how2Title'), desc: t('how2Desc'), Icon: Search },
    { n: '03', title: t('how3Title'), desc: t('how3Desc'), Icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <Nav
        onAuth={(intent) => {
          track(intent === 'login' ? 'log_in_clicked' : 'register_clicked');
          onStart(null, intent);
        }}
      />

      <div className={['max-w-[1100px] mx-auto', isMobile ? 'px-[18px] pt-9' : 'px-6 pt-16'].join(' ')}>
        {/* Hero */}
        <div
          className={[
            'grid items-center',
            isMobile ? 'grid-cols-1 gap-8' : 'grid-cols-2 gap-12',
          ].join(' ')}
        >
          {/* Copy column */}
          <div>
            <div className="inline-flex items-center gap-1.5 bg-brand-100 text-brand-700 px-3 py-[5px] rounded-full text-[13px] font-semibold mb-5">
              <Leaf size={13} />
              {t('groLabel')}
            </div>
            <h1
              className={[
                'font-extrabold text-gray-900 leading-[1.1] mb-[18px] tracking-[-0.02em]',
                isMobile ? 'text-[32px]' : 'text-[46px]',
              ].join(' ')}
            >
              {t('tagline')}
              <br />
              <span className="text-brand-700">{t('taglineSub')}</span>
            </h1>
            <p className="text-[17px] text-gray-500 leading-[1.7] mb-8 max-w-[460px]">
              {t('taglineDesc')}
            </p>
            <div className="flex gap-3 flex-wrap">
              <Button
                onClick={() => {
                  track('get_started_clicked');
                  onStart(null);
                }}
              >
                {t('getStarted')} <ArrowRight size={16} />
              </Button>
            </div>
            <div className="flex gap-5 mt-7">
              {stats.map(([num, label]) => (
                <div key={label}>
                  <div className="font-bold text-[22px] text-gray-900">{num}</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview column */}
          <div>
            <div
              className={[
                'bg-white border border-gray-200/70 rounded-[20px] shadow-card box-border w-full',
                isMobile ? 'p-4' : 'p-6',
              ].join(' ')}
            >
              <LocationSearch />
              <div className="mt-4">
                {HERO_SELLERS.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[38px] h-[38px] rounded-[10px] bg-brand-50 flex items-center justify-center">
                        <Zap size={16} className="text-brand-700" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{s.name}</div>
                        <div className="text-xs text-gray-400">
                          {s.distance}{t('away')} · {s.capacity} {t('moCapacity')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[15px] text-brand-700">
                        {s.rate.toFixed(2)} €
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {s.nightRate != null ? `🌙 ${s.nightRate.toFixed(2)} €` : t('perKwh')}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="mt-3.5">
                  <Button
                    full
                    icon={<Search size={14} />}
                    onClick={() => {
                      track('see_all_providers_clicked');
                      onStart(null);
                    }}
                  >
                    {t('seeAll')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* "How it works" — three-step explainer */}
        <div className={isMobile ? 'mt-12 mb-12' : 'mt-20 mb-20'}>
          <div className={['text-center', isMobile ? 'mb-7' : 'mb-10'].join(' ')}>
            <div className={['font-bold text-gray-900 mb-2', isMobile ? 'text-[22px]' : 'text-[28px]'].join(' ')}>
              {t('howTitle')}
            </div>
            <div className="text-[15px] text-gray-400">{t('howSub')}</div>
          </div>
          <div
            className={[
              'grid gap-3.5',
              isMobile ? 'grid-cols-1' : 'grid-cols-3 gap-5',
            ].join(' ')}
          >
            {steps.map(({ n, title, desc, Icon }) => (
              <Card key={n}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="bg-brand-100 p-2.5 rounded-[10px]">
                    <Icon size={22} className="text-brand-700" />
                  </div>
                  <span className="text-xs font-bold text-gray-400 tracking-[0.05em]">{n}</span>
                </div>
                <div className="font-semibold text-base mb-2">{title}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
