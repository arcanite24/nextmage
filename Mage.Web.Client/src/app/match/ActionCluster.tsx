import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronUp } from 'lucide-react';
import { useEffect } from 'react';
import type { Command, Interaction } from '../../core/game/interaction';
import type { PlayerAction } from '../../protocol/generated/views';
import { isEditableEventTarget } from '../ui/keys';
import { Button } from '../ui/Button';
import { PromptText } from '../ui/PromptText';
import styles from './ActionCluster.module.css';

export interface ActionClusterProps {
  interaction: Interaction;
  awaiting: boolean;
  status: string | null;
  canAct: boolean;
  /** server offers a special action (e.g. turning a face-down creature up) */
  special: boolean;
  holdingPriority: boolean;
  onCommand(command: Command): void;
}

const PASS_AHEAD: { label: string; action: PlayerAction; key: string }[] = [
  { label: 'Pass to end of turn', action: 'PASS_PRIORITY_UNTIL_TURN_END_STEP', key: 'F4' },
  { label: 'Pass to next turn', action: 'PASS_PRIORITY_UNTIL_NEXT_TURN', key: 'F5' },
  { label: 'Pass to my next turn', action: 'PASS_PRIORITY_UNTIL_MY_NEXT_TURN', key: 'F9' },
  { label: 'Resolve the stack', action: 'PASS_PRIORITY_UNTIL_STACK_RESOLVED', key: 'F10' },
];

/** The decision corner: what the game is asking, and the one big button that answers it. */
export function ActionCluster({ interaction, awaiting, status, canAct, special, holdingPriority, onCommand }: ActionClusterProps) {
  const main = interaction.mainButton;
  const secondary = [...interaction.secondaryButtons];
  if (special && interaction.mode === 'priority') {
    secondary.unshift({ label: 'Special action', command: { type: 'string', value: 'special' }, tone: 'secondary' });
  }
  const cancel = secondary.find((button) => button.label === 'Cancel');

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isEditableEventTarget(event.target) || event.target instanceof HTMLButtonElement) return;
      if ((event.code === 'Space' || event.key === 'Enter') && main?.shortcut === 'Space' && !awaiting) {
        event.preventDefault();
        onCommand(main.command);
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
  }, [main, cancel, awaiting, canAct, onCommand]);

  const deciding = interaction.mode !== 'waiting' && !awaiting;
  // other decisions are printed across the table; the corner keeps the priority and waiting lines
  const centred = deciding && interaction.mode !== 'priority';
  const headline = centred ? '' : deciding ? interaction.headline : status ?? interaction.headline;
  const passAhead = canAct && (interaction.mode === 'priority' || interaction.mode === 'waiting');

  return (
    <section className={styles.cluster} aria-label="Your decision" aria-live="polite">
      {headline && <p className={[styles.headline, deciding ? styles.deciding : ''].join(' ')}><PromptText text={headline} /></p>}
      {secondary.length > 0 && deciding && (
        <div className={styles.secondary}>
          {secondary.map((button) => (
            <Button
              key={button.label}
              variant={button.tone === 'danger' ? 'danger' : button.tone === 'attack' ? 'print' : 'print'}
              size="md"
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
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
        {main && deciding ? (
          <Button
            variant="decision"
            size="xl"
            className={[styles.main, main.tone === 'attack' ? styles.mainAttack : ''].join(' ')}
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
