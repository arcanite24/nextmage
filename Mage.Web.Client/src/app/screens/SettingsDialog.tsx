import * as Tabs from '@radix-ui/react-tabs';
import type { SkipPrioritySteps } from '../../protocol/generated/views';
import { DEFAULT_SETTINGS, useSettings, type PlaySettings } from '../stores/settings';
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
      footer={<Button variant="quiet" onClick={() => update(DEFAULT_SETTINGS)}>Restore defaults</Button>}>
      <Tabs.Root defaultValue="play" className={styles.tabs} orientation="vertical">
        <Tabs.List className={styles.list} aria-label="Settings sections">
          <Tabs.Trigger value="play" className={styles.trigger}>Gameplay</Tabs.Trigger>
          <Tabs.Trigger value="stops" className={styles.trigger}>Stops</Tabs.Trigger>
          <Tabs.Trigger value="display" className={styles.trigger}>Motion</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="play" className={styles.panel}>
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

        <Tabs.Content value="display" className={styles.panel}>
          <Row label="Card motion" detail="Cards fly between zones and settle on the mat. Your system's reduced-motion setting always wins.">{toggle('animations')}</Row>
          <Row label="Sound" detail="Short cues for your turn, decisions, spells, damage and the result.">{toggle('sound')}</Row>
          <Row label="Volume">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              disabled={!settings.sound}
              onChange={(event) => update({ volume: Number(event.target.value) })}
              aria-label="Sound volume"
              style={{ accentColor: 'var(--decision)', width: 160 }}
            />
          </Row>
        </Tabs.Content>
      </Tabs.Root>
    </Dialog>
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
