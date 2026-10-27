'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function SessionGuard() {
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (active && response.status === 401) {
          const next = window.location.pathname + window.location.search;
          window.location.replace(`/login?reason=expired&next=${encodeURIComponent(next)}`);
        }
      } catch {
        // A temporary network failure is not evidence that the session expired.
      }
    }
    void checkSession();
    const onFocus = () => { void checkSession(); };
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void checkSession(); }, 60000);
    return () => { active = false; window.removeEventListener('focus', onFocus); window.clearInterval(interval); };
  }, [pathname]);

  return null;
}
