'use client';

import { useEffect, useRef } from 'react';

type Table = 'skin_assessments' | 'profiles' | 'skincare_routines' | 'routine_steps';

export function useLiveData(refresh: () => void | Promise<void>, tables: readonly Table[]) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const tableKey = tables.join(',');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { if (document.visibilityState === 'visible') void latest.current(); }, 250);
    };
    const source = new EventSource('/api/live');
    const handleChange = (event: Event) => {
      try {
        const { table } = JSON.parse((event as MessageEvent).data);
        if (tableKey.split(',').includes(table)) schedule();
      } catch { /* A malformed notice should not interrupt later updates. */ }
    };
    source.addEventListener('change', handleChange);
    const onFocus = () => { if (document.visibilityState === 'visible') schedule(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const fallback = setInterval(onFocus, 30000);
    return () => {
      if (timer) clearTimeout(timer);
      source.removeEventListener('change', handleChange);
      source.close();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(fallback);
    };
  }, [tableKey]);
}
