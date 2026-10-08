import { MageObjectType } from '../types/api.js';
import type { CardView, CommandObjectView, PlayerView } from '../types/game.js';

export type CommandZoneKind = 'commander' | 'emblem' | 'dungeon' | 'plane' | 'other';
export type CommandZoneObject = Partial<CardView & CommandObjectView>;

export interface CommandZoneGroups {
  commanders: CommandZoneObject[];
  emblems: CommandZoneObject[];
  dungeons: CommandZoneObject[];
  planes: CommandZoneObject[];
  other: CommandZoneObject[];
}

const DUNGEON_NAMES = new Set([
  'Dungeon of the Mad Mage',
  'Lost Mine of Phandelver',
  'Tomb of Annihilation',
  'Undercity',
]);

const PLANE_SET_CODES = new Set(['HOP', 'OPCA', 'PCA', 'PC2']);

export function getPlayerCommandObjects(player: PlayerView): CommandZoneObject[] {
  const seen = new Set<string>();
  const objects = [
    ...(player.commandObjectList ?? []),
    ...(player.commandList ?? []),
  ] as CommandZoneObject[];

  return objects.filter((object, index) => {
    const id = object.id ?? `${object.name ?? 'command'}-${index}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function getCommandZoneKind(commandObject: CommandZoneObject): CommandZoneKind {
  switch (commandObject.mageObjectType) {
    case MageObjectType.COMMANDER:
      return 'commander';
    case MageObjectType.EMBLEM:
      return 'emblem';
    case MageObjectType.DUNGEON:
      return 'dungeon';
    case MageObjectType.PLANE:
      return 'plane';
    default:
      break;
  }

  if (commandObject.cardTypes?.includes('DUNGEON')) {
    return 'dungeon';
  }

  const name = commandObject.name ?? commandObject.displayName ?? '';
  if (DUNGEON_NAMES.has(name)) {
    return 'dungeon';
  }

  const setCode = commandObject.expansionSetCode?.toUpperCase();
  if (setCode && PLANE_SET_CODES.has(setCode)) {
    return 'plane';
  }

  if (name.toLowerCase().includes('emblem')) {
    return 'emblem';
  }

  return 'other';
}

export function groupCommandZoneObjects(objects: CommandZoneObject[]): CommandZoneGroups {
  const groups: CommandZoneGroups = {
    commanders: [],
    emblems: [],
    dungeons: [],
    planes: [],
    other: [],
  };

  objects.forEach((object) => {
    switch (getCommandZoneKind(object)) {
      case 'commander':
        groups.commanders.push(object);
        break;
      case 'emblem':
        groups.emblems.push(object);
        break;
      case 'dungeon':
        groups.dungeons.push(object);
        break;
      case 'plane':
        groups.planes.push(object);
        break;
      case 'other':
        groups.other.push(object);
        break;
    }
  });

  return groups;
}

export function getPlayerCommandZoneGroups(player: PlayerView): CommandZoneGroups {
  return groupCommandZoneObjects(getPlayerCommandObjects(player));
}

export function getSharedPlanes(players: PlayerView[]): CommandZoneObject[] {
  const seen = new Set<string>();
  const planes: CommandZoneObject[] = [];

  players.forEach((player) => {
    getPlayerCommandZoneGroups(player).planes.forEach((plane, index) => {
      const id = plane.id ?? `${plane.name ?? 'plane'}-${index}`;
      if (seen.has(id)) return;
      seen.add(id);
      planes.push(plane);
    });
  });

  return planes;
}
