import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation, useNavigate } from 'react-router-dom';
import './styles/base.css';
import { AppShell } from './AppShell';
import { queryClient } from './queries';
import { DecksScreen } from './screens/DecksScreen';
import { DeckBuilderScreen } from './decks/DeckBuilderScreen';
import { EventsScreen } from './screens/EventsScreen';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RouteError } from './screens/RouteError';
import { TablesScreen } from './screens/TablesScreen';
import { DraftScreen } from './events/DraftScreen';
import { BuildScreen } from './events/BuildScreen';
import { EventScreen } from './events/EventScreen';
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
  return <Outlet />;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginScreen /> },
  {
    element: <SignedIn />,
    errorElement: <RouteError />,
    children: [
      { path: '/game/:gameId', element: <GameScreen /> },
      { path: '/draft/:draftId', element: <DraftScreen /> },
      { path: '/build/:tableId', element: <BuildScreen /> },
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { path: '/', element: <HomeScreen /> },
          { path: '/decks', element: <DecksScreen /> },
          { path: '/decks/:deckId', element: <DeckBuilderScreen /> },
          { path: '/events', element: <EventsScreen /> },
          { path: '/event/:tournamentId', element: <EventScreen /> },
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
