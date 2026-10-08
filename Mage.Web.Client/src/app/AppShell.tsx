import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Settings, UserRound, WifiOff } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { APP_NAME } from './brand';
import { SettingsDialog } from './screens/SettingsDialog';
import { useImportSheet } from './stores/importSheet';
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
];

// the import sheet loads the first time it opens, then stays mounted so it can animate out
const ImportSheet = lazy(() => import('./decks/import/ImportSheet').then((module) => ({ default: module.ImportSheet })));

function ImportSheetHost() {
  const opened = useImportSheet((state) => state.session > 0);
  return opened ? <Suspense fallback={null}><ImportSheet /></Suspense> : null;
}

/** The mat every screen outside a match is printed on. */
export function AppShell() {
  const userName = useSession((state) => state.userName);
  const connection = useSession((state) => state.connection);
  const signOut = useSession((state) => state.signOut);
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
          <IconButton label="Settings" icon={<Settings size={18} />} onClick={() => setSettingsOpen(true)} />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className={styles.user} aria-label={`Account: ${userName}`}>
              <UserRound size={16} aria-hidden="true" />
              <span>{userName}</span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={styles.menu} align="end" sideOffset={8}>
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => setSettingsOpen(true)}>
                  <Settings size={16} aria-hidden="true" /> Settings
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
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ImportSheetHost />
      <Toaster />
    </div>
  );
}
