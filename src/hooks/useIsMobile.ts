import { useEffect, useState } from 'react';

/**
 * Reports whether the viewport is below `breakpoint` pixels wide.
 *
 * SSR-safe: assumes desktop on the server (where `window` is undefined) so
 * markup hydrates cleanly, then re-checks on mount.
 *
 * @param breakpoint - pixel width below which we consider the screen "mobile" (default 768).
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    // Re-check immediately in case the initial state was the SSR default.
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);

  return isMobile;
}
