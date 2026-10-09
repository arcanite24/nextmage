import { QueryClient, useQuery } from '@tanstack/react-query';
import { api } from './connection';
import { useSession } from './stores/session';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 2_000,
    },
  },
});

/** Game types, formats, tournament types and AI player types offered by this server. */
export function useServerState() {
  const signedIn = useSession((state) => state.phase === 'signedIn');
  return useQuery({
    queryKey: ['serverState'],
    queryFn: () => api.getServerState(),
    enabled: signedIn,
    staleTime: Infinity,
  });
}

/** Open and running tables of the main room, refreshed while shown. */
export function useTables() {
  const roomId = useSession((state) => state.roomId);
  const connected = useSession((state) => state.connection === 'open');
  return useQuery({
    queryKey: ['tables', roomId],
    queryFn: () => api.roomGetAllTables(roomId!),
    enabled: !!roomId && connected,
    refetchInterval: connected ? 4_000 : false,
  });
}

/** What this server offers (accounts, deck sync, Career); asked once. */
export function useServerInfo() {
  const signedIn = useSession((state) => state.phase === 'signedIn');
  return useQuery({
    queryKey: ['serverInfo'],
    queryFn: () => api.serverInfo().catch(() => null),
    enabled: signedIn,
    staleTime: Infinity,
  });
}
