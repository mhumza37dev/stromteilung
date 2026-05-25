import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../contexts/AuthContext';

/**
 * Read the current user + auth actions from anywhere in the tree.
 *
 * ```tsx
 * const { user, status, logout } = useAuth();
 * if (status === 'booting') return <SplashSkeleton />;
 * if (status === 'anonymous') return <Redirect to="landing" />;
 * return <Dashboard user={user!} />;
 * ```
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
