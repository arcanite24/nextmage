import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { LoginPage } from './components/login';
import { LobbyPage } from './components/lobby';
import { WaitingRoom } from './components/lobby/WaitingRoom';
import { GamePage } from './components/game';
import { DeckManagerPage } from './components/deck/DeckManagerPage';
import { DeckEditorPage } from './components/deck/DeckEditorPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { ActivityWorkspace } from './components/activity/ActivityWorkspace';
import { NotificationToastHost, SupportMenu, UserRequestModal } from './components/common';
import { useActivityStore } from './stores/activityStore';
import { useChatStore } from './stores/chatStore';
import { createDefaultFilters, useDeckStore } from './stores/deckStore';
import { useAnimationStore } from './stores/animationStore';
import { useGameStore, useLobbyStore, useNotificationStore, useSessionStore } from './stores';
import { wsService } from './services/WebSocketService.js';
import {
  DEFAULT_CLIENT_SETTINGS,
  DECK_EDITOR_MODE_KEYS,
  appConfigService,
  clientSettingsToUserData,
  type DeckEditorModeKey,
} from './services/AppConfigService.js';
import {
  MageObjectType,
  PhaseStep,
  Rarity,
  SkillLevel,
  TableState,
  TurnPhase,
  Zone,
  type BasicLandSetInfo,
  type CardSearchCriteria,
  type ExpansionSetInfo,
  type ObjectColor,
  type UUID,
} from './types/api.js';
import type {
  CardView,
  DeckCardLists,
  GameView,
  PermanentView,
  PlayerView,
  SearchCardView,
  ServerState,
  MatchView,
  RoomUsersView,
  TableView,
  ClientCallback,
  CommandObjectView,
} from './types/index.js';
import type { ClientActivity } from './stores/activityStore';
import type { PendingAction } from './stores/gameStore';

type VisualScenario =
  | 'login'
  | 'lobby'
  | 'waiting-room'
  | 'game'
  | 'multi-opponent-game'
  | 'deck-manager'
  | 'deck-editor'
  | 'replay'
  | 'sideboard'
  | 'limited-sideboard'
  | 'construction'
  | 'post-draft-construction'
  | 'draft'
  | 'tournament'
  | 'settings'
  | 'card-viewer'
  | 'view-sideboard'
  | 'notifications'
  | 'user-request';

type VisualPromptMode =
  | 'ask'
  | 'priority'
  | 'attackers'
  | 'target-list'
  | 'mulligan-bottom'
  | 'player-target'
  | 'order'
  | 'choice'
  | 'ability'
  | 'pile'
  | 'mana'
  | 'xmana'
  | 'amount'
  | 'multi-amount';

function getVisualEditorMode(): DeckEditorModeKey {
  const requestedMode = new URLSearchParams(window.location.search).get('editorMode');
  return DECK_EDITOR_MODE_KEYS.includes(requestedMode as DeckEditorModeKey)
    ? requestedMode as DeckEditorModeKey
    : 'normal';
}

function isVisualReplayMatch(): boolean {
  return new URLSearchParams(window.location.search).get('replay') === '1';
}

function isVisualWatchMatch(): boolean {
  return new URLSearchParams(window.location.search).get('watch') === '1';
}

function isVisualTargetPrompt(): boolean {
  return new URLSearchParams(window.location.search).get('target') === '1';
}

function getVisualPromptMode(): VisualPromptMode | null {
  const requestedPrompt = new URLSearchParams(window.location.search).get('prompt');
  const modes: VisualPromptMode[] = [
    'ask',
    'priority',
    'attackers',
    'target-list',
    'mulligan-bottom',
    'player-target',
    'order',
    'choice',
    'ability',
    'pile',
    'mana',
    'xmana',
    'amount',
    'multi-amount',
  ];
  return modes.includes(requestedPrompt as VisualPromptMode)
    ? requestedPrompt as VisualPromptMode
    : null;
}

const ROOM_ID: UUID = '00000000-0000-0000-0000-000000000101';
const TABLE_ID: UUID = '00000000-0000-0000-0000-000000000102';
const GAME_ID: UUID = '00000000-0000-0000-0000-000000000103';
const VISUAL_ACTIVITY_UPDATED_AT = Date.now();
const MATCH_ID: UUID = '00000000-0000-0000-0000-000000000104';
const TABLE_CHAT_ID: UUID = '00000000-0000-0000-0000-000000000801';
const PLAYER_ID: UUID = '00000000-0000-0000-0000-000000000201';
const OPPONENT_ID: UUID = '00000000-0000-0000-0000-000000000202';
const SECOND_OPPONENT_ID: UUID = '00000000-0000-0000-0000-000000000203';
const THIRD_OPPONENT_ID: UUID = '00000000-0000-0000-0000-000000000204';
const DECK_ID = 'visual-deck';

function makeVisualUserData(overrides: Partial<PlayerView['userData']> = {}): PlayerView['userData'] {
  return {
    ...clientSettingsToUserData(DEFAULT_CLIENT_SETTINGS),
    ...overrides,
  };
}

const COLORLESS: ObjectColor = {
  white: false,
  blue: false,
  black: false,
  red: false,
  green: false,
};

const RED: ObjectColor = {
  white: false,
  blue: false,
  black: false,
  red: true,
  green: false,
};

const GREEN: ObjectColor = {
  white: false,
  blue: false,
  black: false,
  red: false,
  green: true,
};

const BLUE: ObjectColor = {
  white: false,
  blue: true,
  black: false,
  red: false,
  green: false,
};

const WHITE: ObjectColor = {
  white: true,
  blue: false,
  black: false,
  red: false,
  green: false,
};

const BLACK: ObjectColor = {
  white: false,
  blue: false,
  black: true,
  red: false,
  green: false,
};

const EMPTY_MANA_POOL = {
  red: 0,
  green: 0,
  blue: 0,
  white: 0,
  black: 0,
  colorless: 0,
};

