import type { ClientKeybindConfig, KeybindActionId } from './AppConfigService.js';

type KeybindHandler = () => void | Promise<void>;
type KeybindEventType = 'keydown' | 'keyup';

export interface KeybindDefinition {
  id: string;
  actionId?: KeybindActionId;
  label: string;
  key: string;
  eventType?: KeybindEventType;
  ctrlOrMeta?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  ignoreRepeat?: boolean;
  preventDefault?: boolean;
  handler: KeybindHandler;
}

export interface KeybindActionMetadata {
  actionId: KeybindActionId;
  label: string;
  description: string;
}

export const KEYBIND_ACTION_METADATA: KeybindActionMetadata[] = [
  { actionId: 'confirm', label: 'Confirm', description: 'Confirm the current prompt or priority request.' },
  { actionId: 'cancelSkip', label: 'Cancel Skip', description: 'Cancel the active pass or skip action.' },
  { actionId: 'nextTurn', label: 'Next Turn', description: 'Pass priority until the next turn.' },
  { actionId: 'endStep', label: 'End Step', description: 'Pass priority until the end step.' },
  { actionId: 'skipStep', label: 'Skip Step', description: 'Pass priority until the next turn while skipping stack prompts.' },
  { actionId: 'mainStep', label: 'Main Step', description: 'Pass priority until the next main phase.' },
  { actionId: 'yourTurn', label: 'Your Turn', description: 'Pass priority until your next turn.' },
  { actionId: 'skipStack', label: 'Skip Stack', description: 'Pass priority until the stack resolves.' },
  { actionId: 'priorEndStep', label: 'Prior End Step', description: 'Pass priority until the end step before your turn.' },
  { actionId: 'switchChat', label: 'Switch Chat', description: 'Focus or cycle chat channels.' },
  { actionId: 'toggleMacro', label: 'Toggle Macro', description: 'Toggle macro recording where supported.' },
  { actionId: 'holdFirstMana', label: 'Hold First Mana', description: 'Temporarily prefer the first mana ability while held.' },
  { actionId: 'debugMode', label: 'Debug Mode', description: 'Toggle the match debug overlay.' },
];

export class KeybindService {
  private keybinds = new Map<string, KeybindDefinition>();

  registerMany(definitions: KeybindDefinition[]): () => void {
    definitions.forEach((definition) => this.keybinds.set(definition.id, definition));
    return () => {
      definitions.forEach((definition) => this.keybinds.delete(definition.id));
    };
  }

  handleKeyDown(event: KeyboardEvent): void {
    this.handleKeyboardEvent(event, 'keydown');
  }

  handleKeyUp(event: KeyboardEvent): void {
    this.handleKeyboardEvent(event, 'keyup');
  }

  private handleKeyboardEvent(event: KeyboardEvent, eventType: KeybindEventType): void {
    if (isEditableEventTarget(event.target)) {
      return;
    }

    const keybind = Array.from(this.keybinds.values()).find((definition) => {
      const sameEvent = (definition.eventType ?? 'keydown') === eventType;
      const sameKey = definition.key.toLowerCase() === event.key.toLowerCase();
      const modifierMatches = matchesCtrlOrMeta(definition.ctrlOrMeta, event)
        && matchesModifier(definition.altKey, event.altKey)
        && matchesModifier(definition.shiftKey, event.shiftKey);
      return sameEvent && sameKey && modifierMatches;
    });

    if (!keybind) return;

    if (keybind.preventDefault !== false) {
      event.preventDefault();
    }

    if (eventType === 'keydown' && keybind.ignoreRepeat && event.repeat) {
      return;
    }

    void keybind.handler();
  }

  getKeybinds(): KeybindDefinition[] {
    return Array.from(this.keybinds.values());
  }
}

export function applyClientKeybind(
  definition: KeybindDefinition,
  config: ClientKeybindConfig | undefined,
): KeybindDefinition | null {
  if (!config || !config.enabled) return config?.enabled === false ? null : definition;

  return {
    ...definition,
    key: config.key,
    eventType: config.eventType,
    ctrlOrMeta: config.ctrlOrMeta,
    altKey: config.altKey,
    shiftKey: config.shiftKey,
  };
}

function matchesModifier(expected: boolean | undefined, actual: boolean): boolean {
  return expected === undefined || expected === actual;
}

function matchesCtrlOrMeta(expected: boolean | undefined, event: KeyboardEvent): boolean {
  if (expected === undefined) return true;
  const pressed = event.ctrlKey || event.metaKey;
  return expected === pressed;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!target) return false;

  if (typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement) return true;
  if (typeof HTMLTextAreaElement !== 'undefined' && target instanceof HTMLTextAreaElement) return true;
  if (typeof HTMLSelectElement !== 'undefined' && target instanceof HTMLSelectElement) return true;
  if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) return target.isContentEditable;

  return false;
}

export const keybindService = new KeybindService();
