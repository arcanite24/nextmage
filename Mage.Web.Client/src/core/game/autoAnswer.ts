import type { CardView, StackAbilityView } from '../../protocol/generated/views';
import type { Command } from './interaction';
import { stripMarkup, type Prompt } from './prompt';

/**
 * Standing answers the server keeps for one game: "always yes/no" to a recurring question, and "always put this
 * trigger first/last". The server applies them (HumanPlayer); the client only sends the player's choice and
 * remembers it to list it in Settings, since the server has no way to read them back.
 */

export type AutoRuleKind = 'answer' | 'trigger';
export type AutoChoice = 'yes' | 'no' | 'first' | 'last';

export interface AutoRule {
  gameId: string;
  kind: AutoRuleKind;
  /** what the rule is about, for people: the question or the trigger's text */
  label: string;
  choice: AutoChoice;
}

/**
 * The key the server remembers a yes/no answer under: the question with its source's name replaced by "{this}",
 * so the same ability on another copy of the card is answered too. Only questions that carry one can be automated
 * (the mulligan can't).
 */
export function autoAnswerKey(prompt: Prompt | null | undefined): string | null {
  if (!prompt || prompt.kind !== 'ask' || prompt.isMulligan) return null;
  const key = prompt.options.autoAnswerMessage;
  return typeof key === 'string' && key.trim() ? key : null;
}

/** "Pick triggered ability (goes to the stack first)": the server asks which simultaneous trigger goes first. */
export function isTriggerOrderPrompt(prompt: Prompt | null | undefined): prompt is Extract<Prompt, { kind: 'target' }> {
  if (!prompt || prompt.kind !== 'target' || !prompt.cards) return false;
  const type = prompt.options.queryType;
  // older servers or serializers may leave the query type out; the question itself is fixed text
  return type === 'PICK_ABILITY' || (type === undefined && /^Pick triggered ability/i.test(prompt.text));
}

/** Answer the question now and every time it comes back this game. */
export function alwaysAnswerCommands(key: string, yes: boolean): Command[] {
  return [
    { type: 'action', action: yes ? 'REQUEST_AUTO_ANSWER_TEXT_YES' : 'REQUEST_AUTO_ANSWER_TEXT_NO', data: key },
    { type: 'boolean', value: yes },
  ];
}

/**
 * Put this trigger first (it is chosen now) or last (the server asks again without it) whenever it triggers along
 * with others this game. The server remembers the ability itself, so other copies of the card are not affected.
 */
export function triggerOrderCommands(abilityId: string, where: 'first' | 'last'): Command[] {
  return where === 'first'
    ? [{ type: 'action', action: 'TRIGGER_AUTO_ORDER_ABILITY_FIRST', data: abilityId }, { type: 'uuid', id: abilityId }]
    : [{ type: 'action', action: 'TRIGGER_AUTO_ORDER_ABILITY_LAST', data: abilityId }, { type: 'uuid', id: null }];
}

export function resetCommand(kind: AutoRuleKind): Command {
  return { type: 'action', action: kind === 'answer' ? 'REQUEST_AUTO_ANSWER_RESET_ALL' : 'TRIGGER_AUTO_ORDER_RESET_ALL' };
}

/** "Soul Warden: Whenever another creature enters, you gain 1 life." */
export function triggerLabel(card: CardView): string {
  // the server's AbilityView also carries the source's name, outside the generated types
  const ability = card as StackAbilityView & { sourceName?: string };
  const source = ability.sourceName ?? ability.sourceCard?.name ?? (card.name !== 'Ability' ? card.name : undefined);
  const rule = stripMarkup((card.rules ?? []).join(' ')).replace(/\{this\}/gi, source ?? 'this');
  return source ? `${source}: ${rule}` : rule;
}

/** The question as people read it: markup gone, "{this}" back to "this". */
export function answerLabel(key: string): string {
  return stripMarkup(key).replace(/\{this\}/gi, 'this');
}

/** Adds a rule, replacing an older one about the same thing in the same game. */
export function addRule(rules: readonly AutoRule[], rule: AutoRule): AutoRule[] {
  return [...rules.filter((other) => !(other.gameId === rule.gameId && other.kind === rule.kind && other.label === rule.label)), rule];
}

/** Rules of one kind cleared for a game (the server only resets them all at once). */
export function clearRules(rules: readonly AutoRule[], gameId: string, kind: AutoRuleKind): AutoRule[] {
  return rules.filter((rule) => !(rule.gameId === gameId && rule.kind === kind));
}

/**
 * "Order automatically": while on, trigger-order questions are answered with the first trigger listed (the order
 * the server found them in). Returns the id to answer with, or null when the prompt is something else.
 */
export function autoOrderPick(prompt: Prompt | null | undefined): string | null {
  if (!isTriggerOrderPrompt(prompt)) return null;
  return prompt.targets[0] ?? Object.keys(prompt.cards ?? {})[0] ?? null;
}
