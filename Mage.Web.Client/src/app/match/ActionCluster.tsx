import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronUp } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { Command, Interaction, PromptButton } from '../../core/game/interaction';
import type { PlayerAction } from '../../protocol/generated/views';
import { isEditableEventTarget } from '../ui/keys';
import { Button } from '../ui/Button';
import { PromptText } from '../ui/PromptText';
import { useMatchUi } from './matchUi';
import styles from './ActionCluster.module.css';

export interface ActionClusterProps {
  interaction: Interaction;
  awaiting: boolean;
  status: string | null;
  canAct: boolean;
  /** server offers a special action (e.g. turning a face-down creature up) */
  special: boolean;
  holdingPriority: boolean;
  /** the client is answering for the player (nothing to do): show that instead of a button to press */
  autoPassing?: boolean;
  /** more ways to answer, beside the secondary buttons (e.g. "Always…") */
  extra?: ReactNode;
  /** Arena's full control: stop at every step, never pass for the player */
  fullControl?: boolean;
  onFullControl?(on: boolean): void;
  /** the last answer got no reaction from the server in time */
  stalled?: boolean;
  onResend?(): void;
  onResync?(): void;
  onCommand(command: Command): void;
}

const PASS_AHEAD: { label: string; action: PlayerAction; key: string }[] = [
  { label: 'Pass to end of turn', action: 'PASS_PRIORITY_UNTIL_TURN_END_STEP', key: 'F4' },
  { label: 'Pass to next turn', action: 'PASS_PRIORITY_UNTIL_NEXT_TURN', key: 'F5' },
  { label: 'Pass to my next turn', action: 'PASS_PRIORITY_UNTIL_MY_NEXT_TURN', key: 'F9' },
  { label: 'Resolve the stack', action: 'PASS_PRIORITY_UNTIL_STACK_RESOLVED', key: 'F10' },
];

const UNDO: PromptButton = { label: 'Undo tap', command: { type: 'action', action: 'UNDO' }, tone: 'secondary', shortcut: 'Ctrl+Z' };

