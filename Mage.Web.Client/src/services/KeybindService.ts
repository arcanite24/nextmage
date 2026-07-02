type KeybindHandler = () => void | Promise<void>;
type KeybindEventType = 'keydown' | 'keyup';

export interface KeybindDefinition {
  id: string;
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
