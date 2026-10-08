import { ArrowLeft, ArrowRight, LogOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isEditableEventTarget } from '../ui/keys';
import { api } from '../connection';
import { useCardInfo } from '../decks/cardInfo';
import { useEvents } from '../stores/events';
import { useSession } from '../stores/session';
import { Button } from '../ui/Button';
import { CardFace } from '../ui/CardFace';
import { Dialog } from '../ui/Dialog';
import { curveColumns, faceOf, poolEntry, type PoolCard } from './pool';
import styles from './Draft.module.css';

const NONE: PoolCard[] = [];

/** A booster draft: the pack in front of you, your picks below, the table around. */
export function DraftScreen() {
  const { draftId = '' } = useParams();
  const navigate = useNavigate();
  const draft = useEvents((state) => state.drafts[draftId]);
  const pick = useEvents((state) => state.pick);
  const mark = useEvents((state) => state.mark);
  const userName = useSession((state) => state.userName);
  const [selected, setSelected] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const booster = (draft?.booster ?? NONE) as PoolCard[];
  const picks = (draft?.picks ?? NONE) as PoolCard[];
  const entries = useMemo(() => [...booster, ...picks].map(poolEntry), [booster, picks]);
  const info = useCardInfo(entries);
  const columns = useMemo(() => curveColumns(picks, info), [picks, info]);

  const view = draft?.view;
  const packNumber = view?.boosterNum ?? 1;
  const pickNumber = view?.cardNum ?? picks.length + 1;
  const passLeft = packNumber % 2 === 1;
  const setName = view?.setNames?.[Math.max(0, packNumber - 1)] ?? view?.setCodes?.[Math.max(0, packNumber - 1)] ?? '';

  // a new pack clears the choice
  const boosterKey = booster.map((card) => card.id).join(',');
  const [shownKey, setShownKey] = useState(boosterKey);
  if (shownKey !== boosterKey) {
    setShownKey(boosterKey);
    setSelected(null);
  }

  const confirm = (cardId: string | null) => {
    if (cardId && draft?.picking) void pick(draftId, cardId);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) return;
      if ((event.code === 'Space' || event.key === 'Enter') && selected) {
        event.preventDefault();
        confirm(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!draft) {
    return (
      <div className={styles.screen}>
        <div className={styles.center}>
          <h1 className={styles.title}>No draft here</h1>
          <p className={styles.sub}>This draft isn't open in this tab.</p>
          <Button variant="print" onClick={() => navigate('/events')}>Back to events</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <div className={styles.where}>
          <span className={styles.set}>{setName}</span>
          <h1 className={styles.title}>Pack {packNumber} <span>· Pick {pickNumber}</span></h1>
        </div>
        <Seats players={view?.players ?? []} me={userName} passLeft={passLeft} />
        <div className={styles.topRight}>
          {draft.picking && draft.deadline && <PickClock deadline={draft.deadline} />}
          <Button variant="quiet" size="sm" icon={<LogOut size={16} />} onClick={() => setLeaving(true)}>Leave</Button>
        </div>
      </header>

      <main className={styles.pack} aria-label="Booster">
        {draft.over ? (
          <div className={styles.center}>
            <h2 className={styles.title}>Draft complete</h2>
            <p className={styles.sub}>{picks.length} cards drafted. Deck building opens in a moment.</p>
          </div>
        ) : !draft.picking ? (
          <div className={styles.center}>
            <h2 className={styles.waitTitle}>Waiting for the next pack</h2>
            <p className={styles.sub}>The others are still picking.</p>
          </div>
        ) : (
          <div className={styles.booster} role="listbox" aria-label={`Pick a card, ${booster.length} left in the pack`}>
            {booster.map((card, index) => {
              const id = card.id!;
              const isSelected = selected === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-label={card.name}
                  className={[styles.card, isSelected ? styles.cardSelected : ''].join(' ')}
                  style={{ animationDelay: `${index * 25}ms` }}
                  onClick={() => {
                    setSelected(id);
                    mark(draftId, id);
                  }}
                  onDoubleClick={() => confirm(id)}
                >
                  <CardFace card={faceOf(card, info)} size="normal" />
                </button>
              );
            })}
          </div>
        )}
        {draft.picking && (
          <div className={styles.action}>
            <p className={styles.hint}>{selected ? 'Double-click or press Space to pick' : 'Choose a card'}</p>
            <Button variant="decision" size="xl" disabled={!selected} onClick={() => confirm(selected)}>Pick</Button>
          </div>
        )}
      </main>

      <section className={styles.picks} aria-label={`Your picks, ${picks.length} cards`}>
        <h2 className={styles.picksLabel}>Your picks <span>{picks.length}</span></h2>
        <div className={styles.columns}>
          {columns.map((column) => (
            <div key={column.label} className={styles.column}>
              <span className={styles.columnLabel}>{column.label}</span>
              <div className={styles.columnCards} style={{ height: 150 + (column.cards.length - 1) * 26 }}>
                {column.cards.map((card, index) => (
                  <div key={card.id} className={styles.picked} style={{ top: index * 26, zIndex: index }}>
                    <CardFace card={faceOf(card, info)} size="small" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Dialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Leave the draft?"
        description="You can't come back to this draft, and you'll leave the event."
        width="sm"
        footer={(
          <>
            <Button variant="quiet" onClick={() => setLeaving(false)}>Keep drafting</Button>
            <Button
              variant="danger"
              onClick={() => {
                api.draftQuit(draftId).catch(() => undefined);
                navigate('/events');
              }}
            >
              Leave
            </Button>
          </>
        )}
      >
        {null}
      </Dialog>
    </div>
  );
}

/** Who sits where, and which way the packs go this round. */
function Seats({ players, me, passLeft }: { players: string[]; me: string; passLeft: boolean }) {
  if (players.length === 0) return null;
  return (
    <ol className={styles.seats} aria-label={`Players, packs pass ${passLeft ? 'left' : 'right'}`}>
      <li className={styles.direction} aria-hidden="true">{passLeft ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}</li>
      {players.map((name, index) => (
        <li key={`${name}-${index}`} className={[styles.seat, name === me ? styles.seatMe : ''].join(' ')} title={name}>
          {name.slice(0, 1).toUpperCase()}
        </li>
      ))}
    </ol>
  );
}

/** Time left for this pick, as a ring that empties. */
function PickClock({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  const [total] = useState(() => Math.max(1, deadline - Date.now()));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, deadline - now);
  const seconds = Math.ceil(left / 1000);
  return (
    <div className={[styles.clock, seconds <= 10 ? styles.clockLow : ''].join(' ')} role="timer" aria-label={`${seconds} seconds left to pick`}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="19" className={styles.clockTrack} />
        <circle cx="22" cy="22" r="19" className={styles.clockFill} pathLength={100} strokeDasharray={`${(left / total) * 100} 100`} />
      </svg>
      <span>{seconds}</span>
    </div>
  );
}
