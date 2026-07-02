import { MageObjectType } from '../types/api.js';
const DUNGEON_NAMES = new Set([
    'Dungeon of the Mad Mage',
    'Lost Mine of Phandelver',
    'Tomb of Annihilation',
    'Undercity',
]);
const PLANE_SET_CODES = new Set(['HOP', 'OPCA', 'PCA', 'PC2']);
export function getPlayerCommandObjects(player) {
    const seen = new Set();
    const objects = [
        ...(player.commandObjectList ?? []),
        ...(player.commandList ?? []),
    ];
    return objects.filter((object, index) => {
        const id = object.id ?? `${object.name ?? 'command'}-${index}`;
        if (seen.has(id))
            return false;
        seen.add(id);
        return true;
    });
}
export function getCommandZoneKind(commandObject) {
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
export function groupCommandZoneObjects(objects) {
    const groups = {
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
export function getPlayerCommandZoneGroups(player) {
    return groupCommandZoneObjects(getPlayerCommandObjects(player));
}
export function getSharedPlanes(players) {
    const seen = new Set();
    const planes = [];
    players.forEach((player) => {
        getPlayerCommandZoneGroups(player).planes.forEach((plane, index) => {
            const id = plane.id ?? `${plane.name ?? 'plane'}-${index}`;
            if (seen.has(id))
                return;
            seen.add(id);
            planes.push(plane);
        });
    });
    return planes;
}
