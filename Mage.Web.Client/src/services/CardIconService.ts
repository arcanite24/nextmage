import type { CardIconView } from '../types/game.js';

export type NormalizedCardIconCategory = 'ability' | 'playable' | 'commander' | 'system' | 'other';

export interface NormalizedCardIcon {
    key: string;
    type: string;
    label: string;
    title: string;
    category: NormalizedCardIconCategory;
}

interface CardIconDefinition {
    label: string;
    title: string;
    category: NormalizedCardIconCategory;
}

const CARD_ICON_DEFINITIONS: Record<string, CardIconDefinition> = {
    PLAYABLE_COUNT: { label: 'Act', title: 'Playable actions', category: 'playable' },
    ABILITY_FLYING: { label: 'Fly', title: 'Flying', category: 'ability' },
    ABILITY_DEFENDER: { label: 'Def', title: 'Defender', category: 'ability' },
    ABILITY_DEATHTOUCH: { label: 'DT', title: 'Deathtouch', category: 'ability' },
    ABILITY_LIFELINK: { label: 'LL', title: 'Lifelink', category: 'ability' },
    ABILITY_DOUBLE_STRIKE: { label: 'DS', title: 'Double strike', category: 'ability' },
    ABILITY_FIRST_STRIKE: { label: 'FS', title: 'First strike', category: 'ability' },
    ABILITY_CREW: { label: 'Crew', title: 'Crew', category: 'ability' },
    ABILITY_TRAMPLE: { label: 'Tr', title: 'Trample', category: 'ability' },
    ABILITY_HEXPROOF: { label: 'Hex', title: 'Hexproof', category: 'ability' },
    ABILITY_INFECT: { label: 'Inf', title: 'Infect', category: 'ability' },
    ABILITY_INDESTRUCTIBLE: { label: 'Ind', title: 'Indestructible', category: 'ability' },
    ABILITY_VIGILANCE: { label: 'Vig', title: 'Vigilance', category: 'ability' },
    ABILITY_CLASS_LEVEL: { label: 'Lvl', title: 'Class level', category: 'ability' },
    ABILITY_REACH: { label: 'Rch', title: 'Reach', category: 'ability' },
    OTHER_FACEDOWN: { label: 'FD', title: 'Face down', category: 'other' },
    OTHER_COST_X: { label: 'X', title: 'Announced X value', category: 'other' },
    OTHER_HAS_RESTRICTIONS: { label: '!', title: 'Has restrictions', category: 'other' },
    OTHER_HAS_TARGETS: { label: 'Tgt', title: 'Has targets', category: 'commander' },
    RINGBEARER: { label: 'Ring', title: 'Ring-bearer', category: 'commander' },
    COMMANDER: { label: 'Cmd', title: 'Commander', category: 'commander' },
    SYSTEM_COMBINED: { label: '+', title: 'Additional hidden icons', category: 'system' },
    SYSTEM_DEBUG: { label: 'Dbg', title: 'Debug icon', category: 'system' },
};

const RESOURCE_NAME_TO_TYPE: Record<string, string> = {
    'cog': 'PLAYABLE_COUNT',
    'feather-alt': 'ABILITY_FLYING',
    'chess-rook': 'ABILITY_DEFENDER',
    'skull-crossbones': 'ABILITY_DEATHTOUCH',
    'link': 'ABILITY_LIFELINK',
    'swords-two': 'ABILITY_DOUBLE_STRIKE',
    'swords-one': 'ABILITY_FIRST_STRIKE',
    'truck-monster': 'ABILITY_CREW',
    'grimace': 'ABILITY_TRAMPLE',
    'expand-arrows-alt': 'ABILITY_HEXPROOF',
    'flask': 'ABILITY_INFECT',
    'ankh': 'ABILITY_INDESTRUCTIBLE',
    'eye': 'ABILITY_VIGILANCE',
    'hexagon-fill': 'ABILITY_CLASS_LEVEL',
    'child-reaching': 'ABILITY_REACH',
    'reply-fill': 'OTHER_FACEDOWN',
    'square-fill': 'OTHER_COST_X',
    'exclamation-triangle-fill': 'OTHER_HAS_RESTRICTIONS',
    'ring': 'RINGBEARER',
    'crown': 'COMMANDER',
};

export function normalizeCardIcons(cardIcons?: readonly CardIconView[] | null): NormalizedCardIcon[] {
    return (cardIcons ?? []).map((icon, index) => normalizeCardIcon(icon, index));
}

export function getCardIconSummary(cardIcons?: readonly CardIconView[] | null): string {
    return normalizeCardIcons(cardIcons).map(icon => icon.title).join('; ');
}

export function createCardIconSignature(cardIcons?: readonly CardIconView[] | null): string {
    return normalizeCardIcons(cardIcons)
        .map(icon => `${icon.type}:${icon.label}:${icon.title}:${icon.category}`)
        .join('|');
}

function normalizeCardIcon(icon: CardIconView, index: number): NormalizedCardIcon {
    const type = normalizeIconType(icon);
    const definition = CARD_ICON_DEFINITIONS[type];
    const text = sanitizeLabel(icon.text);
    const hint = sanitizeHint(icon.hint || icon.combinedInfo);
    const category = definition?.category ?? normalizeCategory(icon);
    const label = text || definition?.label || fallbackLabel(type || hint || `Icon ${index + 1}`);
    const title = hint || definition?.title || fallbackTitle(type || label);

    return {
        key: `${type || 'CARD_ICON'}:${label}:${index}`,
        type: type || 'UNKNOWN',
        label,
        title,
        category,
    };
}

function normalizeIconType(icon: CardIconView): string {
    const rawIconType = icon.iconType;
    if (typeof rawIconType === 'string') {
        return normalizeTypeString(rawIconType);
    }
    if (rawIconType && typeof rawIconType === 'object') {
        return normalizeTypeString(rawIconType.name || rawIconType.resourceName || '');
    }
    return '';
}

function normalizeTypeString(rawType: string): string {
    const trimmed = rawType.trim();
    if (!trimmed) {
        return '';
    }

    const resourceKey = trimmed
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        ?.replace(/\.(svg|png|jpg|jpeg)$/i, '') ?? trimmed;

    return RESOURCE_NAME_TO_TYPE[resourceKey] ?? trimmed.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function normalizeCategory(icon: CardIconView): NormalizedCardIconCategory {
    const rawCategory = typeof icon.iconType === 'object' ? icon.iconType.category?.toLowerCase() : '';
    if (rawCategory === 'ability' || rawCategory === 'playable' || rawCategory === 'system' || rawCategory === 'commander') {
        return rawCategory;
    }
    if (rawCategory === 'playable_count') {
        return 'playable';
    }
    return 'other';
}

function sanitizeLabel(value?: string): string {
    return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 8);
}

function sanitizeHint(value?: string): string {
    return (value ?? '')
        .replace(/<br\s*\/?>/gi, ', ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function fallbackLabel(value: string): string {
    const words = fallbackTitle(value).split(' ').filter(Boolean);
    if (words.length === 0) {
        return 'Icon';
    }
    if (words.length === 1) {
        return words[0].slice(0, 4);
    }
    return words.map(word => word[0]).join('').slice(0, 4);
}

function fallbackTitle(value: string): string {
    return value
        .replace(/^(ABILITY|OTHER|SYSTEM)_/, '')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, letter => letter.toUpperCase());
}
