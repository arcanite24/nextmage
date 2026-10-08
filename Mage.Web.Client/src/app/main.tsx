import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation, useNavigate } from 'react-router-dom';
import './styles/base.css';
import { installGlobalErrorHandlers } from '../core/telemetry/reporter';
import { AppShell } from './AppShell';
import { queryClient } from './queries';
import { DecksScreen } from './screens/DecksScreen';
import { EventsScreen } from './screens/EventsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RequestDialog } from './RequestDialog';
import { RouteError } from './screens/RouteError';
import { TablesScreen } from './screens/TablesScreen';
import { useEvents } from './stores/events';
import { useGames } from './stores/games';
import { usePlay } from './stores/play';
import { useSession } from './stores/session';
import './stores/settings';
import './stores/toasts';

/** Screens that need a signed-in player; also opens games when the server starts them. */
function SignedIn() {
  const phase = useSession((state) => state.phase);
  const navigate = useNavigate();
  const latestGameId = useGames((state) => state.latestGameId);
  const location = useLocation();

  useEffect(() => {
    if (!latestGameId) return;
    usePlay.setState({ phase: 'idle', tableId: null });
    navigate(`/game/${latestGameId}`);
  }, [latestGameId, navigate]);

  // drafts, deck building and tournaments move the player along as the server advances them
  const redirect = useEvents((state) => state.redirect);
  useEffect(() => {
    if (!redirect) return;
    useEvents.getState().clearRedirect();
    navigate(redirect);
  }, [redirect, navigate]);

  // come back here after signing in
  if (phase !== 'signedIn') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return (
    <>
      <Outlet />
      <RequestDialog />
    </>
  );
}

// uncaught errors and unhandled rejections are reported (to the console by default) and kept for debugging
installGlobalErrorHandlers();

const router = createBrowserRouter([
  { path: '/login', element: <LoginScreen /> },
  {
    element: <SignedIn />,
    errorElement: <RouteError />,
    children: [
      // the heavier screens load when first opened
      { path: '/game/:gameId', lazy: () => import('./screens/GameScreen').then((m) => ({ Component: m.GameScreen })) },
      { path: '/draft/:draftId', lazy: () => import('./events/DraftScreen').then((m) => ({ Component: m.DraftScreen })) },
      { path: '/build/:tableId', lazy: () => import('./events/BuildScreen').then((m) => ({ Component: m.BuildScreen })) },
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { path: '/', element: <HomeScreen /> },
          { path: '/decks', element: <DecksScreen /> },
          { path: '/decks/:deckId', lazy: () => import('./decks/DeckBuilderScreen').then((m) => ({ Component: m.DeckBuilderScreen })) },
          { path: '/events', element: <EventsScreen /> },
          { path: '/event/:tournamentId', lazy: () => import('./events/EventScreen').then((m) => ({ Component: m.EventScreen })) },
          { path: '/tables', element: <TablesScreen /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider delayDuration={300}>
        <RouterProvider router={router} />
      </Tooltip.Provider>
    </QueryClientProvider>
  </StrictMode>,
);
