import { QueryClient, useQuery } from '@tanstack/react-query';
import type { TableView } from '../protocol/generated/views';
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

/** The server rebuilds its table list every 2 seconds: a table asked for sooner after a change may not show it yet. */
export const TABLE_LIST_PERIOD_MS = 2_000;

/** A table of ours that is still filling: its host waits on a guest to sit down, and its Start on that. */
export function fillingTableOf(tables: readonly TableView[] | undefined, userName: string): boolean {
  return !!tables?.some((table) => (table.tableState === 'WAITING' || table.tableState === 'READY_TO_START')
    && table.seats?.some((seat) => seat.playerName === userName));
}

/**
 * Open and running tables of the main room, refreshed while shown. While one of ours fills it refreshes twice as
 * often, in a background tab too, so the host's Start is ready as soon as the guest sits.
 */
export function useTables() {
  const roomId = useSession((state) => state.roomId);
  const userName = useSession((state) => state.userName);
  const connected = useSession((state) => state.connection === 'open');
  // read at render: the query re-renders this hook whenever its data changes
  const filling = fillingTableOf(queryClient.getQueryData<TableView[]>(['tables', roomId]), userName);
  return useQuery({
    queryKey: ['tables', roomId],
    queryFn: () => api.roomGetAllTables(roomId!),
    enabled: !!roomId && connected,
    refetchInterval: !connected ? false : filling ? TABLE_LIST_PERIOD_MS : 4_000,
    refetchIntervalInBackground: filling,
  });
}

/** After changing tables: ask now, and again once the server's list has caught up with the change. */
export function refreshTables(): void {
  void queryClient.invalidateQueries({ queryKey: ['tables'] });
  setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['tables'] }), TABLE_LIST_PERIOD_MS + 500);
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
