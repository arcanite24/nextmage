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
import { TablesScreen } from './screens/TablesScreen';
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

  // come back here after signing in
  if (phase !== 'signedIn') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginScreen /> },
  {
    element: <SignedIn />,
    children: [
      { path: '/game/:gameId', element: <GameScreen /> },
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <HomeScreen /> },
          { path: '/decks', element: <DecksScreen /> },
          { path: '/decks/:deckId', element: <DeckBuilderScreen /> },
          { path: '/events', element: <EventsScreen /> },
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
