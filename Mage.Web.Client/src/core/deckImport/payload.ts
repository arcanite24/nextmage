/**
 * The "Send to Playmat" bookmarklet hands a deck to the app in the URL fragment (#deck=…), which browsers
 * never send to any server. The payload is base64url JSON: the site, the deck page and the list as text.
 */

export interface DeckPayload {
  site: string;
  url: string;
  text: string;
  name?: string;
}

export const MAX_PAYLOAD_BYTES = 200 * 1024;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodePayload(payload: DeckPayload): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

/** Reads "#deck=…" (or just the encoded part); null when it's missing, too large or not a deck. */
export function decodePayload(fragment: string): DeckPayload | null {
  const match = /(?:^#?|&)deck=([A-Za-z0-9_-]+)/.exec(fragment);
  const encoded = match ? match[1] : /^[A-Za-z0-9_-]+$/.test(fragment) ? fragment : null;
  if (!encoded || encoded.length > Math.ceil((MAX_PAYLOAD_BYTES * 4) / 3) + 4) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as Partial<DeckPayload>;
    if (typeof value.text !== 'string' || !value.text.trim() || typeof value.site !== 'string' || typeof value.url !== 'string') return null;
    return {
      site: value.site,
      url: value.url,
      text: value.text,
      name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : undefined,
    };
  } catch {
    return null;
  }
}
