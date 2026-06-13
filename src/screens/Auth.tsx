import { useState } from 'react';
import { Home, Loader2 } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';
import { Nav } from '../components/layout/Nav';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { renderLinks } from '../utils/renderText';
import { ApiError } from '../lib/api';
import { accountTypeFor, track, type AuthEntry } from '../lib/analytics';
import type { AuthMode, Role } from '../types';

/**
 * UI-side role selector — admin signs up as seller; we don't expose admin
 * here (admins are created via the backend's admin endpoint).
 */
type UiRole = Extract<Role, 'buyer' | 'seller'>;

export interface AuthProps {
  /** Initial role to preselect. */
  initRole?: Role | null;
  /** Login or register? Switchable from inside via the bottom link. */
  mode?: AuthMode;
  /** Notify the parent that registration just succeeded (→ onboarding). */
  onRegisterSuccess: () => void;
  /** Notify the parent that login just succeeded (→ dashboard). */
  onLoginSuccess: () => void;
  /** Flip the form from "Log in" to "Register". */
  onSwitchToRegister: () => void;
  /** Pop back to the previous screen. */
  onBack: () => void;
}

interface FormState {
  email: string;
  password: string;
  terms: boolean;
}

type FieldErrors = Partial<Record<'email' | 'password' | 'terms' | 'login', string>>;

/**
 * Combined login / register screen, wired to the real backend.
 *
 * Behaviour decisions:
 *
 * - **Single submit button** with an inline loader — never blocks the entire
 *   screen with a modal spinner; keeps the form interactive even mid-request
 *   so users can fix a typo without losing focus.
 * - **Errors live next to their field** (email, password, terms); the
 *   "wrong credentials" banner stays right above the submit button so it
 *   sits where the user's eyes already are.
 * - **No double-submit**: the button disables while the mutation is in
 *   flight (covers both clicks and `Enter` key).
 */
