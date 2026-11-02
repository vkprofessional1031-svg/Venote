declare global {
  interface Window {
    electron?: unknown;
    venoteDesktop?: {
      platform?: string;
    };
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

/**
 * Server-side check using a User-Agent header value.
 * UX shortcut only — never trust for authentication or authorization.
 */
export function isDesktopUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /Electron\/|VenoteDesktop/i.test(userAgent);
}

/**
 * Server-side check using request headers.
 * UX shortcut only — never trust for authentication or authorization.
 */
export function isDesktopRequest(headers: Pick<Headers, 'get'>): boolean {
  return isDesktopUserAgent(headers.get('user-agent'));
}

/**
 * Client-side check for the desktop wrapper (Electron, Tauri, or VenoteDesktop).
 * UX shortcut only — never trust for authentication or authorization.
 */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;

  if (
    Boolean(window.electron) ||
    Boolean(window.venoteDesktop) ||
    Boolean(window.__TAURI__) ||
    Boolean(window.__TAURI_INTERNALS__)
  ) {
    return true;
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /Electron|VenoteDesktop/i.test(ua);
}

/**
 * Client-side check for macOS desktop app (used for extra titlebar spacing).
 */
export function isMacDesktopApp(): boolean {
  if (!isDesktopApp()) return false;

  const preloadPlatform = window.venoteDesktop?.platform?.toLowerCase();
  if (preloadPlatform) {
    return preloadPlatform === 'darwin' || preloadPlatform.includes('mac');
  }

  const platform = typeof navigator !== 'undefined' ? navigator.platform.toLowerCase() : '';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  return platform.includes('mac') || ua.includes('mac');
}

