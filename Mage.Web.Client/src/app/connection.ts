import { createApi } from '../protocol/generated/api';
import { RpcClient } from '../core/rpc/RpcClient';
import { EventBus } from '../core/rpc/EventBus';

/** One connection to the server for the whole app. */
export const rpc = new RpcClient();
export const events = new EventBus(rpc);
export const api = createApi(rpc);

export const DEFAULT_SERVER_URL = (() => {
  const configured = import.meta.env.VITE_MAGE_SERVER_URL as string | undefined;
  if (configured) return configured;
  if (typeof window === 'undefined' || !window.location.hostname) return 'ws://localhost:17172';
  // served over HTTPS (a deployment behind the proxy): the game connection shares the origin, at /ws
  if (window.location.protocol === 'https:') return `wss://${window.location.host}/ws`;
  return `ws://${window.location.hostname}:17172`;
})();
