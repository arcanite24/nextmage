import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React 19 warns unless the environment says act() is supported
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});

// components resolve card pictures through fetch: answer "not found" unless a test stubs it, so nothing hits
// the network and cards fall back to their text frames
if (!('__testFetch' in globalThis)) {
  Object.assign(globalThis, { __testFetch: true });
  globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
}
