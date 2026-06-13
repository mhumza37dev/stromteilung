import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { queryClient } from './lib/queryClient';
import { Landing } from './screens/Landing';                  // eager — first paint
import {
  AuthSkeleton,
  BuyerDashSkeleton,
  OnboardingSkeleton,
  ProfileSkeleton,
  RatingsSkeleton,
  SellerDashSkeleton,
} from './screens/skeletons';
import type { AuthMode, Screen } from './types';

/**
 * Lazy chunks — each screen becomes its own JS bundle. The Landing chunk is
 * the only thing the browser downloads on first paint; everything else is
 * fetched on demand when the user navigates to it.
 *
 * Each `Suspense` boundary below pairs the lazy import with a screen-shaped
 * skeleton so the transition feels like "the page is filling in" instead of
 * a layout shift.
 */
// Import thunks kept as named references so we can both lazy-mount *and*
// prefetch (warm the chunk before navigation) without duplicating the path.
const importAuth = () => import('./screens/Auth');
const importOnboarding = () => import('./screens/Onboarding');
const importBuyerDash = () => import('./screens/BuyerDash');
const importSellerDash = () => import('./screens/SellerDash');
const importProfilePage = () => import('./screens/ProfilePage');
const importRatingsPage = () => import('./screens/RatingsPage');

const Auth = lazy(() => importAuth().then((m) => ({ default: m.Auth })));
const Onboarding = lazy(() =>
  importOnboarding().then((m) => ({ default: m.Onboarding })),
);
const BuyerDash = lazy(() =>
  importBuyerDash().then((m) => ({ default: m.BuyerDash })),
);
const SellerDash = lazy(() =>
  importSellerDash().then((m) => ({ default: m.SellerDash })),
);
const ProfilePage = lazy(() =>
  importProfilePage().then((m) => ({ default: m.ProfilePage })),
);
const RatingsPage = lazy(() =>
  importRatingsPage().then((m) => ({ default: m.RatingsPage })),
);

/**
 * Warm the chunks the user is about to need. Fire-and-forget: a failed
 * prefetch is harmless — the real lazy mount retries the import and its
 * Suspense fallback covers the wait.
 */
function prefetch(...thunks: Array<() => Promise<unknown>>) {
  for (const load of thunks) load().catch(() => {});
}


/**
 * Root of the app — wires every provider and delegates routing to
 * `<AppRouter />` (which can read `useAuth()`, unlike App itself).
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider initial="de">
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}


/**
 * Screen-stack router.
 *
 * Why an in-memory stack rather than React Router? The marketplace flow is a
 * tightly-coupled wizard (landing → auth → onboarding → dashboard) with no
 * shareable URLs yet. The stack remembers what "back" means without forcing
 * every screen to know its previous step.
 *
 * Auth navigation is reactive: when `useAuth().user` flips from `null` →
 * authenticated we land on the right dashboard; when it flips back to null
 * (logout) we reset to landing.
 */
function AppRouter() {
  const { user, status, logout, deleteAccount } = useAuth();

  const [history, setHistory] = useState<Screen[]>(['landing']);
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [justRegistered, setJustRegistered] = useState(false);

  const screen = history[history.length - 1];

  const navigate = useCallback((s: Screen) => {
    setHistory((h) => [...h, s]);
  }, []);

  const goBack = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  /** Drop everything and return to landing — used on logout. */
  const resetToLanding = useCallback(() => {
    setHistory(['landing']);
    setJustRegistered(false);
  }, []);

  /**
   * React to auth state changes:
   * - Authenticated + just registered → onboarding
   * - Authenticated + has account     → role-specific dashboard
   * - Anonymous after being logged in → landing
   */
  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    setHistory((h) => {
      const head = h[h.length - 1];
      if (head === 'onboarding' || head === 'buyer-dash' || head === 'seller-dash') {
        return h;
      }
      const target: Screen = justRegistered
        ? 'onboarding'
        : user.role === 'buyer'
          ? 'buyer-dash'
          : 'seller-dash';
      return [...h.filter((s) => s === 'landing'), target];
    });
  }, [status, user, justRegistered]);

  // Prefetch the next screens' chunks based on where the user is, so the
  // post-login / post-navigation transition swaps in instantly instead of
  // showing a lazy-load Suspense skeleton:
  //  - on landing → warm the Auth chunk (the obvious next click)
  //  - on auth    → warm onboarding + both dashboards (login resolves to one)
  useEffect(() => {
    if (screen === 'landing') prefetch(importAuth);
    else if (screen === 'auth') {
      prefetch(importOnboarding, importBuyerDash, importSellerDash);
    }
  }, [screen]);

  // Wrapper for logout that also clears local stack state.
  const handleLogout = useCallback(async () => {
    await logout();
    resetToLanding();
  }, [logout, resetToLanding]);

  // Account deletion: soft-delete server-side, then drop the session and
  // return to landing. Rethrows on failure so the modal keeps itself open and
  // shows the error instead of navigating away from a still-live account.
  const handleDeleteAccount = useCallback(async () => {
    await deleteAccount();
    resetToLanding();
  }, [deleteAccount, resetToLanding]);

  const onStartFromLanding = useCallback(
    (_mode: unknown, intent?: AuthMode) => {
      setAuthMode(intent === 'login' ? 'login' : 'register');
      setJustRegistered(false);
      navigate('auth');
    },
    [navigate],
  );

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  // While AuthContext is bootstrapping stored tokens, render a neutral
  // background — Landing renders fine for anonymous users so we hand off
  // the moment status flips to 'anonymous'.
  if (status === 'booting') {
    return <div className="min-h-screen bg-surface font-sans" />;
  }

  return (
    <div className="font-sans">
      {screen === 'landing' && <Landing onStart={onStartFromLanding} />}

      {screen === 'auth' && (
        <Suspense fallback={<AuthSkeleton />}>
          <Auth
            mode={authMode}
            initRole={user?.role ?? null}
            onSwitchToRegister={() => setAuthMode('register')}
            onLoginSuccess={() => {
              setJustRegistered(false);
            }}
            onRegisterSuccess={() => {
              setJustRegistered(true);
            }}
            onBack={goBack}
          />
        </Suspense>
      )}

      {screen === 'onboarding' && user && (
        <Suspense fallback={<OnboardingSkeleton />}>
          <Onboarding
            role={user.role}
            onComplete={() => {
              setJustRegistered(false);
              navigate(user.role === 'buyer' ? 'buyer-dash' : 'seller-dash');
            }}
            onBack={goBack}
          />
        </Suspense>
      )}

      {screen === 'buyer-dash' && user && (
        <Suspense fallback={<BuyerDashSkeleton />}>
          <BuyerDash
            onLogout={handleLogout}
            onProfile={() => navigate('profile')}
          />
        </Suspense>
      )}

      {screen === 'seller-dash' && user && (
        <Suspense fallback={<SellerDashSkeleton />}>
          <SellerDash
            onLogout={handleLogout}
            onProfile={() => navigate('profile')}
            onRatings={() => navigate('ratings')}
          />
        </Suspense>
      )}

      {screen === 'profile' && user && (
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfilePage
            role={user.role}
            onBack={goBack}
            onLogout={handleLogout}
            onDeleteProfile={handleDeleteAccount}
          />
        </Suspense>
      )}

      {screen === 'ratings' && user && (
        <Suspense fallback={<RatingsSkeleton />}>
          <RatingsPage role={user.role} onBack={goBack} onLogout={handleLogout} />
        </Suspense>
      )}
    </div>
  );
}