export function Auth({
  initRole,
  mode = 'register',
  onRegisterSuccess,
  onLoginSuccess,
  onSwitchToRegister,
  onBack,
}: AuthProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const { login, register } = useAuth();

  const isLogin = mode === 'login';
  // Which surface led here — used as the `entry` property on auth events.
  const entry: AuthEntry = isLogin ? 'login' : 'register';

  const [role, setRole] = useState<UiRole>(
    initRole === 'buyer' ? 'buyer' : 'seller',
  );
  const [form, setForm] = useState<FormState>({ email: '', password: '', terms: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const isBuyer = role === 'buyer';

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** Format-check email + password length + terms — pure, no side effects. */
  const validateRegister = (): boolean => {
    const next: FieldErrors = {};
    if (!form.email.includes('@')) next.email = t('emailError');
    if (form.password.length < 6) next.password = t('passwordError');
    if (!form.terms) next.terms = t('termsError');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setErrors({});

    if (isLogin) {
      // Login: let the backend do the validation; convert 401 → field error.
      setSubmitting(true);
      try {
        const user = await login({ email: form.email, password: form.password, role });
        track('login_clicked', {
          account_type: accountTypeFor(user.role),
          user_id: user.id,
        });
        onLoginSuccess();
      } catch (err) {
        setErrors({
          login:
            err instanceof ApiError && err.status === 401
              ? t('loginError')
              : err instanceof Error
                ? err.message
                : t('loginError'),
        });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!validateRegister()) return;

    setSubmitting(true);
    try {
      const user = await register({
        email: form.email,
        password: form.password,
        role,
      });
      track('create_account', {
        account_type: accountTypeFor(user.role),
        user_id: user.id,
        entry,
      });
      onRegisterSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'conflict') {
        setErrors({ email: err.message });
      } else {
        setErrors({
          login: err instanceof Error ? err.message : 'Registration failed.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <Nav onBack={onBack} />
      <div
        className={[
          'flex flex-col items-center',
          isMobile ? 'px-4 py-8' : 'px-6 py-[60px]',
        ].join(' ')}
      >
        <div className="w-full max-w-[460px]">
          <Card>
            {/* Role toggle — shown for both login and register. Accounts are
                keyed per (email, role), so even on login the user must say
                whether they're signing in as a buyer or a seller. */}
            <div
                className={[
                  'flex items-center justify-between px-3.5 py-3 rounded-[10px] border transition-all mb-[22px]',
                  isBuyer
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-surface border-gray-200',
                ].join(' ')}
              >
                <div className="flex items-center gap-2.5">
                  <Home
                    size={16}
                    className={isBuyer ? 'text-blue-700' : 'text-gray-400'}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {t('iAmBuyer')}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isBuyer}
                  onClick={() => {
                    const next: UiRole = isBuyer ? 'seller' : 'buyer';
                    setRole(next);
                    track('im_a_buyer_toggle_clicked', {
                      account_type: next,
                      entry,
                    });
                  }}
                  className={[
                    'w-11 h-6 rounded-full border-none cursor-pointer p-0 relative transition-colors flex-shrink-0',
                    isBuyer ? 'bg-blue-700' : 'bg-gray-300',
                  ].join(' ')}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left]"
                    style={{ left: isBuyer ? 22 : 2 }}
                  />
                </button>
              </div>

            <div className="mb-[22px]">
              <Badge color={isBuyer ? 'blue' : 'green'}>
                {isBuyer ? t('buyer') : t('seller')}
              </Badge>
              <div className="font-bold text-xl mt-2.5">
                {isLogin ? t('loginTitle') : t('createAccount')}
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-5">
              <div>
                <Input
                  label={t('emailLabel')}
                  type="email"
                  value={form.email}
                  onChange={(v) => updateField('email', v)}
                  placeholder={t('emailPlaceholder')}
                  required
                />
                {errors.email && (
                  <div className="text-xs text-red-600 mt-1">{errors.email}</div>
                )}
              </div>
              <div>
                <Input
                  label={t('passwordLabel')}
                  type="password"
                  value={form.password}
                  onChange={(v) => updateField('password', v)}
                  placeholder={t('passwordPlaceholder')}
                  required
                />
                {errors.password && (
                  <div className="text-xs text-red-600 mt-1">{errors.password}</div>
                )}
              </div>
              {!isLogin && (
                <div>
                  <label className="flex gap-2.5 cursor-pointer items-start">
                    <input
                      type="checkbox"
                      checked={form.terms}
                      onChange={(e) => updateField('terms', e.target.checked)}
                      className="mt-0.5 accent-brand-700 flex-shrink-0"
                    />
                    <span className="text-[13px] text-gray-700 leading-relaxed">
                      {renderLinks(t('termsText'), (spanIndex) =>
                        track('privacy_clicked', {
                          account_type: role,
                          document: spanIndex === 0 ? 'terms' : 'privacy',
                          entry,
                        }),
                      )}
                    </span>
                  </label>
                  {errors.terms && (
                    <div className="text-xs text-red-600 mt-0.5 pl-[22px]">
                      {errors.terms}
                    </div>
                  )}
                </div>
              )}
              {/* {isLogin && (
                <div className="text-xs text-gray-400 bg-surface border border-gray-200 rounded-lg px-3 py-2">
                  {t('demoHint')}
                </div>
              )} */}
              {errors.login && (
                <div className="text-xs text-red-600">{errors.login}</div>
              )}
            </div>

            <Button
              full
              disabled={submitting}
              onClick={handleSubmit}
              icon={submitting ? <Loader2 size={14} className="animate-spin" /> : undefined}
            >
              {isLogin ? t('continueBtn') : t('registerBtn')}
            </Button>

            {isLogin && (
              <div className="text-center mt-3.5">
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  className="bg-transparent border-none cursor-pointer text-brand-700 hover:text-brand-800 text-[13px] font-medium"
                >
                  {t('createNewAccount')}
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