/** The decision corner: what the game is asking, and the one big button that answers it. */
export function ActionCluster({
  interaction, awaiting, status, canAct, special, holdingPriority, autoPassing = false, fullControl = false, onFullControl, extra,
  stalled = false, onResend, onResync, onCommand,
}: ActionClusterProps) {
  const main = interaction.mainButton;
  const secondary = [...interaction.secondaryButtons];
  if (special && interaction.mode === 'priority') {
    secondary.unshift({ label: 'Special action', command: { type: 'string', value: 'special' }, tone: 'secondary' });
  }
  // while paying, the last mana tap can be taken back (the server restores the land and the pool)
  const undo = interaction.mode === 'payMana' && canAct ? UNDO : null;
  if (undo) secondary.unshift(undo);
  const cancel = secondary.find((button) => button.label === 'Cancel');

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // while a card is open in the detail view, keys belong to it: Space must never pass by accident
      if (useMatchUi.getState().detail) return;
      // Space always answers with the main button (as on the table, the big button is the one decision);
      // a focused real button keeps its own Space and Enter
      if (isEditableEventTarget(event.target) || event.target instanceof HTMLButtonElement) return;
      // Enter belongs to a focused card or plate; with nothing focused it also answers with the main button
      const onObject = event.target instanceof HTMLElement && event.target.getAttribute('role') === 'button';
      if ((event.code === 'Space' || (event.key === 'Enter' && !onObject)) && main?.shortcut === 'Space' && !awaiting) {
        event.preventDefault();
        onCommand(main.command);
      } else if (undo && (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        onCommand(undo.command);
      } else if (event.key === 'Escape' && cancel && !awaiting) {
        onCommand(cancel.command);
      } else {
        const ahead = PASS_AHEAD.find((item) => item.key === event.key);
        if (ahead && canAct) {
          event.preventDefault();
          onCommand({ type: 'action', action: ahead.action });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [main, cancel, undo, awaiting, canAct, onCommand]);

  // Ctrl+Shift on its own, as on Arena, locks full control on or off (released without any other key in between)
  useEffect(() => {
    if (!canAct || !onFullControl) return;
    let armed = false;
    const isModifier = (event: KeyboardEvent) => event.key === 'Control' || event.key === 'Shift';
    function onDown(event: KeyboardEvent) {
      armed = isModifier(event) && event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
    }
    function onUp(event: KeyboardEvent) {
      if (!armed || !isModifier(event)) return;
      armed = false;
      if (!isEditableEventTarget(event.target)) onFullControl!(!fullControl);
    }
    const disarm = () => { armed = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', disarm);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', disarm);
    };
  }, [canAct, fullControl, onFullControl]);

  // the answered prompt stays up while the server works (see the session's hold), so nothing blinks between decisions
  const deciding = interaction.mode !== 'waiting';
  // every decision is asked here, next to its buttons, so the question never covers the cards it is about
  const headline = deciding ? interaction.headline : status ?? interaction.headline;
  const passAhead = canAct && (interaction.mode === 'priority' || interaction.mode === 'waiting');

  return (
    <section className={styles.cluster} aria-label="Your decision" aria-live="polite">
      {headline && <p className={[styles.headline, deciding ? styles.deciding : ''].join(' ')}><PromptText text={headline} /></p>}
      {fullControl && canAct && (
        <button type="button" className={styles.fullControl} onClick={() => onFullControl?.(false)} title="Turn full control off (Ctrl+Shift)">
          Full control
        </button>
      )}
      {stalled && canAct && (
        <div className={styles.stalled} role="alert">
          <p>The server hasn't answered.</p>
          <div className={styles.stalledButtons}>
            {onResend && <Button variant="quiet" size="md" onClick={onResend}>Send again</Button>}
            {onResync && <Button variant="print" size="md" onClick={onResync}>Refresh board</Button>}
          </div>
        </div>
      )}
      {(secondary.length > 0 || extra) && deciding && (
        <div className={styles.secondary}>
          {extra}
          {secondary.map((button) => (
            <Button
              key={button.label}
              variant={button.tone === 'danger' ? 'danger' : button.tone === 'attack' ? 'print' : 'print'}
              size="md"
              title={button.shortcut && button.shortcut !== 'Space' ? `${button.label} (${button.shortcut})` : undefined}
              onClick={() => onCommand(button.command)}
              className={button.tone === 'attack' ? styles.attack : undefined}
            >
              {button.label}
            </Button>
          ))}
        </div>
      )}
      <div className={styles.mainRow}>
        {passAhead && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className={styles.ahead} aria-label="Pass ahead">
              <ChevronUp size={20} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={styles.menu} side="top" align="end" sideOffset={8}>
                {PASS_AHEAD.map((item) => (
                  <DropdownMenu.Item key={item.action} className={styles.menuItem} onSelect={() => onCommand({ type: 'action', action: item.action })}>
                    {item.label}<kbd>{item.key}</kbd>
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className={styles.menuRule} />
                <DropdownMenu.CheckboxItem
                  className={styles.menuItem}
                  checked={holdingPriority}
                  onCheckedChange={(on) => onCommand({ type: 'action', action: on ? 'HOLD_PRIORITY' : 'UNHOLD_PRIORITY' })}
                >
                  Hold priority after casting
                  <kbd>{holdingPriority ? 'On' : 'Off'}</kbd>
                </DropdownMenu.CheckboxItem>
                {onFullControl && (
                  <DropdownMenu.CheckboxItem
                    className={styles.menuItem}
                    checked={fullControl}
                    onCheckedChange={(on) => onFullControl(on)}
                  >
                    Full control: stop at every step
                    <kbd>Ctrl+Shift</kbd>
                  </DropdownMenu.CheckboxItem>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
        {autoPassing ? (
          <div className={[styles.waiting, styles.passing].join(' ')} role="status">Passing</div>
        ) : main && deciding ? (
          <Button
            variant="decision"
            size="xl"
            className={styles.main}
            onClick={() => onCommand(main.command)}
          >
            {main.label}
          </Button>
        ) : deciding ? null : (
          <div className={styles.waiting}>{awaiting ? 'Sending…' : 'Waiting'}</div>
        )}
      </div>
    </section>
  );
}
