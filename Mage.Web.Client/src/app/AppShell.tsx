import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { IdCard, Info, LogOut, Settings, WifiOff } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { APP_NAME } from './brand';
import { SettingsDialog } from './screens/SettingsDialog';
import { Avatar } from './social/Avatar';
import { LobbyButton } from './social/LobbyButton';
import { useImportSheet } from './stores/importSheet';
import { useLobby } from './stores/lobby';
import { useSettings } from './stores/settings';
import { useSession } from './stores/session';
import { Toaster } from './ui/Toaster';
import { IconButton } from './ui/Button';
import { Mark } from './ui/Mark';
import { Stitch } from './ui/Stitch';
import styles from './AppShell.module.css';

const NAV = [
  { to: '/', label: 'Play', end: true },
  { to: '/decks', label: 'Decks' },
  { to: '/events', label: 'Events' },
  { to: '/tables', label: 'Tables' },
  { to: '/history', label: 'History' },
];

// the import sheet loads the first time it opens, then stays mounted so it can animate out
const ImportSheet = lazy(() => import('./decks/import/ImportSheet').then((module) => ({ default: module.ImportSheet })));

// the lobby drawer and profiles load the first time they open
const LobbyDrawer = lazy(() => import('./social/LobbyDrawer').then((module) => ({ default: module.LobbyDrawer })));
const ProfileDialog = lazy(() => import('./social/ProfileDialog').then((module) => ({ default: module.ProfileDialog })));
const ReportDialog = lazy(() => import('./social/ReportDialog').then((module) => ({ default: module.ReportDialog })));

function SocialHost() {
  const lobbyOpened = useLobby((state) => state.open || state.profile !== null);
  const [loaded, setLoaded] = useState(false);
  if (lobbyOpened && !loaded) setLoaded(true);
  return loaded ? <Suspense fallback={null}><LobbyDrawer /><ProfileDialog /><ReportDialog /></Suspense> : null;
}

function ImportSheetHost() {
  const opened = useImportSheet((state) => state.session > 0);
  return opened ? <Suspense fallback={null}><ImportSheet /></Suspense> : null;
}

/** The mat every screen outside a match is printed on. */
export function AppShell() {
  const userName = useSession((state) => state.userName);
  const connection = useSession((state) => state.connection);
  const signOut = useSession((state) => state.signOut);
  const avatarId = useSettings((state) => state.settings.avatarId);
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={styles.mat}>
      <Stitch />
      <header className={styles.rail}>
        <NavLink to="/" className={styles.brand} aria-label={`${APP_NAME} home`}>
          <Mark />
          <span>{APP_NAME}</span>
        </NavLink>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => [styles.navItem, isActive ? styles.active : ''].join(' ')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.tools}>
          {connection !== 'open' && (
            <span className={styles.offline} role="status">
              <WifiOff size={16} aria-hidden="true" />
              {connection === 'reconnecting' ? 'Reconnecting…' : 'Offline'}
            </span>
          )}
          <LobbyButton />
          <IconButton label="Settings" icon={<Settings size={18} />} onClick={() => setSettingsOpen(true)} />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className={styles.user} aria-label={`Account: ${userName}`}>
              <Avatar name={userName} avatarId={avatarId} size="sm" />
              <span>{userName}</span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={styles.menu} align="end" sideOffset={8}>
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => useLobby.getState().openProfile(userName)}>
                  <IdCard size={16} aria-hidden="true" /> Profile
                </DropdownMenu.Item>
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => setSettingsOpen(true)}>
                  <Settings size={16} aria-hidden="true" /> Settings
                </DropdownMenu.Item>
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => navigate('/about')}>
                  <Info size={16} aria-hidden="true" /> About and credits
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={styles.menuRule} />
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => void signOut(false)}>
                  <LogOut size={16} aria-hidden="true" /> Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <SocialHost />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ImportSheetHost />
      <Toaster />
    </div>
  );
}
