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
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `ws://${host}:17172`;
})();