const VISUAL_DECK: DeckCardLists = {
  id: DECK_ID,
  name: 'P0 Visual Smoke',
  format: 'Constructed - Pauper',
  cards: [
    { amount: 4, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
    { amount: 4, cardName: 'Llanowar Elves', setCode: 'M12', cardNumber: '182' },
    { amount: 52, cardName: 'Mountain', setCode: 'M11', cardNumber: '244' },
  ],
  sideboard: [
    { amount: 2, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
  ],
  coverCard: { setCode: 'M11', cardNumber: '149', name: 'Lightning Bolt' },
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

const VISUAL_LIMITED_DECK: DeckCardLists = {
  ...VISUAL_DECK,
  format: 'Limited',
};

function shouldUseLegalityOverflowFixture(): boolean {
  return new URLSearchParams(window.location.search).get('legalityOverflow') === '1';
}

function buildPauperValidationErrors() {
  const baseErrors = [
    {
      type: 'OTHER',
      group: 'Mountain',
      message: 'Card not found',
      cardName: 'Mountain',
    },
    {
      type: 'WRONG_SET',
      group: 'Lightning Bolt',
      message: 'Invalid set: M11',
      cardName: 'Lightning Bolt',
    },
    {
      type: 'OTHER',
      group: 'Naturalize',
      message: 'Invalid rarity: no common printing found',
      cardName: 'Naturalize',
    },
    {
      type: 'DECK_SIZE',
      group: 'Deck',
      message: 'Must contain at least 60 cards: has only 6 cards',
      cardName: null,
    },
    {
      type: 'OTHER',
      group: 'Sideboard',
      message: 'Sideboard contains unsupported cards',
      cardName: null,
    },
  ];

  if (!shouldUseLegalityOverflowFixture()) {
    return baseErrors;
  }

  const overflowErrors = Array.from({ length: 21 }, (_, index) => {
    const cardName = index % 2 === 0 ? 'Lightning Bolt' : 'Naturalize';
    return {
      type: 'OTHER',
      group: cardName,
      message: `Desktop tooltip overflow fixture ${index + 1}`,
      cardName,
    };
  });

  return [...baseErrors, ...overflowErrors];
}

function makeCard(
  id: UUID,
  name: string,
  overrides: Partial<CardView> = {},
): CardView {
  return {
    id,
    expansionSetCode: overrides.expansionSetCode ?? 'M11',
    cardNumber: overrides.cardNumber ?? '149',
    usesVariousArt: false,
    gameObject: false,
    isChoosable: false,
    isSelected: false,
    playableStats: { playableAmount: 1 },
    name,
    displayName: name,
    displayFullName: name,
    rules: overrides.rules ?? ['Deal 3 damage to any target.'],
    power: overrides.power ?? '',
    toughness: overrides.toughness ?? '',
    loyalty: '',
    defense: '',
    cardTypes: overrides.cardTypes ?? ['INSTANT'],
    subTypes: overrides.subTypes ?? [],
    superTypes: overrides.superTypes ?? [],
    color: overrides.color ?? RED,
    frameColor: overrides.frameColor ?? RED,
    frameStyle: '',
    manaCostLeftStr: overrides.manaCostLeftStr ?? ['{R}'],
    manaCostRightStr: [],
    manaValue: overrides.manaValue ?? 1,
    rarity: overrides.rarity ?? Rarity.COMMON,
    mageObjectType: overrides.mageObjectType ?? MageObjectType.CARD,
    isToken: false,
    isAbility: false,
    imageFileName: '',
    imageNumber: 0,
    transformable: false,
    transformed: false,
    flipCard: false,
    faceDown: false,
    isSplitCard: false,
    isDoubleFacedCard: false,
    paid: false,
    counters: [],
    controlledByOwner: true,
    zone: overrides.zone ?? Zone.HAND,
    rotate: false,
    hideInfo: false,
    canAttack: false,
    canBlock: false,
    inViewerOnly: false,
    ...overrides,
  };
}

function makePermanent(
  id: UUID,
  name: string,
  overrides: Partial<PermanentView> = {},
): PermanentView {
  const base = makeCard(id, name, {
    zone: Zone.BATTLEFIELD,
    cardTypes: ['Creature'],
    power: '2',
    toughness: '2',
    color: GREEN,
    frameColor: GREEN,
    manaCostLeftStr: ['{1}', '{G}'],
    canAttack: true,
    canBlock: true,
    ...overrides,
  });

  return {
    ...base,
    tapped: false,
    flipped: false,
    phasedIn: true,
    summoningSickness: false,
    damage: 0,
    attachments: [],
    copy: false,
    nameOwner: overrides.nameOwner ?? 'VisualMage',
    nameController: overrides.nameController ?? 'VisualMage',
    controlled: true,
    attachedToPermanent: false,
    attachedControllerDiffers: false,
    morphed: false,
    manifested: false,
    disguised: false,
    cloaked: false,
    ...overrides,
  };
}

function makePlayer(
  playerId: UUID,
  name: string,
  battlefield: Record<UUID, PermanentView>,
  overrides: Partial<PlayerView> = {},
): PlayerView {
  return {
    playerId,
    name,
    controlled: true,
    isHuman: true,
    life: 20,
    counters: [],
    wins: 0,
    winsNeeded: 1,
    libraryCount: 42,
    handCount: 4,
    manaPool: { ...EMPTY_MANA_POOL },
    graveyard: {},
    exile: {},
    sideboard: {},
    helperCards: {},
    battlefield,
    userData: makeVisualUserData(),
    commandList: [],
    commandObjectList: [],
    attachments: [],
    statesSavedSize: 0,
    priorityTimeLeftSecs: 240,
    bufferTimeLeft: 30,
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

function makeGameView(playerCount = 2): GameView {
  const attacker = makePermanent('00000000-0000-0000-0000-000000000301', 'Llanowar Elves', {
    tapped: true,
    power: '1',
    toughness: '1',
    summoningSickness: true,
    counters: [{ name: '+1/+1', count: 1 }],
  });
  const blocker = makePermanent('00000000-0000-0000-0000-000000000302', 'Runeclaw Bear', {
    nameOwner: 'Nissa',
    nameController: 'Nissa',
    power: '2',
    toughness: '2',
  });
  const aura = makePermanent('00000000-0000-0000-0000-000000000304', 'Rancor', {
    cardTypes: ['Enchantment'],
    subTypes: ['Aura'],
    power: '',
    toughness: '',
    color: GREEN,
    frameColor: GREEN,
    attachedTo: attacker.id,
    attachedToPermanent: true,
    canAttack: false,
    canBlock: false,
  });
  const tokenCopy = makePermanent('00000000-0000-0000-0000-000000000305', 'Wolf Token', {
    isToken: true,
    copy: true,
    power: '2',
    toughness: '2',
    attachments: [aura.id],
  });
  const myBattlefield = {
    [attacker.id]: attacker,
    '00000000-0000-0000-0000-000000000303': makePermanent('00000000-0000-0000-0000-000000000303', 'Mountain', {
      cardTypes: ['Land'],
      power: '',
      toughness: '',
      color: COLORLESS,
      frameColor: RED,
      manaCostLeftStr: [],
      tapped: false,
      canAttack: false,
      canBlock: false,
    }),
    [aura.id]: aura,
    [tokenCopy.id]: tokenCopy,
  };
  const opponentBattlefield = {
    [blocker.id]: blocker,
  };
  const players = [
    makePlayer(PLAYER_ID, 'VisualMage', myBattlefield, {
      userData: makeVisualUserData({ avatarId: 51, flagName: 'world.png' }),
      hasPriority: true,
      isActive: true,
      manaPool: { ...EMPTY_MANA_POOL, red: 1, green: 1 },
      counters: [
        { name: 'energy', count: 2 },
        { name: 'experience', count: 1 },
      ],
      commandList: [
        {
          id: '00000000-0000-0000-0000-000000000601',
          name: 'Marwyn, the Nurturer',
          expansionSetCode: 'DOM',
          imageFileName: '',
          imageNumber: 0,
          rules: [],
        },
      ],
      monarch: true,
      priorityTimeLeftSecs: 118,
      bufferTimeLeft: 24,
      timerActive: true,
    }),
    makePlayer(OPPONENT_ID, 'Nissa', opponentBattlefield, {
      userData: makeVisualUserData({ avatarId: 52, flagName: 'mx.png' }),
      controlled: false,
      life: 17,
      handCount: 3,
      counters: [{ name: 'poison', count: 1 }],
      designationNames: ['City Blessing'],
    }),
  ];

  if (playerCount > 2) {
    players.push(
      makePlayer(SECOND_OPPONENT_ID, 'Jace', {}, {
        userData: makeVisualUserData({ avatarId: 53, flagName: 'jp.png' }),
        controlled: false,
        life: 14,
        handCount: 6,
        counters: [{ name: 'rad', count: 3 }],
        initiative: true,
      }),
      makePlayer(THIRD_OPPONENT_ID, 'Chandra', {}, {
        userData: makeVisualUserData({ avatarId: 54, flagName: 'us.png' }),
        controlled: false,
        life: 9,
        handCount: 2,
        counters: [{ name: 'charge', count: 4 }],
        hasLeft: true,
      }),
    );
  }

  const handCard = makeCard('00000000-0000-0000-0000-000000000401', 'Lightning Bolt');
  const stackCard = makeCard('00000000-0000-0000-0000-000000000402', 'Shock', {
    mageObjectType: MageObjectType.ABILITY_STACK_FROM_CARD,
    isAbility: true,
    rules: ['Shock deals 2 damage to any target.'],
  });
  const graveyardCard = makeCard('00000000-0000-0000-0000-000000000404', 'Opt', {
    expansionSetCode: 'XLN',
    cardNumber: '65',
    color: BLUE,
    frameColor: BLUE,
    rules: ['Scry 1. Draw a card.'],
  });
  const revealedCard = makeCard('00000000-0000-0000-0000-000000000405', 'Counterspell', {
    expansionSetCode: 'EMA',
    cardNumber: '43',
    color: BLUE,
    frameColor: BLUE,
    rules: ['Counter target spell.'],
  });
  const companionCard = makeCard('00000000-0000-0000-0000-000000000406', 'Kaheera, the Orphanguard', {
    expansionSetCode: 'IKO',
    cardNumber: '224',
    color: GREEN,
    frameColor: GREEN,
  });
  const emblemCard = makeCard('00000000-0000-0000-0000-000000000407', 'Chandra Emblem', {
    expansionSetCode: 'TM20',
    cardNumber: '13',
    mageObjectType: MageObjectType.EMBLEM,
  });
  const commandEmblem: CommandObjectView = {
    id: '00000000-0000-0000-0000-000000000409',
    name: 'Teferi Emblem',
    expansionSetCode: 'TM21',
    imageFileName: '',
    imageNumber: 21,
    rules: ["You may activate loyalty abilities of planeswalkers you control on any player's turn any time you could cast an instant."],
  };
  const commanderCommandObject: CommandObjectView & { mageObjectType: MageObjectType } = {
    id: '00000000-0000-0000-0000-000000000601',
    name: 'Marwyn, the Nurturer',
    expansionSetCode: 'DOM',
    imageFileName: '',
    imageNumber: 0,
    rules: ['Whenever another Elf enters the battlefield under your control, put a +1/+1 counter on Marwyn, the Nurturer.'],
    mageObjectType: MageObjectType.COMMANDER,
  };
  const dungeonCommandObject: CommandObjectView = {
    id: '00000000-0000-0000-0000-000000000410',
    name: 'Undercity',
    expansionSetCode: 'CLB',
    imageFileName: '',
    imageNumber: 20,
    rules: ['Secret Entrance', 'Forge', 'Trap!'],
  };
  const planeCommandObject: CommandObjectView = {
    id: '00000000-0000-0000-0000-000000000411',
    name: 'Panopticon',
    expansionSetCode: 'PCA',
    imageFileName: '',
    imageNumber: 62,
    rules: ['When you planeswalk to Panopticon, draw a card.'],
  };
  const exileCard = makeCard('00000000-0000-0000-0000-000000000408', 'Faithless Looting', {
    expansionSetCode: 'EMA',
    cardNumber: '128',
    color: RED,
    frameColor: RED,
  });
  players[0].commandObjectList = [
    ...(players[0].commandObjectList ?? []),
    commanderCommandObject,
    commandEmblem,
    dungeonCommandObject,
    planeCommandObject,
  ];
  players[1].commandObjectList = [
    ...(players[1].commandObjectList ?? []),
    planeCommandObject,
  ];
  players[0].graveyard = { [graveyardCard.id]: graveyardCard };
  players[0].sideboard = { [companionCard.id]: companionCard };
  players[1].exile = { [exileCard.id]: exileCard };
  players[1].topCard = revealedCard;

  return {
    priorityTime: 240,
    bufferTime: 30,
    players,
    myPlayerId: PLAYER_ID,
    myHand: {
      [handCard.id]: handCard,
      '00000000-0000-0000-0000-000000000403': makeCard('00000000-0000-0000-0000-000000000403', 'Giant Growth', {
        expansionSetCode: 'M11',
        cardNumber: '177',
        color: GREEN,
        frameColor: GREEN,
        manaCostLeftStr: ['{G}'],
        rules: ['Target creature gets +3/+3 until end of turn.'],
      }),
    },
    myHelperEmblems: { [emblemCard.id]: emblemCard },
    canPlayObjects: { objects: { [graveyardCard.id]: { playableAmount: 1 }, [tokenCopy.id]: { playableAmount: 1 } } },
    opponentHands: { [OPPONENT_ID]: { [revealedCard.id]: revealedCard } },
    watchedHands: { [SECOND_OPPONENT_ID]: { [handCard.id]: handCard } },
    stack: {
      [stackCard.id]: stackCard,
    },
    exiles: [{ id: '00000000-0000-0000-0000-000000000501', name: 'Temporary Exile', cards: { [exileCard.id]: exileCard } }],
    revealed: [{ name: 'Revealed to all', cards: { [revealedCard.id]: revealedCard } }],
    lookedAt: [{ name: 'Looked at cards', cards: { [handCard.id]: handCard } }],
    companion: [{ name: 'Companion', cards: { [companionCard.id]: companionCard } }],
    combat: [{
      defenders: [OPPONENT_ID],
      attackers: { [attacker.id]: attacker },
      blockers: { [blocker.id]: blocker },
      isBlocked: true,
      defenderName: 'Nissa',
      defenderId: OPPONENT_ID,
    }],
    phase: TurnPhase.COMBAT,
    step: PhaseStep.DECLARE_ATTACKERS,
    activePlayerId: PLAYER_ID,
    activePlayerName: 'VisualMage',
    priorityPlayerName: 'VisualMage',
    turn: 4,
    special: false,
    rollbackTurnsAllowed: true,
    attackOption: playerCount > 2 ? 'RIGHT' : 'MULTIPLE',
    rangeOfInfluence: playerCount > 2 ? 'TWO' : 'ALL',
    totalErrorsCount: 0,
    totalEffectsCount: 7,
    gameCycle: 12,
  };
}

function makePromptFixture(
  mode: VisualPromptMode | null,
  gameView: GameView,
): { pendingAction: PendingAction; selectedCardId: UUID | null } {
  const handCards = Object.values(gameView.myHand) as CardView[];
  const graveyardCards = Object.values(gameView.players[0]?.graveyard ?? {}) as CardView[];
  const revealedCards = Object.values(gameView.revealed[0]?.cards ?? {}) as CardView[];
  const promptCards = [...handCards, ...graveyardCards, ...revealedCards].reduce<Record<string, CardView>>((cards, card) => {
    cards[card.id] = card;
    return cards;
  }, {});
  const firstHandCard = handCards[0];
  const secondHandCard = handCards[1];
  const graveyardCard = graveyardCards[0];
  const revealedCard = revealedCards[0];

  switch (mode) {
    case 'ask':
      return {
        pendingAction: {
          type: 'ask',
          message: 'Pay 2 life to keep this triggered ability?',
          gameView,
          options: {
            originalId: 'visual-ask-ability',
            autoAnswerMessage: 'Pay 2 life to keep this triggered ability?',
          },
        },
        selectedCardId: null,
      };
    case 'priority':
      return {
        pendingAction: {
          type: 'priority',
          message: 'Play spells and abilities',
          gameView,
          options: {
            'UI.right.btn.text': 'Done',
          },
        },
        selectedCardId: null,
      };
    case 'attackers':
      return {
        pendingAction: {
          type: 'select',
          message: 'Select attackers',
          gameView: {
            ...gameView,
            step: PhaseStep.DECLARE_ATTACKERS,
          },
          required: false,
          min: 0,
          max: 1,
        },
        selectedCardId: null,
      };
    case 'target-list':
      return {
        pendingAction: {
          type: 'target',
          message: 'Choose up to one card from a large prompt list.',
          validTargets: [firstHandCard.id, graveyardCard.id],
          gameView,
          required: false,
          min: 0,
          max: 1,
          cardsView: promptCards,
        },
        selectedCardId: graveyardCard.id,
      };
    case 'mulligan-bottom':
      return {
        pendingAction: {
          type: 'select',
          message: 'Select a card (1 more) to put on the bottom of your library',
          gameView,
          required: true,
          min: 1,
          max: 1,
        },
        selectedCardId: null,
      };
    case 'player-target':
      return {
        pendingAction: {
          type: 'target',
          message: 'Choose target player.',
          validTargets: [OPPONENT_ID],
          gameView,
          required: true,
          min: 1,
          max: 1,
        },
        selectedCardId: null,
      };
    case 'order':
      return {
        pendingAction: {
          type: 'select',
          message: 'Choose a card to put on the top of your graveyard. Last one chosen will be topmost.',
          gameView,
          required: true,
          min: 1,
          max: 1,
          orderSelection: true,
          cardsView: {
            [firstHandCard.id]: firstHandCard,
            [secondHandCard.id]: secondHandCard,
            [graveyardCard.id]: graveyardCard,
          },
        },
        selectedCardId: null,
      };
    case 'choice':
      return {
        pendingAction: {
          type: 'chooseChoice',
          message: 'Choose a mana color or enter a custom empty-safe value.',
          choices: ['White', 'Blue', 'Black', 'Red', 'Green'],
          keyChoices: {
            W: 'White',
            U: 'Blue',
            B: 'Black',
            R: 'Red',
            G: 'Green',
          },
          hintData: {
            W: ['Plains', 'lifegain'],
            U: ['Island', 'card draw'],
            B: ['Swamp', 'graveyard'],
            R: ['Mountain', 'damage'],
            G: ['Forest', 'creatures'],
          },
          hintType: 'TEXT',
          required: false,
          specialEnabled: true,
          specialCanBeEmpty: true,
          specialText: 'Custom text value',
          specialHint: 'Special values may be empty',
          searchEnabled: true,
          manaColorChoice: true,
        },
        selectedCardId: null,
      };
    case 'ability':
      return {
        pendingAction: {
          type: 'chooseAbility',
          abilities: {
            message: 'Choose spell or ability to play<br><font color="#f8fafc">Chandra, Hope Beacon</font>',
            choices: {
              '00000000-0000-0000-0000-000000000901': '1. +1: Add two mana in any combination of colors.',
              '00000000-0000-0000-0000-000000000902': '2. -2: Chandra deals 3 damage to each of up to two targets.',
            },
          },
        },
        selectedCardId: null,
      };
    case 'pile':
      return {
        pendingAction: {
          type: 'choosePile',
          message: 'Choose one pile to put into your hand.',
          pile1: { [firstHandCard.id]: firstHandCard, [graveyardCard.id]: graveyardCard },
          pile2: { [secondHandCard.id]: secondHandCard, [revealedCard.id]: revealedCard },
          gameView,
        },
        selectedCardId: null,
      };
    case 'mana':
      return {
        pendingAction: {
          type: 'mana',
          message: 'Pay {R}{G} using mana from your pool or tapped lands.',
          gameView,
        },
        selectedCardId: null,
      };
    case 'xmana':
      return {
        pendingAction: {
          type: 'xmana',
          message: 'Choose and pay X mana.',
          gameView,
        },
        selectedCardId: null,
      };
    case 'amount':
      return {
        pendingAction: {
          type: 'amount',
          message: 'Choose X for the spell.',
          min: 0,
          max: 7,
          gameView,
        },
        selectedCardId: null,
      };
    case 'multi-amount':
      return {
        pendingAction: {
          type: 'multiAmount',
          min: 0,
          max: 4,
          gameView,
          messages: [
            { message: 'Damage assigned to Runeclaw Bear', min: 0, max: 4, defaultValue: 2 },
            { message: 'Damage assigned to Nissa', min: 0, max: 4, defaultValue: 2 },
          ],
        },
        selectedCardId: null,
      };
    default:
      return {
        pendingAction: {
          type: 'chooseChoice',
          message: 'Choose combat damage assignment order',
          choices: ['Assign damage to Nissa', 'Hold priority', 'Cancel attack'],
          keyChoices: { '1': 'Assign damage to Nissa', '2': 'Hold priority', '3': 'Cancel attack' },
        },
        selectedCardId: null,
      };
  }
}

function makeTable(tableState: TableState, tableStateText: string): TableView {
  return {
    tableId: TABLE_ID,
    tableName: 'P0 Smoke Table',
    controllerName: 'VisualMage',
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Pauper',
    spectatorsAllowed: true,
    createTime: new Date('2026-06-21T00:00:00Z').toISOString(),
    tableState,
    tableStateText,
    seats: [
      { seatNum: 0, name: 'VisualMage', playerType: 'Human' },
      { seatNum: 1, name: tableState === TableState.READY_TO_START ? 'Computer' : '', playerType: 'Human' },
    ],
    games: tableState === TableState.DUELING ? [GAME_ID] : [],
    seatsInfo: tableState === TableState.READY_TO_START ? '2/2' : '1/2',
    isTournament: false,
    additionalInfoShort: 'Pauper duel',
    additionalInfoFull: 'P0 visual smoke table with spectators enabled.',
    skillLevel: SkillLevel.CASUAL,
    quitRatio: '100%',
    minimumRating: '0',
    limited: false,
    rated: false,
    passworded: false,
  };
}

const WAITING_TABLE = makeTable(TableState.WAITING, 'Waiting');
const READY_TABLE = makeTable(TableState.READY_TO_START, 'Ready to start');
const DUELING_TABLE = makeTable(TableState.DUELING, 'Dueling');

const FINISHED_MATCH: MatchView = {
  tableId: '00000000-0000-0000-0000-000000000105',
  matchId: MATCH_ID,
  matchName: 'P0 Replay Match',
  gameType: 'Two Player Duel',
  deckType: 'Constructed - Pauper',
  games: [GAME_ID],
  result: 'VisualMage won 2-0',
  players: 'VisualMage - Sparring Bot',
  startTime: new Date('2026-06-21T00:20:00Z').toISOString(),
  endTime: new Date('2026-06-21T00:42:00Z').toISOString(),
  replayAvailable: true,
  isTournament: false,
  isRated: false,
};

const ROOM_USERS: RoomUsersView = {
  numberActiveGames: 2,
  numberGameThreads: 1,
  numberMaxGames: 10,
  usersView: [
    {
      flagName: 'world.png',
      userName: 'VisualMage',
      matchHistory: '12-4',
      matchQuitRatio: 0,
      tourneyHistory: '3-1',
      tourneyQuitRatio: 0,
      infoGames: 'In lobby',
      infoPing: '24 ms',
      generalRating: 1600,
      constructedRating: 1625,
      limitedRating: 1510,
    },
    {
      flagName: 'mx.png',
      userName: 'SparringBot',
      matchHistory: '4-8',
      matchQuitRatio: 2,
      tourneyHistory: '0-0',
      tourneyQuitRatio: 0,
      infoGames: 'Dueling',
      infoPing: '31 ms',
      generalRating: 1450,
      constructedRating: 1410,
      limitedRating: 1495,
    },
  ],
};

const SERVER_STATE: ServerState = {
  gameTypes: [],
  tournamentTypes: [],
  playerTypes: ['Human', 'Computer - mad'],
  deckTypes: ['Constructed - Pauper', 'Constructed - Standard', 'Penny Dreadful Commander'],
  draftCubes: ['Modern Cube'],
  testMode: true,
  version: { major: 1, minor: 4, patch: 58, info: 'visual' },
  cardsContentVersion: 1,
  expansionsContentVersion: 1,
};

const SEARCH_RESULTS: SearchCardView[] = [
  makeCard('00000000-0000-0000-0000-000000000601', 'Lightning Bolt') as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000602', 'Llanowar Elves', {
    expansionSetCode: 'M12',
    cardNumber: '182',
    cardTypes: ['CREATURE'],
    color: GREEN,
    frameColor: GREEN,
    manaCostLeftStr: ['{G}'],
    manaValue: 1,
    power: '1',
    toughness: '1',
    rules: ['{T}: Add {G}.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000603', 'Elvish Visionary', {
    expansionSetCode: 'M13',
    cardNumber: '170',
    cardTypes: ['CREATURE'],
    color: GREEN,
    frameColor: GREEN,
    manaCostLeftStr: ['{1}', '{G}'],
    manaValue: 2,
    power: '1',
    toughness: '1',
    rules: ['When Elvish Visionary enters, draw a card.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000604', 'Giant Growth', {
    expansionSetCode: 'M11',
    cardNumber: '183',
    cardTypes: ['INSTANT'],
    color: GREEN,
    frameColor: GREEN,
    manaCostLeftStr: ['{G}'],
    manaValue: 1,
    rules: ['Target creature gets +3/+3 until end of turn.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000605', 'Naturalize', {
    expansionSetCode: 'M11',
    cardNumber: '190',
    cardTypes: ['INSTANT'],
    color: GREEN,
    frameColor: GREEN,
    manaCostLeftStr: ['{1}', '{G}'],
    manaValue: 2,
    rules: ['Destroy target artifact or enchantment.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000606', 'Opt', {
    expansionSetCode: 'XLN',
    cardNumber: '65',
    cardTypes: ['INSTANT'],
    color: BLUE,
    frameColor: BLUE,
    manaCostLeftStr: ['{U}'],
    manaValue: 1,
    rules: ['Scry 1. Draw a card.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000607', 'Opt', {
    expansionSetCode: 'DOM',
    cardNumber: '60',
    cardTypes: ['INSTANT'],
    color: BLUE,
    frameColor: BLUE,
    manaCostLeftStr: ['{U}'],
    manaValue: 1,
    rules: ['Scry 1. Draw a card.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000608', 'Legendary Spell', {
    expansionSetCode: 'TST',
    cardNumber: '8',
    superTypes: ['LEGENDARY'],
    rules: ['Create a token.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000609', 'Serra Angel', {
    expansionSetCode: 'M11',
    cardNumber: '28',
    cardTypes: ['CREATURE'],
    color: WHITE,
    frameColor: WHITE,
    manaCostLeftStr: ['{3}', '{W}', '{W}'],
    manaValue: 5,
    power: '4',
    toughness: '4',
    rules: ['Flying, vigilance'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-00000000060a', 'Doom Blade', {
    expansionSetCode: 'M11',
    cardNumber: '95',
    cardTypes: ['INSTANT'],
    color: BLACK,
    frameColor: BLACK,
    manaCostLeftStr: ['{1}', '{B}'],
    manaValue: 2,
    rules: ['Destroy target nonblack creature.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-00000000060b', 'Divination', {
    expansionSetCode: 'M11',
    cardNumber: '51',
    cardTypes: ['SORCERY'],
    color: BLUE,
    frameColor: BLUE,
    manaCostLeftStr: ['{2}', '{U}'],
    manaValue: 3,
    rules: ['Draw two cards.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-00000000060c', 'Pacifism', {
    expansionSetCode: 'M11',
    cardNumber: '24',
    cardTypes: ['ENCHANTMENT'],
    color: WHITE,
    frameColor: WHITE,
    manaCostLeftStr: ['{1}', '{W}'],
    manaValue: 2,
    rules: ['Enchant creature. Enchanted creature can not attack or block.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-00000000060d', 'Juggernaut', {
    expansionSetCode: 'M11',
    cardNumber: '211',
    cardTypes: ['ARTIFACT'],
    color: COLORLESS,
    frameColor: COLORLESS,
    manaCostLeftStr: ['{4}'],
    manaValue: 4,
    power: '5',
    toughness: '3',
    rules: ['Juggernaut attacks each combat if able.'],
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-00000000060e', 'Evolving Wilds', {
    expansionSetCode: 'M11',
    cardNumber: '225',
    cardTypes: ['LAND'],
    color: COLORLESS,
    frameColor: COLORLESS,
    manaCostLeftStr: [],
    manaValue: 0,
    rules: ['Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.'],
  }) as unknown as SearchCardView,
];
const INITIAL_SEARCH_RESULTS = SEARCH_RESULTS.slice(0, 2);

const BASIC_LAND_SEARCH_RESULTS: SearchCardView[] = [
  makeCard('00000000-0000-0000-0000-000000000611', 'Mountain', {
    expansionSetCode: 'M11',
    cardNumber: '244',
    cardTypes: ['LAND'],
    superTypes: ['BASIC'],
    manaCostLeftStr: [],
    manaValue: 0,
    rarity: Rarity.LAND,
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000612', 'Forest', {
    expansionSetCode: 'BFZ',
    cardNumber: '270',
    cardTypes: ['LAND'],
    superTypes: ['BASIC'],
    color: GREEN,
    frameColor: GREEN,
    imageFileName: 'forest-full-art.jpg',
    manaCostLeftStr: [],
    manaValue: 0,
    rarity: Rarity.LAND,
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000613', 'Forest', {
    expansionSetCode: 'M15',
    cardNumber: '271',
    cardTypes: ['LAND'],
    superTypes: ['BASIC'],
    color: GREEN,
    frameColor: GREEN,
    manaCostLeftStr: [],
    manaValue: 0,
    rarity: Rarity.LAND,
  }) as unknown as SearchCardView,
  makeCard('00000000-0000-0000-0000-000000000614', 'Snow-Covered Forest', {
    expansionSetCode: 'ICE',
    cardNumber: '383',
    cardTypes: ['LAND'],
    superTypes: ['SNOW'],
    color: GREEN,
    frameColor: GREEN,
    manaCostLeftStr: [],
    manaValue: 0,
    rarity: Rarity.LAND,
  }) as unknown as SearchCardView,
];

const BASIC_LAND_SETS: BasicLandSetInfo[] = [
  {
    setCode: 'M11',
    name: 'Magic 2011',
    blockName: null,
    releaseDate: 1_279_872_000_000,
    hasBasicLands: true,
    hasSnowBasics: false,
  },
  {
    setCode: 'BFZ',
    name: 'Battle for Zendikar',
    blockName: null,
    releaseDate: 1_443_129_600_000,
    hasBasicLands: true,
    hasSnowBasics: false,
  },
  {
    setCode: 'M15',
    name: 'Magic 2015',
    blockName: null,
    releaseDate: 1_405_641_600_000,
    hasBasicLands: true,
    hasSnowBasics: false,
  },
  {
    setCode: 'ICE',
    name: 'Ice Age',
    blockName: null,
    releaseDate: 803_520_000_000,
    hasBasicLands: true,
    hasSnowBasics: true,
  },
];

const EXPANSION_SETS: ExpansionSetInfo[] = [
  {
    setCode: 'DMU',
    name: 'Dominaria United',
    blockName: null,
    releaseDate: 1_662_595_200_000,
    type: 'EXPANSION',
    hasBoosters: true,
    hasBasicLands: false,
  },
  ...BASIC_LAND_SETS,
];

function isLandSearch(criteria: CardSearchCriteria): boolean {
  return Boolean(criteria.types?.includes('LAND') || criteria.rarities?.includes(Rarity.LAND));
}

function criteriaHasColor(criteria: CardSearchCriteria): boolean {
  return Boolean(criteria.white || criteria.blue || criteria.black || criteria.red || criteria.green || criteria.colorless);
}

function cardMatchesCriteriaColor(card: SearchCardView, criteria: CardSearchCriteria): boolean {
  if (!criteriaHasColor(criteria)) return true;
  const color = card.color ?? COLORLESS;
  if (criteria.colorless && !color.white && !color.blue && !color.black && !color.red && !color.green) return true;
  return Boolean(
    (criteria.white && color.white)
    || (criteria.blue && color.blue)
    || (criteria.black && color.black)
    || (criteria.red && color.red)
    || (criteria.green && color.green)
  );
}

function getSearchResults(criteria: CardSearchCriteria): SearchCardView[] {
  const hasSearchConstraints = Boolean(
    criteria.nameContains
    || criteria.rules
    || (criteria.count && criteria.count > 200)
    || criteriaHasColor(criteria)
    || criteria.types?.length
    || criteria.notTypes?.length
    || criteria.rarities?.length
    || criteria.setCodes?.length
    || criteria.manaValue !== undefined
  );
  if (!isLandSearch(criteria) && !hasSearchConstraints) {
    return INITIAL_SEARCH_RESULTS;
  }

  const source = isLandSearch(criteria) ? BASIC_LAND_SEARCH_RESULTS : SEARCH_RESULTS;
  return source.filter(card => {
    if (criteria.nameContains && !card.name.toLowerCase().includes(criteria.nameContains.toLowerCase())) return false;
    if (criteria.rules && !card.rules.join(' ').toLowerCase().includes(criteria.rules.toLowerCase())) return false;
    if (!cardMatchesCriteriaColor(card, criteria)) return false;
    if (criteria.types?.length && !criteria.types.every(type => card.cardTypes.includes(type))) return false;
    if (criteria.notTypes?.length && !criteria.notTypes.every(type => !card.cardTypes.includes(type))) return false;
    if (criteria.rarities?.length && !criteria.rarities.includes(card.rarity)) return false;
    if (criteria.setCodes?.length && !criteria.setCodes.includes(card.expansionSetCode)) return false;
    if (criteria.manaValue !== undefined && card.manaValue !== criteria.manaValue) return false;
    return true;
  });
}

type VisualActivityScenario =
  | 'replay'
  | 'sideboard'
  | 'limited-sideboard'
  | 'construction'
  | 'post-draft-construction'
  | 'draft'
  | 'tournament'
  | 'card-viewer'
  | 'view-sideboard';

const ACTIVITY_SCENARIOS: Record<VisualActivityScenario, ClientActivity> = {
  replay: {
    id: 'replay:visual',
    kind: 'replay',
    title: 'Replay - Visual Match',
    objectId: '00000000-0000-0000-0000-000000000700',
    status: 'active',
    lastCallbackMethod: 'replayInit',
    lastMessageId: 10,
    updatedAt: VISUAL_ACTIVITY_UPDATED_AT,
  },
  sideboard: {
    id: 'sideboard:visual',
    kind: 'sideboard',
    title: 'Sideboarding',
    objectId: TABLE_ID,
    status: 'waiting',
    lastCallbackMethod: 'sideboard',
    lastMessageId: 10,
    updatedAt: VISUAL_ACTIVITY_UPDATED_AT,
    deck: VISUAL_DECK,
    time: 90,
  },
  'limited-sideboard': {
    id: 'sideboard:visual-limited',
    kind: 'sideboard',
    title: 'Limited sideboarding',
    objectId: TABLE_ID,
    status: 'waiting',
    lastCallbackMethod: 'sideboard',
    lastMessageId: 14,
    updatedAt: VISUAL_ACTIVITY_UPDATED_AT,
    deck: VISUAL_LIMITED_DECK,
    limitedSideboard: true,
    time: 90,
  },
  construction: {
    id: 'construction:visual',
    kind: 'construction',
    title: 'Limited Deck Construction',
    objectId: TABLE_ID,
    status: 'waiting',
    lastCallbackMethod: 'construct',
    lastMessageId: 10,
    updatedAt: VISUAL_ACTIVITY_UPDATED_AT,
    deck: VISUAL_LIMITED_DECK,
    time: 120,
  },
  'post-draft-construction': {
    id: `construction:${TABLE_ID}`,
    kind: 'construction',
    title: 'Deck construction',
    objectId: TABLE_ID,
    status: 'waiting',
    lastCallbackMethod: 'construct',
    lastMessageId: 22,
    updatedAt: VISUAL_ACTIVITY_UPDATED_AT,
    deck: {
      id: 'visual-post-draft-shell',
      name: 'Post Draft Construction',
      format: 'Limited',
      cards: [
        { amount: 1, cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
        { amount: 1, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
      ],
      sideboard: [],
      createdAt: 1_700_000_100_000,
      updatedAt: 1_700_000_100_000,
    },
    time: 75,
  },
  draft: {
    id: 'draft:visual',
    kind: 'draft',
    title: 'Booster Draft - Pack 1 Pick 3',
    objectId: '00000000-0000-0000-0000-000000000701',
    status: 'active',
    lastCallbackMethod: 'draftPick',
    lastMessageId: 11,
    updatedAt: 1_700_000_100_000,
    deck: VISUAL_DECK,
    time: 45,
  },
  tournament: {
    id: 'tournament:visual',
    kind: 'tournament',
    title: 'Friday Night Pauper',
    objectId: '00000000-0000-0000-0000-000000000702',
    status: 'waiting',
    lastCallbackMethod: 'tournamentUpdate',
    lastMessageId: 12,
    updatedAt: 1_700_000_100_000,
  },
  'card-viewer': {
    id: 'card-viewer:visual',
    kind: 'card-viewer',
    title: 'Viewed limited deck',
    objectId: TABLE_ID,
    status: 'active',
    lastCallbackMethod: 'viewLimitedDeck',
    lastMessageId: 13,
    updatedAt: VISUAL_ACTIVITY_UPDATED_AT,
    deck: VISUAL_LIMITED_DECK,
  },
  'view-sideboard': {
    id: 'card-viewer:sideboard:visual',
    kind: 'card-viewer',
    title: 'Viewed sideboard - Visual Opponent',
    objectId: GAME_ID,
    status: 'active',
    lastCallbackMethod: 'viewSideboard',
    lastMessageId: 15,
    updatedAt: VISUAL_ACTIVITY_UPDATED_AT,
    deck: {
      id: 'visual-sideboard-view',
      name: 'Visual Opponent sideboard',
      cards: [],
      sideboard: [
        { amount: 2, cardName: 'Naturalize', setCode: 'M11', cardNumber: '190' },
        { amount: 1, cardName: 'Forest', setCode: 'M11', cardNumber: '248' },
      ],
    },
  },
};

function visualCallback(
  method: ClientCallback['method'],
  messageId: number,
  objectId: UUID | null,
  data: unknown,
): ClientCallback {
  return { method, messageId, objectId, data };
}

function seedPostDraftConstructionActivity() {
  const activityStore = useActivityStore.getState();

  activityStore.handleCallback(visualCallback('draftPick', 20, '00000000-0000-0000-0000-000000000703', {
    draftPickView: {
      booster: {},
      picks: {
        pick1: {
          cardName: 'Lightning Bolt',
          expansionSetCode: 'M11',
          cardNumber: '149',
        },
        pick2: {
          cardName: 'Naturalize',
          expansionSetCode: 'M11',
          cardNumber: '190',
        },
      },
      picking: false,
      timeout: 0,
      message: 'Draft picks complete.',
    },
  }));
  activityStore.handleCallback(visualCallback('draftOver', 21, '00000000-0000-0000-0000-000000000703', {
    draftPickView: {
      booster: {},
      picks: {
        pick1: {
          cardName: 'Lightning Bolt',
          expansionSetCode: 'M11',
          cardNumber: '149',
        },
        pick2: {
          cardName: 'Naturalize',
          expansionSetCode: 'M11',
          cardNumber: '190',
        },
      },
      picking: false,
      timeout: 0,
      message: 'Draft complete.',
    },
  }));
  activityStore.handleCallback(visualCallback('construct', 22, TABLE_ID, {
    currentTableId: TABLE_ID,
    time: 75,
    deck: {
      id: 'visual-post-draft-shell',
      name: 'Post Draft Construction',
      cards: [],
      sideboard: [],
      createdAt: 1_700_000_100_000,
      updatedAt: 1_700_000_100_000,
    },
  }));
}

const CORE_ACTIVITY_LIST = [
  ACTIVITY_SCENARIOS.draft,
  ACTIVITY_SCENARIOS.tournament,
  ACTIVITY_SCENARIOS['card-viewer'],
];

function seedDeckStorage() {
  localStorage.setItem(`mage_deck_${DECK_ID}`, JSON.stringify(VISUAL_DECK));
  localStorage.setItem('mage_decks_meta', JSON.stringify([{
    id: DECK_ID,
    name: VISUAL_DECK.name,
    format: VISUAL_DECK.format,
    updatedAt: VISUAL_DECK.updatedAt,
    cardCount: 60,
    sideboardCount: 2,
    coverCard: VISUAL_DECK.coverCard,
  }]));
}

function mockWebSocket() {
  const visualWindow = window as typeof window & { __mageVisualSends?: Array<{ method: string; params: unknown[] }> };
  visualWindow.__mageVisualSends = [];

  const send = async <T = unknown>(method: string, params: unknown[] = []): Promise<T> => {
    visualWindow.__mageVisualSends?.push({ method, params });

    switch (method) {
      case 'serverGetMainRoomId':
        return ROOM_ID as T;
      case 'getServerState':
        return SERVER_STATE as T;
      case 'getDeckTypes':
        return SERVER_STATE.deckTypes as T;
      case 'getExpansionSets':
        return EXPANSION_SETS as T;
      case 'getBasicLandSets':
        return BASIC_LAND_SETS as T;
      case 'roomGetAllTables':
        return [WAITING_TABLE, DUELING_TABLE] as T;
      case 'roomGetTableById':
        return READY_TABLE as T;
      case 'roomGetFinishedMatches':
        return [FINISHED_MATCH] as T;
      case 'roomGetUsers':
        return [ROOM_USERS] as T;
      case 'chatFindByRoom':
      case 'chatFindByTable':
      case 'chatFindByGame':
      case 'chatFindByTournament':
        return TABLE_CHAT_ID as T;
      case 'searchCards':
        return getSearchResults((params[0] ?? {}) as CardSearchCriteria) as T;
      case 'deckValidate': {
        const deckType = String(params[0] ?? '');
        if (deckType === 'Constructed - Pauper') {
          return {
            deckType,
            name: 'Pauper',
            shortName: 'Pauper',
            valid: false,
            partlyValid: false,
            errors: buildPauperValidationErrors(),
            edhPowerLevel: 0,
            edhPowerCards: [],
            edhPowerDetails: [],
            commanderBrackets: [],
          } as T;
        }
        const isCommanderValidation = deckType === 'Commander' || deckType === 'Variant Magic - Commander';
        const commanderBrackets = isCommanderValidation
          ? [1, 2, 3, 4, 5].map(level => ({
            level,
            name: `Bracket ${level}`,
            shortName: `B${level}`,
            valid: level >= 4,
            badCards: level >= 4 ? [] : ['Lightning Bolt'],
            groups: [{
              name: 'Game Changers',
              count: 1,
              max: level >= 4 ? 99 : 0,
              cards: ['Lightning Bolt'],
            }],
          }))
          : [];
        return {
          deckType,
          name: deckType,
          shortName: isCommanderValidation ? 'Commander' : deckType.replace(/^Constructed - /, ''),
          valid: true,
          partlyValid: true,
          errors: [],
          edhPowerLevel: isCommanderValidation ? 4 : 0,
          edhPowerCards: isCommanderValidation ? ['Lightning Bolt'] : [],
          edhPowerDetails: isCommanderValidation ? ['+4 from Lightning Bolt'] : [],
          commanderBrackets,
        } as T;
      }
      case 'roomCreateTable':
        return WAITING_TABLE as T;
      case 'matchStart':
      case 'tournamentStart':
      case 'roomJoinTable':
      case 'chatJoin':
      case 'chatLeave':
      case 'chatSendMessage':
      case 'sendPlayerAction':
      case 'sendPlayerUUID':
      case 'gameJoin':
        return true as T;
      default:
        console.info('[VisualHarness] Mocked WebSocket method', method, params);
        return true as T;
    }
  };

  wsService.send = send;
  wsService.searchCards = async (criteria: CardSearchCriteria) => getSearchResults(criteria);
}

function resetStores(scenario: VisualScenario) {
  mockWebSocket();
  seedDeckStorage();
  const editorMode = getVisualEditorMode();
  const editorConfig = {
    ...appConfigService.loadDeckEditorConfig(),
    activeMode: editorMode,
  };

  useSessionStore.setState({
    serverUrl: 'ws://localhost:17172',
    connectionStatus: scenario === 'login' ? 'disconnected' : 'connected',
    sessionId: 'visual-session',
    lastSessionId: 'visual-session',
    userName: scenario === 'login' ? null : 'VisualMage',
    userData: scenario === 'login' ? null : clientSettingsToUserData(DEFAULT_CLIENT_SETTINGS),
    isAuthenticated: scenario !== 'login',
    isRestoring: false,
    mainRoomId: scenario === 'login' ? null : ROOM_ID,
    lastError: null,
  });

  useLobbyStore.setState({
    tables: [WAITING_TABLE, DUELING_TABLE],
    filteredTables: [WAITING_TABLE, DUELING_TABLE],
    finishedMatches: [FINISHED_MATCH],
    filteredFinishedMatches: [],
    roomUsers: ROOM_USERS,
    selectedTableId: scenario === 'lobby' ? WAITING_TABLE.tableId : null,
    currentTable: scenario === 'waiting-room' ? READY_TABLE : null,
    isLoading: false,
    isJoining: false,
  });

  const gameChatMessages = [
    {
      id: 'visual-game-chat-status',
      timestamp: new Date('2026-06-21T00:03:00Z'),
      userName: 'System',
      message: 'Declare attackers step.',
      type: 'status' as const,
    },
    {
      id: 'visual-game-chat-user',
      timestamp: new Date('2026-06-21T00:04:00Z'),
      userName: 'Nissa',
      message: 'Blocks with Runeclaw Bear.',
      type: 'user' as const,
    },
  ];
  const gameChatChannels = (scenario === 'game' || scenario === 'multi-opponent-game')
    ? {
      [GAME_ID]: {
        id: GAME_ID,
        name: 'Game chat',
        isJoined: true,
        messages: gameChatMessages,
      },
    }
    : {};

  useChatStore.setState({
    channels: scenario === 'waiting-room'
      ? {
        [TABLE_CHAT_ID]: {
          id: TABLE_CHAT_ID,
          name: 'Table chat',
          isJoined: true,
          messages: [
            {
              id: 'visual-table-chat-joined',
              timestamp: new Date('2026-06-21T00:01:00Z'),
              userName: 'System',
              message: 'VisualMage joined the table.',
              type: 'status',
            },
            {
              id: 'visual-table-chat-ready',
              timestamp: new Date('2026-06-21T00:02:00Z'),
              userName: 'Computer',
              message: 'Ready when you are.',
              type: 'user',
            },
          ],
        },
      }
      : gameChatChannels,
    activeChannelId: scenario === 'waiting-room'
      ? TABLE_CHAT_ID
      : (scenario === 'game' || scenario === 'multi-opponent-game') ? GAME_ID : null,
    lobbyChannelId: null,
    gameChannelId: (scenario === 'game' || scenario === 'multi-opponent-game') ? GAME_ID : null,
    tableChannelId: scenario === 'waiting-room' ? TABLE_CHAT_ID : null,
  });

  useDeckStore.setState({
    decks: [{
      id: DECK_ID,
      name: VISUAL_DECK.name ?? 'P0 Visual Smoke',
      format: VISUAL_DECK.format,
      updatedAt: VISUAL_DECK.updatedAt ?? Date.now(),
      cardCount: 60,
      sideboardCount: 2,
      coverCard: VISUAL_DECK.coverCard,
    }],
    selectedDeckId: DECK_ID,
    currentDeck: VISUAL_DECK,
    isEditing: scenario === 'deck-editor',
    isDirty: false,
    searchResults: INITIAL_SEARCH_RESULTS,
    isSearching: false,
    filters: createDefaultFilters(editorConfig.modes[editorMode]),
    editorMode,
    editorConfig,
  });

  if (scenario === 'game' || scenario === 'multi-opponent-game') {
    const isWatching = isVisualWatchMatch();
    const promptMode = scenario === 'game' && !isWatching ? getVisualPromptMode() : null;
    const showTargetPrompt = scenario === 'game' && !isWatching && isVisualTargetPrompt();
    const gameView = makeGameView(scenario === 'multi-opponent-game' ? 4 : 2);
    const promptFixture = makePromptFixture(promptMode, gameView);
    if (scenario === 'multi-opponent-game') {
      gameView.activePlayerId = SECOND_OPPONENT_ID;
      gameView.activePlayerName = 'Jace';
      gameView.priorityPlayerName = 'Jace';
      gameView.players = gameView.players.map((player) => ({
        ...player,
        isActive: player.playerId === SECOND_OPPONENT_ID,
        hasPriority: player.playerId === SECOND_OPPONENT_ID,
      }));
    }
    if (isWatching) {
      gameView.myPlayerId = null;
      gameView.myHand = {};
    }
    useGameStore.setState({
      gameId: GAME_ID,
      playerId: isWatching ? null : PLAYER_ID,
      gameView,
      isWatching,
      selectedCardId: showTargetPrompt ? '00000000-0000-0000-0000-000000000302' : promptFixture.selectedCardId,
      pendingAction: promptMode
        ? promptFixture.pendingAction
        : showTargetPrompt
        ? {
          type: 'target',
          message: 'Choose a target for Shock.',
          validTargets: [
            '00000000-0000-0000-0000-000000000302',
            OPPONENT_ID,
          ],
          gameView,
          required: true,
          min: 1,
          max: 1,
        }
        : scenario === 'game' && !isWatching
        ? promptFixture.pendingAction
        : { type: 'none' },
      activeSkip: scenario === 'game' && !isWatching ? 'F7' : 'none',
      arenaSkipEnabled: !isWatching,
      gameEnded: false,
      isLoading: false,
      lastError: null,
      lastMessage: isWatching
        ? 'Watching VisualMage versus Nissa.'
        : scenario === 'game' ? 'Choose how to assign combat damage.' : 'Nissa declares a blocker.',
    });
  } else {
    useGameStore.setState({
      gameId: null,
      playerId: null,
      gameView: null,
      pendingAction: { type: 'none' },
      activeSkip: 'none',
      arenaSkipEnabled: false,
    });
  }

  if (scenario === 'post-draft-construction') {
    useActivityStore.setState({
      activities: [],
      activeActivityId: null,
    });
    seedPostDraftConstructionActivity();
  } else if (scenario in ACTIVITY_SCENARIOS) {
    const activityScenario = scenario as VisualActivityScenario;
    const activity = ACTIVITY_SCENARIOS[activityScenario];
    useActivityStore.setState({
      activities: [activity],
      activeActivityId: activity.id,
    });
  } else {
    useActivityStore.setState({
      activities: [],
      activeActivityId: null,
    });
  }

  useNotificationStore.setState({
    notifications: scenario === 'notifications'
      ? [
        {
          id: 'visual-html-message',
          kind: 'message',
          tone: 'info',
          title: 'Server message',
          message: 'Welcome <b>VisualMage</b><br><font color="#c9a227">Draft starts soon.</font>',
          sourceMethod: 'serverMessage',
          createdAt: 1_700_000_100_000,
          dismissAt: Date.now() + 60_000,
          read: false,
        },
        {
          id: 'visual-warning',
          kind: 'game',
          tone: 'warning',
          title: 'Priority needed',
          message: 'Choose a target before the timer expires.',
          sourceMethod: 'gameTarget',
          createdAt: 1_700_000_100_001,
          dismissAt: Date.now() + 60_000,
          read: false,
        },
      ]
      : [],
  });
}

function VisualActivity({ scenario }: { scenario: VisualActivityScenario }) {
  const storeActivities = useActivityStore(state => state.activities);
  const activeActivityId = useActivityStore(state => state.activeActivityId);
  const activity = storeActivities.find(item => item.id === activeActivityId)
    ?? storeActivities[0]
    ?? ACTIVITY_SCENARIOS[scenario];
  const activities = scenario === 'replay'
    || scenario === 'sideboard'
    || scenario === 'limited-sideboard'
    || scenario === 'construction'
    || scenario === 'post-draft-construction'
    ? storeActivities.length > 0 ? storeActivities : [activity]
    : CORE_ACTIVITY_LIST;
  const [openedDeckEditor, setOpenedDeckEditor] = useState(false);
  const [activitySubmitContext, setActivitySubmitContext] = useState<{
    tableId: string;
    kind: 'sideboard' | 'construction';
    title: string;
    limitedSideboard?: boolean;
  } | null>(null);

  if (openedDeckEditor) {
    return (
      <DeckEditorPage
        onExit={() => setOpenedDeckEditor(false)}
        onNavigate={() => setOpenedDeckEditor(false)}
        onDone={() => setOpenedDeckEditor(false)}
        activitySubmitContext={activitySubmitContext}
        onSubmitActivityDeck={async () => true}
      />
    );
  }

  return (
    <ActivityWorkspace
      activity={activity}
      activities={activities}
      onOpenDecks={() => undefined}
      onOpenGame={() => undefined}
      onOpenLobby={() => undefined}
      onOpenSettings={() => undefined}
      onOpenDebug={() => undefined}
      onSubmitDeck={async () => true}
      onOpenDeckEditor={(deck, mode, title, activityContext) => {
        const deckState = useDeckStore.getState();
        deckState.closeDeck();
        deckState.setEditorMode(mode);
        deckState.replaceCurrentDeck({
          ...deck,
          id: undefined,
        });
        setActivitySubmitContext(
          activityContext?.tableId && (activityContext.kind === 'sideboard' || activityContext.kind === 'construction')
            ? {
              tableId: activityContext.tableId,
              kind: activityContext.kind,
              title,
              limitedSideboard: activityContext.limitedSideboard,
            }
            : null,
        );
        setOpenedDeckEditor(true);
      }}
    />
  );
}

function VisualDeckEditor() {
  const [navigationTarget, setNavigationTarget] = useState('');

  return (
    <>
      <DeckEditorPage
        onExit={() => setNavigationTarget('exit')}
        onNavigate={(page) => setNavigationTarget(page)}
        onDone={() => setNavigationTarget('done')}
      />
      <output
        data-testid="visual-navigation-target"
        data-target={navigationTarget}
        aria-hidden="true"
        style={{ display: 'none' }}
      >
        {navigationTarget}
      </output>
    </>
  );
}

function VisualDeckManager() {
  const [managerAction, setManagerAction] = useState('');

  return (
    <>
      <DeckManagerPage
        onExit={() => setManagerAction('exit')}
        onNavigate={(page) => setManagerAction(`navigate:${page}`)}
        onEditDeck={(deckId) => setManagerAction(`edit:${deckId}`)}
        onCreateDeck={() => setManagerAction('create')}
        supportMenu={(
          <SupportMenu
            placement="inline"
            onOpenCardViewer={() => undefined}
            onOpenDebug={() => undefined}
            onOpenSettings={() => undefined}
          />
        )}
      />
      <output
        data-testid="visual-deck-manager-action"
        data-action={managerAction}
        aria-hidden="true"
        style={{ display: 'none' }}
      >
        {managerAction}
      </output>
    </>
  );
}

function VisualApp({ scenario }: { scenario: VisualScenario }) {
  switch (scenario) {
    case 'login':
      return <LoginPage onLoginSuccess={() => undefined} />;
    case 'lobby':
      return (
        <LobbyPage
          onEnterGame={() => undefined}
          onLogout={() => undefined}
          onOpenDeckEditor={() => undefined}
          onOpenTournament={() => undefined}
        />
      );
    case 'waiting-room':
      return <WaitingRoom />;
    case 'game':
    case 'multi-opponent-game':
      return <GamePage gameId={GAME_ID} onLeave={() => undefined} isReplay={isVisualReplayMatch()} />;
    case 'deck-manager':
      return <VisualDeckManager />;
    case 'deck-editor':
      return <VisualDeckEditor />;
    case 'settings':
      return <SettingsPage onExit={() => undefined} onNavigate={() => undefined} onLogout={() => undefined} />;
    case 'notifications':
      return (
        <>
          <LobbyPage
            onEnterGame={() => undefined}
            onLogout={() => undefined}
            onOpenDeckEditor={() => undefined}
            onOpenTournament={() => undefined}
          />
          <NotificationToastHost />
        </>
      );
    case 'user-request':
      return (
        <>
          <LobbyPage
            onEnterGame={() => undefined}
            onLogout={() => undefined}
            onOpenDeckEditor={() => undefined}
            onOpenTournament={() => undefined}
          />
          <UserRequestModal
            isOpen={true}
            isExecuting={false}
            error={null}
            request={{
              title: 'Confirm Concede',
              message: 'Concede this game and return to the lobby?',
              windowSizeRatio: 1.2,
              gameId: GAME_ID,
              button1Text: 'Concede Game',
              button1Action: 'CONCEDE',
              button2Text: 'Cancel',
              button2Action: null,
              button3Text: 'Keep Playing',
              button3Action: null,
            }}
            onClose={() => {
              document.body.dataset.visualUserRequestResponse = 'closed';
            }}
            onRespond={(buttonIndex) => {
              document.body.dataset.visualUserRequestResponse = String(buttonIndex);
            }}
          />
        </>
      );
    case 'replay':
    case 'sideboard':
    case 'limited-sideboard':
    case 'construction':
    case 'post-draft-construction':
    case 'draft':
    case 'tournament':
    case 'card-viewer':
    case 'view-sideboard':
      return <VisualActivity scenario={scenario} />;
  }
}

const params = new URLSearchParams(window.location.search);
const scenario = (params.get('scenario') ?? 'login') as VisualScenario;

document.documentElement.dataset.visualScenario = scenario;
resetStores(scenario);

(window as typeof window & { __mageVisualTriggerLifeGain?: (playerId: UUID, amount: number) => void }).__mageVisualTriggerLifeGain =
  (playerId: UUID, amount: number) => {
    useAnimationStore.getState().triggerLifeGainEffect(playerId, amount);
  };

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VisualApp scenario={scenario} />
  </React.StrictMode>,
);

window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    document.body.dataset.visualReady = 'true';
  });
});
