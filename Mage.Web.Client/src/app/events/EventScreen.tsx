import { useQuery } from '@tanstack/react-query';
import { Eye, Hammer, LogOut, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { TournamentPlayerView } from '../../protocol/generated/views';
import { api } from '../connection';
import { useEvents } from '../stores/events';
import { useSession } from '../stores/session';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Zone } from '../ui/Zone';
import styles from './Event.module.css';

const STATE_TEXT: Record<string, string> = {
  JOINED: 'Joined',
  WAITING: 'Waiting',
  DRAFTING: 'Drafting',
  CONSTRUCTING: 'Building',
  DUELING: 'Playing',
  SIDEBOARDING: 'Sideboarding',
  FINISHED: 'Finished',
  ELIMINATED: 'Eliminated',
  CANCELED: 'Left',
};

/** One event: where it stands, the standings and every round's pairings. */
export function EventScreen() {
  const { tournamentId = '' } = useParams();
  const navigate = useNavigate();
  const live = useEvents((state) => state.tournaments[tournamentId]);
  const construct = useEvents((state) => state.construct);
  const userName = useSession((state) => state.userName);
  const [quitting, setQuitting] = useState(false);
  // pushed updates arrive while joined; polling covers a reload or a spectator
  const polled = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => api.tournamentFindById(tournamentId),
    refetchInterval: 5_000,
  });
  const view = polled.data ?? live?.view ?? null;

  if (!view) {
    return (
      <Zone label="Event" className={styles.page}>
        <p className={styles.note}>{polled.isPending ? 'Loading the event…' : "This event isn't running on the server any more."}</p>
        <Button variant="print" onClick={() => navigate('/events')}>All events</Button>
      </Zone>
    );
  }

  const players = [...(view.players ?? [])].sort(byStanding);
  const me = players.find((player) => player.name === userName);
  const finished = view.tournamentState === 'FINISHED' || live?.over;
  const rounds = view.rounds ?? [];
  const buildPending = construct && !construct.submitted && (!live?.tableId || construct.parentTableId === live.tableId || construct.tableId === live.tableId);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{view.tournamentName}</h1>
          <p className={styles.state}>
            {[view.tournamentType, finished ? 'Event complete' : view.runningInfo || stateLine(view.tournamentState)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className={styles.headActions}>
          {buildPending && (
            <Link to={`/build/${construct!.tableId}`} className={styles.due}>
              <Hammer size={16} aria-hidden="true" /> Your deck is due — build it now
            </Link>
          )}
          {me && !finished && !me.quit && (
            <Button variant="quiet" size="sm" icon={<LogOut size={16} />} onClick={() => setQuitting(true)}>Leave event</Button>
          )}
        </div>
      </header>

      {finished && players[0] && (players[0].points ?? 0) > (players[1]?.points ?? -1) && (
        <div className={styles.winner}>
          <Trophy size={28} aria-hidden="true" />
          <p><strong>{players[0].name}</strong> wins the event</p>
        </div>
      )}

      <div className={styles.body}>
        <Zone label="Standings" className={styles.standings}>
          <table className={styles.table}>
            <thead>
              <tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Points</th><th scope="col">Results</th><th scope="col">Now</th></tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.name} className={player.name === userName ? styles.meRow : undefined}>
                  <td>{index + 1}</td>
                  <td className={styles.player}>{player.name}{player.quit && !finished ? ' (left)' : ''}</td>
                  <td className={styles.points}>{player.points ?? 0}</td>
                  <td className={styles.results}>{player.results || '—'}</td>
                  <td className={styles.now}>{STATE_TEXT[player.state ?? ''] ?? player.state ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Zone>

        <Zone label="Rounds" className={styles.rounds}>
          {rounds.length === 0 ? (
            <p className={styles.note}>Pairings appear when the first round starts.</p>
          ) : (
            [...rounds].reverse().map((round, reversedIndex) => {
              const number = rounds.length - reversedIndex;
              return (
                <section key={number} className={styles.round}>
                  <h3 className={styles.roundHead}>Round {number}</h3>
                  <ul>
                    {(round.games ?? []).map((game, index) => {
                      const mine = !!userName && (game.players ?? '').includes(userName);
                      const running = game.state && !/finished|done/i.test(game.state) && !game.result;
                      return (
                        <li key={game.matchId ?? index} className={[styles.pairing, mine ? styles.minePairing : ''].join(' ')}>
                          <span className={styles.pairingPlayers}>{game.players}</span>
                          <span className={styles.pairingResult}>{game.result || game.state}</span>
                          {running && !mine && game.gameId && (
                            <Button variant="quiet" size="sm" icon={<Eye size={15} />} onClick={() => api.gameWatchStart(game.gameId!).catch(() => undefined)}>Watch</Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </Zone>
      </div>

      <Dialog
        open={quitting}
        onOpenChange={setQuitting}
        title="Leave this event?"
        description="You'll drop from the standings and can't rejoin."
        width="sm"
        footer={(
          <>
            <Button variant="quiet" onClick={() => setQuitting(false)}>Stay</Button>
            <Button
              variant="danger"
              onClick={() => {
                api.tournamentQuit(tournamentId).catch(() => undefined);
                setQuitting(false);
                navigate('/events');
              }}
            >
              Leave event
            </Button>
          </>
        )}
      >
        {null}
      </Dialog>
    </div>
  );
}

function byStanding(a: TournamentPlayerView, b: TournamentPlayerView): number {
  return (b.points ?? 0) - (a.points ?? 0) || (a.name ?? '').localeCompare(b.name ?? '');
}

function stateLine(state: string | undefined): string {
  switch (state) {
    case 'DRAFTING': return 'Drafting';
    case 'CONSTRUCTING': return 'Building decks';
    case 'DUELING': return 'Round in progress';
    case 'SIDEBOARDING': return 'Sideboarding';
    default: return state ? state.charAt(0) + state.slice(1).toLowerCase() : '';
  }
}
