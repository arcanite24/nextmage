import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { decodePayload } from '../../../core/deckImport/payload';
import { openImport } from '../../stores/importSheet';
import { notify } from '../../stores/toasts';

/**
 * /import?url=… opens the import sheet with a deck link; /import#deck=… with a deck the
 * "Send to Playmat" bookmarklet read from a deck page. The fragment never reaches a server,
 * and is dropped from the address as soon as it's read.
 */
export function ImportRoute() {
  const location = useLocation();

  useEffect(() => {
    const url = new URLSearchParams(location.search).get('url');
    const payload = location.hash.includes('deck=') ? decodePayload(location.hash) : null;
    if (payload) openImport({ kind: 'payload', payload });
    else if (url) openImport({ kind: 'text', text: url });
    else if (location.hash.includes('deck=')) notify('Couldn’t read that deck', 'The bookmark sent something that isn’t a deck list. Try copying the list instead.', 'error');
    else openImport();
    // forget the deck in the address, so a reload or a shared link doesn't import it again
    window.history.replaceState(window.history.state, '', '/decks');
  }, [location.search, location.hash]);

  return <Navigate to="/decks" replace />;
}
