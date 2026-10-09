import { useEffect, useMemo, useRef } from 'react';
import { dueTip } from '../../core/game/lessons';
import type { InteractionMode } from '../../core/game/interaction';
import type { GameView } from '../../protocol/generated/views';
import { useT } from '../i18n';
import { lessonsFor, useCareerLessons } from '../stores/careerLessons';
import { useGames } from '../stores/games';
import { Button } from '../ui/Button';
import styles from './Coach.module.css';

/**
 * A school duel's coaching: each of the duel's tips shows once a game, when its moment comes, beside the controls and
 * never over the choice. Answering anything while it shows counts as reading it.
 */
export function LessonCoach({ gameId, view, mode, awaiting, gameOver }: {
  gameId: string;
  view: GameView | null;
  mode: InteractionMode;
  awaiting: boolean;
  gameOver: boolean;
}) {
  const t = useT();
  const tableId = useGames((games) => games.tables[gameId]?.tableId);
  const plan = lessonsFor(useCareerLessons((state) => state.plan), tableId);
  const quiet = useCareerLessons((state) => state.quiet);
  const shown = useCareerLessons((state) => state.shown);
  const markShown = useCareerLessons((state) => state.markShown);
  const hush = useCareerLessons((state) => state.hush);
  const seen = useMemo(() => new Set(shown.gameId === gameId ? shown.tips : []), [shown, gameId]);
  const index = plan && !quiet && !gameOver ? dueTip(plan.tips, { view, mode, awaiting }, seen) : null;
  // a tip the player acted on has done its job
  const showing = useRef<number | null>(null);
  useEffect(() => {
    if (index !== null) showing.current = index;
    else if (awaiting && showing.current !== null) {
      markShown(gameId, showing.current);
      showing.current = null;
    }
  }, [index, awaiting, gameId, markShown]);

  const tip = index === null ? null : plan?.tips[index];
  if (!tip || index === null) return null;
  return (
    <aside className={styles.coach} aria-live="polite" aria-label={t('match.lesson.tip')}>
      <p className={styles.kicker}>{t('match.lesson.kicker')}</p>
      <h2 className={styles.title}>{tip.title}</h2>
      <p className={styles.text}>{tip.text}</p>
      <div className={styles.actions}>
        <Button variant="quiet" size="sm" onClick={hush}>{t('match.lesson.quiet')}</Button>
        <Button variant="print" size="sm" onClick={() => markShown(gameId, index)}>{t('match.lesson.gotIt')}</Button>
      </div>
    </aside>
  );
}
