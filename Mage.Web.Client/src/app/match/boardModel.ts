import type { CardView, GameView, PermanentView, PlayerView } from '../../protocol/generated/views';

/**
 * Pure layout model of the board: which permanents go in which row, how lands and tokens stack,
 * and where each player sits. The stage renders it; nothing here touches the DOM.
 */

export interface PermanentGroup {
  /** stable key: the first permanent's id */
  key: string;
  /** the permanent drawn on top; the others peek out behind it */
  lead: PermanentView;
  members: PermanentView[];
  /** auras and equipment attached to the lead, drawn tucked behind it */
  attachments: PermanentView[];
}

export interface PlayerBoard {
  player: PlayerView;
  isMe: boolean;
  /** creatures, planeswalkers and battles: the row facing the opponent */
  front: PermanentGroup[];
  /** lands first, then other non-creature permanents: the row near the player */
  back: PermanentGroup[];
}

export interface BoardModel {
  me: PlayerBoard | null;
  opponents: PlayerBoard[];
  /** players by id, for targeting and arrows */
  players: Map<string, PlayerView>;
}

const FRONT_TYPES = new Set(['CREATURE', 'PLANESWALKER', 'BATTLE']);

function isFront(permanent: PermanentView): boolean {
  return (permanent.cardTypes ?? []).some((type) => FRONT_TYPES.has(type));
}

function isLand(permanent: PermanentView): boolean {
  return (permanent.cardTypes ?? []).includes('LAND') && !isFront(permanent);
}

/** Permanents look the same when a player could not tell them apart at a glance. */
function stackSignature(permanent: PermanentView): string | null {
  const counters = (permanent.counters ?? []).length;
  const attached = (permanent.attachments ?? []).length;
  if (counters > 0 || attached > 0 || (permanent.damage ?? 0) > 0) return null;
  // only lands and tokens stack; creatures stay individually visible
  if (!isLand(permanent) && !permanent.isToken) return null;
  return [
    permanent.name,
    permanent.expansionSetCode,
    permanent.tapped ? 't' : 'u',
    permanent.isToken ? 'token' : 'card',
    permanent.power ?? '',
    permanent.toughness ?? '',
    permanent.summoningSickness ? 's' : '',
  ].join('|');
}

const MAX_STACK = 4;

function groupRow(permanents: PermanentView[], attachmentsByHost: Map<string, PermanentView[]>): PermanentGroup[] {
  const groups: PermanentGroup[] = [];
  const bySignature = new Map<string, PermanentGroup>();
  for (const permanent of permanents) {
    const signature = stackSignature(permanent);
    const existing = signature ? bySignature.get(signature) : undefined;
    if (existing && existing.members.length < MAX_STACK) {
      existing.members.push(permanent);
      continue;
    }
    const group: PermanentGroup = {
      key: permanent.id!,
      lead: permanent,
      members: [permanent],
      attachments: attachmentsByHost.get(permanent.id!) ?? [],
    };
    groups.push(group);
    if (signature) bySignature.set(signature, group);
  }
  return groups;
}

/**
 * Board rows keep the order in which permanents arrived (the server's order), so nothing reshuffles
 * when a new permanent enters; lands are pulled to the left of the back row.
 */
export function buildPlayerBoard(player: PlayerView, isMe: boolean): PlayerBoard {
  const permanents = Object.values(player.battlefield ?? {});
  const ids = new Set(permanents.map((permanent) => permanent.id));
  const attachmentsByHost = new Map<string, PermanentView[]>();
  const standalone: PermanentView[] = [];
  for (const permanent of permanents) {
    // attachments on permanents of the same player are tucked behind the host
    if (permanent.attachedTo && permanent.attachedToPermanent && ids.has(permanent.attachedTo)) {
      const list = attachmentsByHost.get(permanent.attachedTo) ?? [];
      list.push(permanent);
      attachmentsByHost.set(permanent.attachedTo, list);
    } else {
      standalone.push(permanent);
    }
  }

  const front = standalone.filter(isFront);
  const lands = standalone.filter((permanent) => !isFront(permanent) && isLand(permanent));
  const others = standalone.filter((permanent) => !isFront(permanent) && !isLand(permanent));
  return {
    player,
    isMe,
    front: groupRow(front, attachmentsByHost),
    back: [...groupRow(lands, attachmentsByHost), ...groupRow(others, attachmentsByHost)],
  };
}

/** The local player sits at the bottom; opponents across, in turn order starting after us. */
export function buildBoard(view: GameView | null | undefined, myPlayerId: string | null): BoardModel {
  const players = view?.players ?? [];
  const meIndex = players.findIndex((player) => player.playerId === myPlayerId);
  const me = meIndex >= 0 ? players[meIndex] : null;
  const ordered = meIndex >= 0 ? [...players.slice(meIndex + 1), ...players.slice(0, meIndex)] : players.slice(1);
  const bottom = me ?? players[0] ?? null;
  return {
    me: bottom ? buildPlayerBoard(bottom, !!me) : null,
    opponents: (me ? ordered : players.slice(1)).map((player) => buildPlayerBoard(player, false)),
    players: new Map(players.map((player) => [player.playerId!, player])),
  };
}

/** The physical card behind a view: stable from hand to stack to battlefield to graveyard. */
export function cardKey(card: Pick<CardView, 'id' | 'cardId'>): string {
  return card.cardId ?? card.id ?? '';
}

/** Card width (stage px) that fits a row's groups into the space available. */
export function fitCardWidth(groups: PermanentGroup[], available: number, ideal: number, min: number): number {
  if (groups.length === 0) return ideal;
  // tapped cards take their height in width; stacks add a small offset per member
  const units = groups.reduce((sum, group) => {
    const tapped = group.lead.tapped ? 88 / 63 : 1;
    return sum + tapped + (group.members.length - 1) * 0.12 + group.attachments.length * 0.18;
  }, 0);
  const gaps = (groups.length - 1) * 0.12;
  return Math.max(min, Math.min(ideal, available / (units + gaps)));
}
