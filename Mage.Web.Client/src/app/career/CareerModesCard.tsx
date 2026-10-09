import { CalendarDays, Layers, Map as MapIcon, Puzzle, Shield, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT, type MessageKey } from '../i18n';
import { MODE_PATHS, type ModeKind } from './careerModesData';
import styles from './CareerModes.module.css';

const MODES: { kind: ModeKind; label: MessageKey; note: MessageKey; Icon: LucideIcon }[] = [
  { kind: 'campaign', label: 'career.modes.campaign', note: 'career.modes.campaignNote', Icon: MapIcon },
  { kind: 'puzzle', label: 'career.modes.puzzles', note: 'career.modes.puzzlesNote', Icon: Puzzle },
  { kind: 'gauntlet', label: 'career.modes.gauntlet', note: 'career.modes.gauntletNote', Icon: Shield },
  { kind: 'limited', label: 'career.modes.limited', note: 'career.modes.limitedNote', Icon: Layers },
  { kind: 'challenge', label: 'career.modes.challenge', note: 'career.modes.challengeNote', Icon: CalendarDays },
];

/** The Career home's way into the other modes: campaign, puzzles, gauntlet, sealed and draft, the weekly challenge. */
export function CareerModesCard() {
  const t = useT();
  return (
    <nav className={styles.modesCard} aria-labelledby="career-modes">
      <h2 id="career-modes" className={styles.cardLabel}>{t('career.modes')}</h2>
      <ul className={styles.modesList}>
        {MODES.map(({ kind, label, note, Icon }) => (
          <li key={kind}>
            <Link to={MODE_PATHS[kind]} className={styles.modeEntry}>
              <Icon size={20} aria-hidden="true" />
              <span>
                <b>{t(label)}</b>
                <small>{t(note)}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
