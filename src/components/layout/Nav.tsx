import { useState, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, LogOut, MoreVertical, Star, User, Zap,
} from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Button } from '../ui/Button';
import { LangPill } from '../ui/LangPill';
import type { Role } from '../../types';

export interface NavProps {
  /** Drives the role-coloured avatar in the top-right. */
  role?: Role;
  /** Show the back arrow on the left. */
  onBack?: () => void;
  /** Show the avatar + dropdown menu (logged-in state). */
  onLogout?: () => void;
  /** Auth links (login / register) when no user is signed in. */
  onAuth?: (intent: 'login' | 'register') => void;
  onProfile?: () => void;
  onRatings?: () => void;
  /** Custom panel rendered inside the notifications dropdown. */
  notifications?: ReactNode;
  /** Unread-count shown as a red badge on the bell icon. */
  notifCount?: number;
  /** Fired when the user *opens* the notifications panel (for analytics). */
  onNotifOpen?: () => void;
}

/**
 * Sticky top navigation shared by every screen.
 *
 * Renders three slots:
 *  1. Left   — brand mark + optional back arrow.
 *  2. Right  — language pill + (notifications / avatar / auth links).
 *  3. Pop-overs — dropdowns for the bell and avatar buttons.
 *
 * Auth state derives entirely from which props are passed:
 *   - `onLogout` → user is signed in, show the avatar menu.
 *   - `onAuth`   → user is signed out, show login/register buttons.
 *   - neither    → public marketing nav (e.g. on the auth screen itself).
 */
export function Nav({
  role,
  onBack,
  onLogout,
  onAuth,
  onProfile,
  onRatings,
  notifications,
  notifCount = 0,
  onNotifOpen,
}: NavProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState(false);

  // Role-specific avatar colour (icon is a generic user glyph).
  const avatarBg  = role === 'buyer' ? 'bg-blue-100' : 'bg-brand-100';
  const avatarFg  = role === 'buyer' ? 'text-blue-700' : 'text-brand-700';
  const ringClass = role === 'buyer' ? 'border-blue-700' : 'border-brand-700';

  return (
    <nav
      className={[
        'bg-white border-b border-gray-200/70 flex items-center justify-between',
        'h-[60px] sticky top-0 z-50',
        isMobile ? 'px-3.5' : 'px-6',
      ].join(' ')}
    >
      {/* Left: optional back button + brand mark */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('back')}
            className="bg-transparent border-[1.5px] border-gray-200 rounded-lg p-2 cursor-pointer text-gray-500 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="bg-brand-100 p-[7px] rounded-[9px]">
            <Zap size={16} className="text-brand-700" />
          </div>
          <span className="font-bold text-[17px] text-gray-900">
            Strom<span className="text-brand-700">{t('brandAccent')}</span>
          </span>
        </div>
      </div>

      {/* Right: language toggle, optional bell & avatar / auth links */}
      <div className="flex items-center gap-2.5">
        <LangPill />

        {/* Notifications bell — only when a panel is provided */}
        {notifications && (
          <div className="relative">
            <button
              type="button"
              aria-label="notifications"
              onClick={() =>
                setNotifOpen((open) => {
                  if (!open) onNotifOpen?.();
                  return !open;
                })
              }
              className={[
                'w-9 h-9 rounded-full border-[1.5px] border-gray-200',
                'flex items-center justify-center cursor-pointer relative',
                notifOpen ? 'bg-gray-50' : 'bg-transparent',
              ].join(' ')}
            >
              <Bell size={17} className="text-gray-500" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-lg bg-red-600 text-white text-[10px] font-bold flex items-center justify-center box-border">
                  {notifCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setNotifOpen(false)} />
                <div
                  className="absolute top-[calc(100%+8px)] right-0 bg-white border border-gray-200/70 rounded-xl shadow-popover w-[340px] max-w-[90vw] z-[70] max-h-[480px] overflow-y-auto"
                  role="dialog"
                >
                  <div className="px-[18px] py-3.5 border-b border-gray-100 font-semibold text-[15px]">
                    {t('ratingsNotifs')}
                  </div>
                  <div className="p-4">{notifications}</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Avatar + dropdown when authenticated; auth links otherwise */}
        {onLogout ? (
          <div className="relative">
            <button
              type="button"
              aria-label="account menu"
              onClick={() => setMenuOpen((open) => !open)}
              className={[
                'w-[34px] h-[34px] rounded-full flex items-center justify-center',
                'cursor-pointer border-2',
                avatarBg,
                avatarFg,
                menuOpen ? ringClass : 'border-transparent',
              ].join(' ')}
            >
              <User size={17} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
                <div className="absolute top-[calc(100%+8px)] right-0 bg-white border border-gray-200/70 rounded-[10px] shadow-popover min-w-[190px] z-[70] overflow-hidden p-1.5">
                  {onProfile && (
                    <MenuItem icon={<User size={15} className="text-gray-500" />}
                      onClick={() => { setMenuOpen(false); onProfile(); }}>
                      {t('profile')}
                    </MenuItem>
                  )}
                  {onRatings && (
                    <MenuItem icon={<Star size={15} className="text-gray-500" />}
                      onClick={() => { setMenuOpen(false); onRatings(); }}>
                      {t('ratingsMenu')}
                    </MenuItem>
                  )}
                  <MenuItem icon={<LogOut size={15} className="text-gray-500" />}
                    onClick={() => { setMenuOpen(false); onLogout(); }}>
                    {t('logout')}
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        ) : onAuth ? (
          isMobile ? (
            // Compact 3-dot menu on small screens.
            <div className="relative">
              <button
                type="button"
                aria-label="menu"
                onClick={() => setAuthMenuOpen((open) => !open)}
                className={[
                  'w-9 h-9 rounded-lg border-[1.5px] border-gray-200 flex items-center justify-center cursor-pointer text-gray-500',
                  authMenuOpen ? 'bg-gray-50' : 'bg-transparent',
                ].join(' ')}
              >
                <MoreVertical size={18} />
              </button>
              {authMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setAuthMenuOpen(false)} />
                  <div className="absolute top-[calc(100%+8px)] right-0 bg-white border border-gray-200/70 rounded-[10px] shadow-popover min-w-[170px] z-[70] overflow-hidden p-1.5">
                    <MenuItem icon={<User size={15} className="text-gray-500" />}
                      onClick={() => { setAuthMenuOpen(false); onAuth('login'); }}>
                      {t('login')}
                    </MenuItem>
                    <MenuItem
                      icon={<ArrowRight size={15} className="text-brand-700" />}
                      onClick={() => { setAuthMenuOpen(false); onAuth('register'); }}
                      tint="brand"
                    >
                      {t('register')}
                    </MenuItem>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Button variant="ghost" small onClick={() => onAuth('login')}>{t('login')}</Button>
              <Button small onClick={() => onAuth('register')}>{t('register')}</Button>
            </>
          )
        ) : null}
      </div>
    </nav>
  );
}

/** Helper for items inside the avatar / auth dropdown panels. */
function MenuItem({
  icon,
  children,
  onClick,
  tint = 'neutral',
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  tint?: 'neutral' | 'brand';
}) {
  const palette =
    tint === 'brand'
      ? 'text-brand-700 hover:bg-brand-50 font-medium'
      : 'text-gray-700 hover:bg-gray-50';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full flex items-center gap-2.5 bg-transparent border-none cursor-pointer',
        'text-[14px] px-3 py-2 rounded-md text-left transition-colors',
        palette,
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  );
}
