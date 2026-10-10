import { useEffect, useRef } from 'react';
import { useCardImage } from '../../core/images/useCardImage';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { useCeremonies, type CeremonyMoment } from './ceremonies';
import { playCareerCue } from './careerSound';
import { Art as Painted } from './Art';
import { Crest } from './ModeArt';
import { useStill } from './motion';
import styles from './Ceremony.module.css';

export function CeremonyHost() {
  const moment = useCeremonies((state) => state.queue[0]);
  return moment ? <Ceremony key={moment.id} moment={moment} onDone={() => useCeremonies.getState().next()} /> : null;
}

function Art({ card }: { card: NonNullable<CeremonyMoment['card']> }) {
  const src = useCardImage(card, 'front', 'art_crop');
  return typeof src === 'string' ? <img className={styles.art} src={src} alt="" /> : <span className={styles.art} />;
}

export function Ceremony({ moment, onDone }: { moment: CeremonyMoment; onDone(): void }) {
  const t = useT();
  const still = useStill();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    playCareerCue(moment.cue ?? 'unlock');
    button.current?.focus();
  }, [moment.cue]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onDone]);

  return (
    <div className={[styles.scrim, still ? styles.still : ''].join(' ')} role="alertdialog" aria-modal="true" aria-labelledby="ceremony-title" aria-describedby={moment.text ? 'ceremony-text' : undefined} onClick={onDone}>
      <div className={styles.rays} aria-hidden="true" />
      <div className={styles.moment} onClick={(event) => event.stopPropagation()}>
        <div className={styles.frame}>
          {moment.card ? <Art card={moment.card} /> : moment.crest ? (
            moment.achievement
              ? <Painted kind="achievement" id={moment.achievement} size={160} fallback={<Crest name={moment.crest.name} colors={moment.crest.colors} size={160} />} />
              : <Crest name={moment.crest.name} colors={moment.crest.colors} size={160} />
          ) : null}
        </div>
        <p className={styles.kicker}>{moment.kicker}</p>
        <h2 id="ceremony-title" className={styles.title}>{moment.title}</h2>
        {moment.text && <p id="ceremony-text" className={styles.text}>{moment.text}</p>}
        <Button ref={button} variant="print" size="lg" onClick={onDone}>{t('career.ceremony.continue')}</Button>
      </div>
    </div>
  );
}
