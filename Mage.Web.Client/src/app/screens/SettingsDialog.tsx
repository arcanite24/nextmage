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
import { APP_NAME } from '../brand';
import { formatNumber, LOCALES, registerMessages, useT, type LocalePreference, type MessageKey, type Translate } from '../i18n';
import messages from '../i18n/en/settings';
import { browserLocale } from '../i18n/locales';
import { RichText } from '../i18n/RichText';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import styles from './SettingsDialog.module.css';

registerMessages(messages);

const STEPS: (keyof SkipPrioritySteps)[] = ['upkeep', 'draw', 'main1', 'beforeCombat', 'endOfCombat', 'main2', 'endOfTurn'];

const PLAY_STYLES = [
  ['settings.style.streamlined', STREAMLINED, 'settings.style.streamlined.detail'],
  ['settings.style.full', FULL_CONTROL, 'settings.style.full.detail'],
] as const;

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const settings = useSettings((state) => state.settings);
  const update = useSettings((state) => state.update);
  const t = useT();

  const toggle = (key: keyof PlaySettings) => (
    <Switch checked={!!settings[key]} onChange={(value) => update({ [key]: value } as Partial<PlaySettings>)} />
  );

  function setStop(turn: 'yourTurn' | 'opponentTurn', step: keyof SkipPrioritySteps, value: boolean) {
    update({ stops: { ...settings.stops, [turn]: { ...settings.stops[turn], [step]: value } } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('settings.title')} width="lg"
      footer={(
        <Button variant="quiet" onClick={() => update({ ...DEFAULT_SETTINGS, avatarId: settings.avatarId, flag: settings.flag, locale: settings.locale })}>
          {t('settings.restore')}
        </Button>
      )}>
      <Tabs.Root defaultValue="play" className={styles.tabs} orientation="vertical">
        <Tabs.List className={styles.list} aria-label={t('settings.sections')}>
          <Tabs.Trigger value="play" className={styles.trigger}>{t('settings.tab.play')}</Tabs.Trigger>
          <Tabs.Trigger value="stops" className={styles.trigger}>{t('settings.tab.stops')}</Tabs.Trigger>
          <Tabs.Trigger value="answers" className={styles.trigger}>{t('settings.tab.answers')}</Tabs.Trigger>
          <Tabs.Trigger value="display" className={styles.trigger}>{t('settings.tab.display')}</Tabs.Trigger>
          <Tabs.Trigger value="sound" className={styles.trigger}>{t('settings.tab.sound')}</Tabs.Trigger>
          <Tabs.Trigger value="alerts" className={styles.trigger}>{t('settings.tab.alerts')}</Tabs.Trigger>
          <Tabs.Trigger value="import" className={styles.trigger}>{t('settings.tab.import')}</Tabs.Trigger>
          <Tabs.Trigger value="language" className={styles.trigger}>{t('settings.tab.language')}</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="play" className={styles.panel}>
          <div className={styles.style}>
            <span className={styles.styleLabel}>{t('settings.style')}</span>
            <div className={styles.styleChoices} role="radiogroup" aria-label={t('settings.style')}>
              {PLAY_STYLES.map(([label, preset, detail]) => {
                const active = Object.entries(preset).every(([key, value]) => settings[key as keyof PlaySettings] === value);
                return (
                  <button key={label} type="button" role="radio" aria-checked={active} className={active ? styles.styleOn : styles.styleChoice} onClick={() => update(preset)}>
                    <strong>{t(label)}</strong>
                    <span>{t(detail)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Row label={t('settings.autoPass')} detail={t('settings.autoPass.detail')}>{toggle('autoPass')}</Row>
          <Row label={t('settings.theirTurn')} detail={t('settings.theirTurn.detail')}>{toggle('abilitiesOnTheirTurn')}</Row>
          <Row label={t('settings.skipCombat')} detail={t('settings.skipCombat.detail')}>{toggle('autoSkipCombat')}</Row>
          <Row label={t('settings.passAfterCasting')} detail={t('settings.passAfterCasting.detail')}>{toggle('passAfterCasting')}</Row>
          <Row label={t('settings.autoPay')} detail={t('settings.autoPay.detail')}>{toggle('autoPayMana')}</Row>
          <Row label={t('settings.autoPayRestricted')} detail={t('settings.autoPayRestricted.detail')}>{toggle('autoPayRestricted')}</Row>
          <Row label={t('settings.emptyPool')} detail={t('settings.emptyPool.detail')}>{toggle('confirmEmptyManaPool')}</Row>
          <Row label={t('settings.orderTriggers')} detail={t('settings.orderTriggers.detail')}>{toggle('autoOrderTriggers')}</Row>
          <Row label={t('settings.autoTarget')} detail={t('settings.autoTarget.detail')}>
            <Switch checked={settings.autoTargetLevel > 0} onChange={(value) => update({ autoTargetLevel: value ? 1 : 0 })} />
          </Row>
          <Row label={t('settings.handRequests')} detail={t('settings.handRequests.detail')}>{toggle('allowHandRequests')}</Row>
        </Tabs.Content>

        <Tabs.Content value="stops" className={styles.panel}>
          <p className={styles.intro}>{t('settings.stops.intro')}</p>
          <table className={styles.stops}>
            <thead>
              <tr><th scope="col">{t('settings.stops.step')}</th><th scope="col">{t('settings.stops.yourTurn')}</th><th scope="col">{t('settings.stops.theirTurn')}</th></tr>
            </thead>
            <tbody>
              {STEPS.map((step) => {
                const label = t(`settings.step.${step}`);
                return (
                  <tr key={step}>
                    <th scope="row">{label}</th>
                    <td><Switch label={t('settings.stops.yourTurnOf', { step: label })} checked={!!settings.stops.yourTurn?.[step]} onChange={(value) => setStop('yourTurn', step, value)} /></td>
                    <td><Switch label={t('settings.stops.theirTurnOf', { step: label })} checked={!!settings.stops.opponentTurn?.[step]} onChange={(value) => setStop('opponentTurn', step, value)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Row label={t('settings.stops.attackers')}>
            <Switch checked={!!settings.stops.stopOnDeclareAttackers} onChange={(value) => update({ stops: { ...settings.stops, stopOnDeclareAttackers: value } })} />
          </Row>
          <Row label={t('settings.stops.stack')}>
            <Switch checked={!!settings.stops.stopOnStackNewObjects} onChange={(value) => update({ stops: { ...settings.stops, stopOnStackNewObjects: value } })} />
          </Row>
        </Tabs.Content>

        <Tabs.Content value="answers" className={styles.panel}>
          <AutoAnswers />
        </Tabs.Content>

        <Tabs.Content value="display" className={styles.panel}>
          <Row label={t('settings.motion')} detail={t('settings.motion.detail')}>{toggle('animations')}</Row>
        </Tabs.Content>

        <Tabs.Content value="alerts" className={styles.panel}>
          <p className={styles.intro}>{t('settings.alerts.intro', { app: APP_NAME })}</p>
          <Row
            label={t('settings.notifications')}
            detail={notificationsSupported() ? t('settings.notifications.detail') : t('settings.notifications.unsupported')}
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
          <Row label={t('settings.sound')} detail={t('settings.sound.detail')}>{toggle('sound')}</Row>
          <Row label={t('settings.volume')}>
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
                aria-label={t('settings.volume.label')}
                aria-valuetext={formatNumber(settings.volume, { style: 'percent' })}
              />
              <span aria-hidden="true">{formatNumber(settings.volume, { style: 'percent' })}</span>
            </div>
          </Row>
          <Row label={t('settings.importantCues')} detail={t('settings.importantCues.detail')}>{toggle('importantCuesOnly')}</Row>
        </Tabs.Content>

        <Tabs.Content value="import" className={styles.panel}>
          <Bookmarklet />
        </Tabs.Content>

        <Tabs.Content value="language" className={styles.panel}>
          <Row label={t('settings.language')} detail={t('settings.language.detail')}>
            <select
              className={styles.select}
              value={settings.locale}
              aria-label={t('settings.language')}
              onChange={(event) => update({ locale: event.target.value as LocalePreference })}
            >
              <option value="auto">{t('settings.language.auto', { language: languageName(browserLocale(navigator.languages ?? [navigator.language])) })}</option>
              {LOCALES.map((locale) => <option key={locale.code} value={locale.code} lang={locale.code}>{locale.name}</option>)}
            </select>
          </Row>
        </Tabs.Content>
      </Tabs.Root>
    </Dialog>
  );
}

const CHOICE_LABEL: Record<AutoRule['choice'], MessageKey> = { yes: 'settings.choice.yes', no: 'settings.choice.no', first: 'settings.choice.first', last: 'settings.choice.last' };

function languageName(code: string): string {
  return LOCALES.find((locale) => locale.code === code)?.name ?? code;
}

/** Standing answers set with "Always…" in the games in progress, and resetting them. */
function AutoAnswers() {
  const rules = useAutoAnswers((state) => state.rules);
  const forget = useAutoAnswers((state) => state.forget);
  const t = useT();
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
        {t('settings.answers.intro')}
      </p>
      {games.length === 0 && <p className={styles.rowDetail}>{t('settings.answers.none')}</p>}
      {games.map((game, index) => (
        <section key={game.gameId} className={styles.answers} aria-label={games.length > 1 ? t('settings.answers.game', { number: index + 1 }) : t('settings.answers.thisGame')}>
          {(['answer', 'trigger'] as const).map((kind) => {
            const list = game.rules.filter((rule) => rule.kind === kind);
            return (
              <div key={kind}>
                <div className={styles.row}>
                  <div>
                    <div className={styles.rowLabel}>{rowLabel(t, kind, games.length > 1 ? index + 1 : null)}</div>
                    <div className={styles.rowDetail}>
                      {list.length === 0 ? t('settings.answers.empty') : t('settings.answers.count', { count: list.length })}
                    </div>
                  </div>
                  <Button variant="print" size="sm" onClick={() => reset(game.gameId, kind)}>{t('settings.answers.reset')}</Button>
                </div>
                {list.length > 0 && (
                  <ul className={styles.answerList}>
                    {list.map((rule) => (
                      <li key={rule.label}>
                        <span>{rule.label}</span>
                        <b>{t(CHOICE_LABEL[rule.choice])}</b>
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

/** "Questions", or "Questions · game 2" when several games are in progress. */
function rowLabel(t: Translate, kind: 'answer' | 'trigger', game: number | null): string {
  const label = t(kind === 'answer' ? 'settings.answers.questions' : 'settings.answers.triggers');
  return game === null ? label : t('settings.answers.ofGame', { label, number: game });
}

/** "Send to Playmat": a bookmark that brings the deck on the page over in one click. */
function Bookmarklet() {
  const link = useRef<HTMLAnchorElement>(null);
  const t = useT();
  useEffect(() => {
    // React won't render javascript: links, so the bookmark's address is set by hand
    const code = bookmarkletSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\n\s+/g, '\n')
      .trim()
      .replaceAll('__PLAYMAT_ORIGIN__', window.location.origin)
      .replaceAll('__APP_NAME__', APP_NAME.replace(/[\\'"]/g, ''));
    link.current?.setAttribute('href', `javascript:${encodeURIComponent(code)}`);
  }, []);
  return (
    <div className={styles.bookmarklet}>
      <p className={styles.intro}>
        {t('settings.bookmarklet.intro')}
      </p>
      <a ref={link} className={styles.bookmarkletLink} draggable onClick={(event) => event.preventDefault()} title={t('settings.bookmarklet.drag')}>
        <BookmarkPlus size={18} aria-hidden="true" /> {t('settings.bookmarklet.name', { app: APP_NAME })}
      </a>
      <ol className={styles.bookmarkletSteps}>
        <li><RichText text={t('settings.bookmarklet.step1')} parts={{ link: <b>{t('settings.bookmarklet.name', { app: APP_NAME })}</b> }} /></li>
        <li>{t('settings.bookmarklet.step2')}</li>
        <li>{t('settings.bookmarklet.step3')}</li>
      </ol>
      <p className={styles.rowDetail}>{t('settings.bookmarklet.privacy')}</p>
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
