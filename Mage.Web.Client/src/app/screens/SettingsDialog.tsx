import * as Tabs from '@radix-ui/react-tabs';
import { BookmarkPlus } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import bookmarkletSource from '../decks/import/bookmarklet.source.js?raw';
import type { SkipPrioritySteps } from '../../protocol/generated/views';
import { resetCommand, type AutoRule, type AutoRuleKind } from '../../core/game/autoAnswer';
import { notificationsSupported, requestNotifications } from '../stores/attention';
import { useAutoAnswers } from '../stores/autoAnswers';
import { useGames } from '../stores/games';
import { DEFAULT_SETTINGS, FULL_CONTROL, STREAMLINED, useSettings, type PlaySettings } from '../stores/settings';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import styles from './SettingsDialog.module.css';

const STEPS: { key: keyof SkipPrioritySteps; label: string }[] = [
  { key: 'upkeep', label: 'Upkeep' },
  { key: 'draw', label: 'Draw' },
  { key: 'main1', label: 'First main' },
  { key: 'beforeCombat', label: 'Beginning of combat' },
  { key: 'endOfCombat', label: 'End of combat' },
  { key: 'main2', label: 'Second main' },
  { key: 'endOfTurn', label: 'End step' },
];

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const settings = useSettings((state) => state.settings);
  const update = useSettings((state) => state.update);

  const toggle = (key: keyof PlaySettings) => (
    <Switch checked={!!settings[key]} onChange={(value) => update({ [key]: value } as Partial<PlaySettings>)} />
  );

  function setStop(turn: 'yourTurn' | 'opponentTurn', step: keyof SkipPrioritySteps, value: boolean) {
    update({ stops: { ...settings.stops, [turn]: { ...settings.stops[turn], [step]: value } } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Settings" width="lg"
      footer={<Button variant="quiet" onClick={() => update({ ...DEFAULT_SETTINGS, avatarId: settings.avatarId, flag: settings.flag })}>Restore defaults</Button>}>
      <Tabs.Root defaultValue="play" className={styles.tabs} orientation="vertical">
        <Tabs.List className={styles.list} aria-label="Settings sections">
          <Tabs.Trigger value="play" className={styles.trigger}>Gameplay</Tabs.Trigger>
          <Tabs.Trigger value="stops" className={styles.trigger}>Stops</Tabs.Trigger>
          <Tabs.Trigger value="answers" className={styles.trigger}>Auto answers</Tabs.Trigger>
          <Tabs.Trigger value="display" className={styles.trigger}>Motion</Tabs.Trigger>
          <Tabs.Trigger value="sound" className={styles.trigger}>Sound</Tabs.Trigger>
          <Tabs.Trigger value="alerts" className={styles.trigger}>Alerts</Tabs.Trigger>
          <Tabs.Trigger value="import" className={styles.trigger}>Import</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="play" className={styles.panel}>
          <div className={styles.style}>
            <span className={styles.styleLabel}>Play style</span>
            <div className={styles.styleChoices} role="radiogroup" aria-label="Play style">
              {([['Streamlined', STREAMLINED, 'The game moves on whenever you have nothing to decide, like Arena.'], ['Full control', FULL_CONTROL, 'Every stop and every choice is yours, like classic XMage.']] as const).map(([label, preset, detail]) => {
                const active = Object.entries(preset).every(([key, value]) => settings[key as keyof PlaySettings] === value);
                return (
                  <button key={label} type="button" role="radio" aria-checked={active} className={active ? styles.styleOn : styles.styleChoice} onClick={() => update(preset)}>
                    <strong>{label}</strong>
                    <span>{detail}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Row label="Pass when I have nothing to do" detail="Resolves spells and moves through steps when you have nothing to cast, play or activate. Lands that only make mana don't count.">{toggle('autoPass')}</Row>
          <Row label="Stop for my permanents' abilities on the opponent's turn" detail="With this off, only instants and flash spells stop you during their turn.">{toggle('abilitiesOnTheirTurn')}</Row>
          <Row label="Skip attacks and blocks when nothing can" detail="Answers for you when no creature can attack or block, and lets the rest of combat go by when nobody attacks.">{toggle('autoSkipCombat')}</Row>
          <Row label="Resolve my spells right away" detail="After you cast a spell or activate an ability, it resolves unless the opponent responds. Turn off to keep priority and respond to your own spells.">{toggle('passAfterCasting')}</Row>
          <Row label="Pay mana automatically" detail="Taps the right lands when the payment is clear.">{toggle('autoPayMana')}</Row>
          <Row label="Only with spare mana" detail="Auto-pay never uses mana a card could need later this turn.">{toggle('autoPayRestricted')}</Row>
          <Row label="Warn before losing mana" detail="Ask before passing with mana left in your pool.">{toggle('confirmEmptyManaPool')}</Row>
          <Row label="Order triggers for me" detail="Orders simultaneous triggers when the order doesn't matter.">{toggle('autoOrderTriggers')}</Row>
          <Row label="Pick obvious targets" detail="Chooses the target when only one is legal.">
            <Switch checked={settings.autoTargetLevel > 0} onChange={(value) => update({ autoTargetLevel: value ? 1 : 0 })} />
          </Row>
          <Row label="Opponents may ask to see my hand" detail="You still approve every request.">{toggle('allowHandRequests')}</Row>
        </Tabs.Content>

        <Tabs.Content value="stops" className={styles.panel}>
          <p className={styles.intro}>The game gives you priority at these steps. Elsewhere it passes for you unless something happens.</p>
          <table className={styles.stops}>
            <thead>
              <tr><th scope="col">Step</th><th scope="col">Your turn</th><th scope="col">Opponent's turn</th></tr>
            </thead>
            <tbody>
              {STEPS.map((step) => (
                <tr key={step.key}>
                  <th scope="row">{step.label}</th>
                  <td><Switch label={`${step.label}, your turn`} checked={!!settings.stops.yourTurn?.[step.key]} onChange={(value) => setStop('yourTurn', step.key, value)} /></td>
                  <td><Switch label={`${step.label}, opponent's turn`} checked={!!settings.stops.opponentTurn?.[step.key]} onChange={(value) => setStop('opponentTurn', step.key, value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Row label="Stop when attackers can be declared">
            <Switch checked={!!settings.stops.stopOnDeclareAttackers} onChange={(value) => update({ stops: { ...settings.stops, stopOnDeclareAttackers: value } })} />
          </Row>
          <Row label="Stop when a spell or ability goes on the stack">
            <Switch checked={!!settings.stops.stopOnStackNewObjects} onChange={(value) => update({ stops: { ...settings.stops, stopOnStackNewObjects: value } })} />
          </Row>
        </Tabs.Content>

        <Tabs.Content value="answers" className={styles.panel}>
          <AutoAnswers />
        </Tabs.Content>

        <Tabs.Content value="display" className={styles.panel}>
          <Row label="Card motion" detail="Cards fly between zones and settle on the mat. Your system's reduced-motion setting always wins.">{toggle('animations')}</Row>
        </Tabs.Content>

        <Tabs.Content value="alerts" className={styles.panel}>
          <p className={styles.intro}>While Playmat is in a background tab, the tab title counts what waits for you.</p>
          <Row
            label="Browser notifications"
            detail={notificationsSupported()
              ? 'Also show a notification when it is your move, a draft pick is up, a game starts or someone whispers to you.'
              : "This browser can't show notifications."}
          >
            <Switch
              checked={settings.notifications && notificationsSupported()}
              onChange={(value) => {
                if (!value) {
                  update({ notifications: false });
                  return;
                }
                void requestNotifications().then((granted) => update({ notifications: granted }));
              }}
            />
          </Row>
        </Tabs.Content>

        <Tabs.Content value="sound" className={styles.panel}>
          <Row label="Sound effects" detail="Short cues for your turn, decisions, spells, combat, life changes and the result. Press M during a game to mute.">{toggle('sound')}</Row>
          <Row label="Volume">
            <div className={styles.volume}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                disabled={!settings.sound}
                onChange={(event) => update({ volume: Number(event.target.value) })}
                onPointerUp={previewTurnCue}
                onKeyUp={previewTurnCue}
                aria-label="Sound volume"
                aria-valuetext={`${Math.round(settings.volume * 100)}%`}
              />
              <span aria-hidden="true">{Math.round(settings.volume * 100)}%</span>
            </div>
          </Row>
          <Row label="Only important cues" detail="Just your turn, decisions, your clock running low and the result.">{toggle('importantCuesOnly')}</Row>
        </Tabs.Content>

        <Tabs.Content value="import" className={styles.panel}>
          <Bookmarklet />
        </Tabs.Content>
      </Tabs.Root>
    </Dialog>
  );
}

const CHOICE_LABEL: Record<AutoRule['choice'], string> = { yes: 'Always yes', no: 'Always no', first: 'Always first', last: 'Always last' };

/** Standing answers set with "Always…" in the games in progress, and resetting them. */
function AutoAnswers() {
  const rules = useAutoAnswers((state) => state.rules);
  const forget = useAutoAnswers((state) => state.forget);
  const sessions = useGames((state) => state.sessions);
  const games = useMemo(() => Object.entries(sessions)
    .filter(([, session]) => session.getState().mode === 'play')
    .map(([gameId]) => ({ gameId, rules: rules.filter((rule) => rule.gameId === gameId) })), [sessions, rules]);

  const reset = (gameId: string, kind: AutoRuleKind) => {
    const session = useGames.getState().sessions[gameId];
    if (session) void session.respond(resetCommand(kind)).catch(() => undefined);
    forget(gameId, kind);
  };

  return (
    <>
      <p className={styles.intro}>
        When the game asks a yes/no question, or the order of your triggers, “Always…” answers it the same way for the rest of that game.
      </p>
      {games.length === 0 && <p className={styles.rowDetail}>You’re not in a game. Answers you set during a game show here.</p>}
      {games.map((game, index) => (
        <section key={game.gameId} className={styles.answers} aria-label={games.length > 1 ? `Game ${index + 1}` : 'This game'}>
          {(['answer', 'trigger'] as const).map((kind) => {
            const list = game.rules.filter((rule) => rule.kind === kind);
            return (
              <div key={kind}>
                <div className={styles.row}>
                  <div>
                    <div className={styles.rowLabel}>{kind === 'answer' ? 'Questions' : 'Trigger order'}{games.length > 1 ? ` · game ${index + 1}` : ''}</div>
                    <div className={styles.rowDetail}>
                      {list.length === 0 ? 'None set from here. Resetting also clears any set elsewhere.' : `${list.length} set`}
                    </div>
                  </div>
                  <Button variant="print" size="sm" onClick={() => reset(game.gameId, kind)}>Reset</Button>
                </div>
                {list.length > 0 && (
                  <ul className={styles.answerList}>
                    {list.map((rule) => (
                      <li key={rule.label}>
                        <span>{rule.label}</span>
                        <b>{CHOICE_LABEL[rule.choice]}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}

/** "Send to Playmat": a bookmark that brings the deck on the page over in one click. */
function Bookmarklet() {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // React won't render javascript: links, so the bookmark's address is set by hand
    const code = bookmarkletSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\n\s+/g, '\n')
      .trim()
      .replaceAll('__PLAYMAT_ORIGIN__', window.location.origin);
    link.current?.setAttribute('href', `javascript:${encodeURIComponent(code)}`);
  }, []);
  return (
    <div className={styles.bookmarklet}>
      <p className={styles.intro}>
        Moxfield, MTGGoldfish, AetherHub, TappedOut and Deckstats don’t let other apps read their decks. This bookmark reads the deck on the page you’re looking at, with your browser, and brings it here.
      </p>
      <a ref={link} className={styles.bookmarkletLink} draggable onClick={(event) => event.preventDefault()} title="Drag this to your bookmarks bar">
        <BookmarkPlus size={18} aria-hidden="true" /> Send to Playmat
      </a>
      <ol className={styles.bookmarkletSteps}>
        <li>Drag <b>Send to Playmat</b> to your bookmarks bar.</li>
        <li>Open a deck on any deck site.</li>
        <li>Click the bookmark. The deck opens here, ready to save.</li>
      </ol>
      <p className={styles.rowDetail}>It only reads the deck page it runs on, and the deck travels in the link itself: no server sees it.</p>
    </div>
  );
}

function Row({ label, detail, children }: { label: string; detail?: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>{label}</div>
        {detail && <div className={styles.rowDetail}>{detail}</div>}
      </div>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange(value: boolean): void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={styles.switch} onClick={() => onChange(!checked)}>
      <span className={styles.knob} />
    </button>
  );
}

/** the synthesizer belongs to the match screen; load it only when someone tries the volume */
function previewTurnCue() {
  void import('../match/sound').then(({ previewCue }) => previewCue('turn'));
}
