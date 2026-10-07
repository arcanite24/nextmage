import { createCardIconSignature } from './CardIconService.js';
export const JAVA_BATTLEFIELD_STACK_CAP = 5;
export const BATTLEFIELD_ZONE_LABELS = {
    CREATURES: 'Creatures',
    NONLANDS: 'Nonlands',
    LANDS: 'Lands',
    ARTIFACTS: 'Artifacts',
    ENCHANTMENTS: 'Enchantments',
    PLANESWALKERS: 'Planeswalkers',
    BATTLES: 'Battles',
    OTHER: 'Other',
};
export function buildBattlefieldLayout(player, grouping) {
    const allPermanents = Object.values(player.battlefield ?? {});
    const visiblePermanents = allPermanents.filter(card => card.phasedIn !== false);
    const permanentById = new Map(visiblePermanents.map(card => [card.id, card]));
    const attachedByHostId = buildAttachedByHostId(visiblePermanents);
    const zones = createEmptyZoneBuckets();
    for (const permanent of visiblePermanents) {
        if (permanent.attachedToPermanent) {
            continue;
        }
        zones[getBattlefieldZone(permanent, grouping)].push(permanent);
    }
    const rows = getRowConfig(grouping).map(rowConfig => ({
        key: rowConfig.role,
        role: rowConfig.role,
        zoneKeys: rowConfig.zoneKeys,
        zones: createBattlefieldZones(rowConfig, zones, permanentById, attachedByHostId),
    }));
    return {
        rows,
        visiblePermanentCount: visiblePermanents.length,
        hiddenPhasedCount: allPermanents.length - visiblePermanents.length,
        rootPermanentCount: visiblePermanents.filter(card => !card.attachedToPermanent).length,
        attachedPermanentCount: visiblePermanents.filter(card => card.attachedToPermanent).length,
    };
}
function createBattlefieldZones(rowConfig, zones, permanentById, attachedByHostId) {
    const rowZones = [];
    for (const zoneKey of rowConfig.zoneKeys) {
        const stacks = createDesktopStyleStacks(zones[zoneKey], permanentById, attachedByHostId);
        if (stacks.length === 0) {
            continue;
        }
        const alignment = getZoneAlignment();
        rowZones.push({
            zoneKey,
            label: BATTLEFIELD_ZONE_LABELS[zoneKey],
            alignment,
            startsAlignmentGroup: false,
            stacks,
        });
    }
    return rowZones;
}
function getZoneAlignment() {
    return 'center';
}
export function createBattlefieldSignature(player) {
    const battlefield = player.battlefield ? Object.values(player.battlefield) : [];
    return battlefield
        .map((card) => [
        card.id,
        card.name,
        card.displayName,
        card.tapped,
        card.flipped,
        card.phasedIn,
        card.transformed,
        card.faceDown,
        card.morphed,
        card.manifested,
        card.disguised,
        card.cloaked,
        card.mutated,
        card.mutateView ? getMutateSignature(card.mutateView) : '',
        card.summoningSickness,
        card.power,
        card.toughness,
        card.loyalty,
        card.defense,
        card.damage,
        card.isToken,
        card.copy,
        card.isSelected,
        card.isChoosable,
        card.playableStats?.playableAmount ?? 0,
        card.canAttack,
        card.canBlock,
        card.nameOwner,
        card.nameController,
        card.attachments?.join(',') ?? '',
        card.attachedTo ?? '',
        card.attachedToPermanent,
        card.attachedControllerDiffers,
        card.cardTypes.join(','),
        card.subTypes.join(','),
        card.rules.join('\n'),
        normalizeCounters(card.counters),
        getOriginalStat(card, 'power'),
        getOriginalStat(card, 'toughness'),
        card.original?.name ?? '',
        card.original?.rules?.join('\n') ?? '',
        createCardIconSignature(card.cardIcons),
    ].join(':'))
        .sort()
        .join('|');
}
export function getBattlefieldZone(perm, grouping) {
    if (grouping === 'nonlands') {
        return hasCardType(perm, 'Land') ? 'LANDS' : 'NONLANDS';
    }
    if (grouping === 'creature-land-other') {
        if (hasCardType(perm, 'Creature'))
            return 'CREATURES';
        if (hasCardType(perm, 'Land'))
            return 'LANDS';
        return 'OTHER';
    }
    if (hasCardType(perm, 'Creature'))
        return 'CREATURES';
    if (hasCardType(perm, 'Land'))
        return 'LANDS';
    if (hasCardType(perm, 'Planeswalker'))
        return 'PLANESWALKERS';
    if (hasCardType(perm, 'Battle'))
        return 'BATTLES';
    if (hasCardType(perm, 'Enchantment'))
        return 'ENCHANTMENTS';
    if (hasCardType(perm, 'Artifact'))
        return 'ARTIFACTS';
    return 'OTHER';
}
function createDesktopStyleStacks(cards, permanentById, attachedByHostId) {
    const sortedCards = [...cards].sort(comparePermanents);
    const stacks = [];
    for (const card of sortedCards) {
        const attachments = collectAttachments(card, permanentById, attachedByHostId);
        if (requiresOwnStack(card, attachments.length)) {
            stacks.push(createStackGroup(`single:${card.id}`, [card], attachments));
            continue;
        }
        const stackKey = getDesktopStackKey(card);
        const matchingStack = stacks.find(stack => getStackBaseKey(stack.key) === stackKey
            && stack.cards.length < JAVA_BATTLEFIELD_STACK_CAP
            && stack.attachmentCount === 0);
        if (matchingStack) {
            matchingStack.cards.unshift(card);
        }
        else {
            stacks.push(createStackGroup(createSplitStackKey(stackKey, stacks), [card], attachments));
        }
    }
    return stacks;
}
function createSplitStackKey(baseKey, stacks) {
    const existingSplitCount = stacks.filter(stack => getStackBaseKey(stack.key) === baseKey).length;
    return existingSplitCount === 0 ? baseKey : `${baseKey}:split:${existingSplitCount + 1}`;
}
function getStackBaseKey(key) {
    const splitIndex = key.lastIndexOf(':split:');
    return splitIndex === -1 ? key : key.slice(0, splitIndex);
}
function createStackGroup(key, cards, attachedCards) {
    return {
        key,
        cards,
        attachedCards,
        attachmentCount: attachedCards.length,
        attachmentColumns: getAttachmentColumns(attachedCards),
        hasControllerMismatch: attachedCards.some(attachment => attachment.card.attachedControllerDiffers),
    };
}
function requiresOwnStack(card, attachmentCount) {
    const isLand = hasCardType(card, 'Land');
    const isCreature = hasCardType(card, 'Creature');
    if (attachmentCount > 0) {
        return true;
    }
    return (!isLand && !card.isToken) || (isCreature && !card.isToken);
}
function getDesktopStackKey(card) {
    const sicknessKey = hasCardType(card, 'Creature') ? String(card.summoningSickness) : '';
    return [
        'stack',
        card.isToken,
        card.name,
        getOriginalStat(card, 'power'),
        getOriginalStat(card, 'toughness'),
        card.rules.join('\n'),
        normalizeCounters(card.counters),
        sicknessKey,
    ].join(':');
}
function collectAttachments(host, permanentById, attachedByHostId) {
    const attachments = [];
    const seen = new Set();
    const visit = (card, depth) => {
        for (const attachmentId of getAttachmentIds(card, attachedByHostId)) {
            if (seen.has(attachmentId)) {
                continue;
            }
            const attachment = permanentById.get(attachmentId);
            if (!attachment) {
                continue;
            }
            seen.add(attachmentId);
            attachments.push({ card: attachment, depth });
            visit(attachment, depth + 1);
        }
    };
    visit(host, 1);
    return attachments;
}
function getAttachmentIds(card, attachedByHostId) {
    const ids = new Set();
    for (const attachmentId of card.attachments ?? []) {
        ids.add(attachmentId);
    }
    for (const attachmentId of attachedByHostId.get(card.id) ?? []) {
        ids.add(attachmentId);
    }
    return [...ids];
}
function buildAttachedByHostId(cards) {
    const attachedByHostId = new Map();
    for (const card of cards) {
        if (!card.attachedTo) {
            continue;
        }
        const existing = attachedByHostId.get(card.attachedTo) ?? [];
        existing.push(card.id);
        attachedByHostId.set(card.attachedTo, existing);
    }
    return attachedByHostId;
}
function getAttachmentColumns(attachments) {
    return attachments.reduce((maxDepth, attachment) => Math.max(maxDepth, attachment.depth), 0);
}
function getRowConfig(grouping) {
    if (grouping === 'nonlands') {
        return [
            { role: 'front', zoneKeys: ['NONLANDS'] },
            { role: 'back', zoneKeys: ['LANDS'] },
        ];
    }
    if (grouping === 'creature-land-other') {
        return [
            { role: 'front', zoneKeys: ['CREATURES'] },
            { role: 'back', zoneKeys: ['LANDS', 'OTHER'] },
        ];
    }
    return [
        { role: 'front', zoneKeys: ['CREATURES'] },
        { role: 'back', zoneKeys: ['LANDS', 'ARTIFACTS', 'ENCHANTMENTS', 'PLANESWALKERS', 'BATTLES', 'OTHER'] },
    ];
}
function createEmptyZoneBuckets() {
    return {
        CREATURES: [],
        NONLANDS: [],
        LANDS: [],
        ARTIFACTS: [],
        ENCHANTMENTS: [],
        PLANESWALKERS: [],
        BATTLES: [],
        OTHER: [],
    };
}
function comparePermanents(first, second) {
    const nameCompare = first.name.localeCompare(second.name);
    if (nameCompare !== 0)
        return nameCompare;
    if (first.tapped !== second.tapped)
        return first.tapped ? 1 : -1;
    return first.id.localeCompare(second.id);
}
export function hasCardType(card, type) {
    const target = normalizeCardType(type);
    return card.cardTypes.some(cardType => normalizeCardType(cardType) === target);
}
function normalizeCardType(type) {
    return type.replace(/[\s_-]/g, '').toUpperCase();
}
function getOriginalStat(card, stat) {
    const originalValue = stat === 'power' ? card.originalPower : card.originalToughness;
    const originalCardValue = card.original?.[stat];
    if (originalCardValue !== undefined && originalCardValue !== null && originalCardValue !== '') {
        return String(originalCardValue);
    }
    if (originalValue !== undefined && originalValue !== null && originalValue !== '') {
        return String(originalValue);
    }
    return card[stat] ?? '';
}
function normalizeCounters(counters) {
    return (counters ?? [])
        .slice()
        .sort((first, second) => {
        const nameCompare = first.name.localeCompare(second.name);
        if (nameCompare !== 0)
            return nameCompare;
        return first.count - second.count;
    })
        .map(counter => `${counter.name}:${counter.count}`)
        .join('|');
}
function getMutateSignature(mutateView) {
    if (!mutateView)
        return '';
    return Object.entries(mutateView)
        .filter(([key, value]) => key !== 'id' && key !== 'name' && typeof value === 'object' && value !== null)
        .map(([key, value]) => `${key}:${value.name ?? ''}`)
        .sort()
        .join('|');
}
