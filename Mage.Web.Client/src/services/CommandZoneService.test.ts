import assert from 'node:assert/strict';
import { test } from 'vitest';
import { MageObjectType } from '../types/api.js';
import type { PlayerView } from '../types/game.js';
import {
  getCommandZoneKind,
  getPlayerCommandObjects,
  getPlayerCommandZoneGroups,
  getSharedPlanes,
} from './CommandZoneService.js';

type TestCommandObject = {
  id: string;
  name: string;
  expansionSetCode: string;
  imageFileName: string;
  imageNumber: number;
  rules: string[];
  mageObjectType?: MageObjectType;
};

function commandObject(overrides: Partial<TestCommandObject>): TestCommandObject {
  return {
    id: overrides.id ?? 'command-1',
    name: overrides.name ?? 'Command object',
    expansionSetCode: overrides.expansionSetCode ?? 'M11',
    imageFileName: overrides.imageFileName ?? '',
    imageNumber: overrides.imageNumber ?? 0,
    rules: overrides.rules ?? [],
    mageObjectType: overrides.mageObjectType,
  };
}

function player(overrides: Partial<PlayerView>): PlayerView {
  return {
    playerId: 'player-1',
    name: 'Player',
    controlled: true,
    isHuman: true,
    life: 20,
    counters: [],
    wins: 0,
    winsNeeded: 1,
    libraryCount: 0,
    handCount: 0,
    manaPool: { red: 0, green: 0, blue: 0, white: 0, black: 0, colorless: 0 },
    graveyard: {},
    exile: {},
    sideboard: {},
    helperCards: {},
    battlefield: {},
    userData: {} as PlayerView['userData'],
    commandList: [],
    commandObjectList: [],
    attachments: [],
    statesSavedSize: 0,
    priorityTimeLeftSecs: 0,
    bufferTimeLeft: 0,
    timerActive: false,
    isActive: false,
    hasPriority: false,
    hasLeft: false,
    passedTurn: false,
    passedUntilEndOfTurn: false,
    passedUntilNextMain: false,
    passedUntilStackResolved: false,
    passedAllTurns: false,
    passedUntilEndStepBeforeMyTurn: false,
    monarch: false,
    initiative: false,
    designationNames: [],
    ...overrides,
  };
}

test('classifies Java command object views by explicit mage object type', () => {
  assert.equal(getCommandZoneKind(commandObject({ name: 'Muldrotha', mageObjectType: MageObjectType.COMMANDER })), 'commander');
  assert.equal(getCommandZoneKind(commandObject({ name: 'Chandra Emblem', mageObjectType: MageObjectType.EMBLEM })), 'emblem');
  assert.equal(getCommandZoneKind(commandObject({ name: 'Undercity', mageObjectType: MageObjectType.DUNGEON })), 'dungeon');
  assert.equal(getCommandZoneKind(commandObject({ name: 'Panopticon', mageObjectType: MageObjectType.PLANE })), 'plane');
});

test('classifies plain Gson command objects when only stable set and name fields remain', () => {
  assert.equal(getCommandZoneKind(commandObject({ name: 'Dungeon of the Mad Mage', expansionSetCode: 'AFR' })), 'dungeon');
  assert.equal(getCommandZoneKind(commandObject({ name: 'Undercity', expansionSetCode: 'CLB' })), 'dungeon');
  assert.equal(getCommandZoneKind(commandObject({ name: 'Panopticon', expansionSetCode: 'PCA' })), 'plane');
  assert.equal(getCommandZoneKind(commandObject({ name: 'Elspeth Emblem', expansionSetCode: 'TM14' })), 'emblem');
});

test('deduplicates legacy commandList and Java commandObjectList shapes', () => {
  const commander = commandObject({ id: 'commander-1', name: 'Marwyn', mageObjectType: MageObjectType.COMMANDER });
  const commandPlayer = player({
    commandList: [commander],
    commandObjectList: [commander],
  });

  assert.equal(getPlayerCommandObjects(commandPlayer).length, 1);
});

test('groups player command objects and exposes shared planes once', () => {
  const plane = commandObject({ id: 'plane-1', name: 'Panopticon', expansionSetCode: 'PCA' });
  const playerOne = player({
    playerId: 'player-1',
    commandObjectList: [
      commandObject({ id: 'commander-1', name: 'Marwyn', mageObjectType: MageObjectType.COMMANDER }),
      commandObject({ id: 'dungeon-1', name: 'Undercity', expansionSetCode: 'CLB' }),
      plane,
    ],
  });
  const playerTwo = player({
    playerId: 'player-2',
    commandObjectList: [
      commandObject({ id: 'emblem-1', name: 'Chandra Emblem', mageObjectType: MageObjectType.EMBLEM }),
      plane,
    ],
  });

  const groups = getPlayerCommandZoneGroups(playerOne);
  assert.equal(groups.commanders.length, 1);
  assert.equal(groups.dungeons.length, 1);
  assert.equal(groups.planes.length, 1);
  assert.deepEqual(getSharedPlanes([playerOne, playerTwo]).map((item) => item.id), ['plane-1']);
});
