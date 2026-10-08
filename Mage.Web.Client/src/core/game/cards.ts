import type { CardView, StackAbilityView } from '../../protocol/generated/views';

/**
 * Whether a stack object is an ability rather than a spell. The server's ability views never set `isAbility`;
 * they carry the source card and an ABILITY_* object type instead.
 */
export function isStackAbility(card: CardView): card is StackAbilityView {
  return !!card.isAbility
    || !!(card as StackAbilityView).sourceCard
    || (card.mageObjectType ?? '').startsWith('ABILITY');
}
