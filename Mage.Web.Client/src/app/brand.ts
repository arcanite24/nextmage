/**
 * Product name shown in the UI (see PRODUCT.md). It is a build setting: VITE_APP_NAME, "Playmat" when unset. The page
 * title in index.html reads the same variable.
 */
export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined)?.trim() || 'Playmat';

/** True in the packaged Android app (the `android` build mode, .env.android): its shell ships inside the app. */
export const NATIVE_APP = import.meta.env.VITE_NATIVE === '1';

/**
 * Where the site lives, for links people share (table invites, the deck bookmarklet). The page's own origin on the
 * web; the packaged app runs from https://localhost, so its build names the site (VITE_PUBLIC_ORIGIN).
 */
export const PUBLIC_ORIGIN = (import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined)?.trim().replace(/\/+$/, '')
  || (typeof window === 'undefined' ? '' : window.location.origin);
