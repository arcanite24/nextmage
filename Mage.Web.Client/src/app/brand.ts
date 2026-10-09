/**
 * Product name shown in the UI (see PRODUCT.md). It is a build setting: VITE_APP_NAME, "Playmat" when unset. The page
 * title in index.html reads the same variable.
 */
export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined)?.trim() || 'Playmat';
