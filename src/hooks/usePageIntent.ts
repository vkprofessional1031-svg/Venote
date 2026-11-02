'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// URL-based UI intents also work when Next reuses the current page component.
export function usePageIntent(path: string) {
  const router = useRouter();
  const [intent, setIntent] = useState<URL | null>(null);
  const pending = useRef<URL | null>(null);
  useEffect(() => {
    const receive = (href: string) => {
      const url = new URL(href, window.location.origin);
      if (url.pathname !== path) return;
      pending.current = url;
      setIntent(url);
    };
    receive(window.location.href);
    const navigate = (event: Event) => receive((event as CustomEvent<string>).detail);
    const pop = () => receive(window.location.href);
    window.addEventListener('venote:navigate', navigate);
    window.addEventListener('popstate', pop);
    return () => { window.removeEventListener('venote:navigate', navigate); window.removeEventListener('popstate', pop); };
  }, [path]);
  const consume = useCallback((keys: string[]) => {
    if (!intent || pending.current !== intent) return false;
    pending.current = null;
    setIntent(null);
    const url = new URL(intent);
    keys.forEach(key => url.searchParams.delete(key));
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    return true;
  }, [intent, router]);
  return { intent, consume };
}
