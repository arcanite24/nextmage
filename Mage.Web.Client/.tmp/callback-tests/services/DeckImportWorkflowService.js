import { DeckSerializer } from './DeckSerializer.js';
import { cardResolverService } from './CardResolverService.js';
export const DECK_TEXT_IMPORT_EXTENSION_PATTERN = /\.(dck|txt|dec|mwdeck|dek|mtga|draft|cod|o8d|json)$/i;
export const DECK_TEXT_IMPORT_ACCEPT = '.dck,.txt,.dec,.mwdeck,.dek,.mtga,.draft,.cod,.o8d,.json';
export function candidateValue(candidate) {
    return JSON.stringify(candidate);
}
export function formatCandidate(candidate) {
    return `${candidate.name} [${candidate.setCode}:${candidate.cardNumber}]`;
}
export function reportItemToDeckCard(item) {
    return {
        amount: item.amount,
        cardName: item.cardName,
        setCode: item.setCode,
        cardNumber: item.cardNumber,
    };
}
export function describeImportZones(item) {
    return item.zones
        .map(zone => `${zone.zone === 'main' ? 'Main' : 'Sideboard'} ${zone.amount}`)
        .join(', ');
}
export function parseAlternateSearch(item, query) {
    const trimmed = query.trim();
    if (!trimmed) {
        return reportItemToDeckCard(item);
    }
    const xmage = trimmed.match(/^\[([^:\]]+):([^\]]+)]\s*(.+)?$/);
    if (xmage) {
        return {
            amount: item.amount,
            cardName: (xmage[3] || item.cardName).trim(),
            setCode: xmage[1],
            cardNumber: xmage[2],
        };
    }
    const mtga = trimmed.match(/^(.+?)\s+\(([a-zA-Z0-9]+)\)\s+([a-zA-Z0-9-]+)$/);
    if (mtga) {
        return {
            amount: item.amount,
            cardName: mtga[1].trim(),
            setCode: mtga[2],
            cardNumber: mtga[3],
        };
    }
    const setAndNumber = trimmed.match(/^([a-zA-Z0-9]{2,8})[:#\s]+([a-zA-Z0-9-]+)$/);
    if (setAndNumber && /\d/.test(setAndNumber[2])) {
        return {
            amount: item.amount,
            cardName: item.cardName,
            setCode: setAndNumber[1],
            cardNumber: setAndNumber[2],
        };
    }
    return {
        amount: item.amount,
        cardName: trimmed,
        setCode: item.setCode,
        cardNumber: item.cardNumber,
    };
}
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(String(event.target?.result || ''));
        reader.onerror = () => reject(new Error(`Could not read ${file.name || 'deck file'}.`));
        reader.readAsText(file);
    });
}
export function getDeckNameFromFile(file) {
    return file.name.replace(DECK_TEXT_IMPORT_EXTENSION_PATTERN, '') || 'Imported Deck';
}
export async function resolveImportedDeckText(content, deckName) {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
        throw new Error('No deck text was found to import.');
    }
    const deck = DeckSerializer.importDeck(trimmedContent);
    deck.name = deckName;
    return cardResolverService.resolveDeckWithReport(deck);
}
export function appendDeckCardLists(baseDeck, deckToAppend) {
    return {
        ...baseDeck,
        cards: mergeCardLists(baseDeck.cards, deckToAppend.cards),
        sideboard: mergeCardLists(baseDeck.sideboard, deckToAppend.sideboard),
        updatedAt: Date.now(),
    };
}
function mergeCardLists(baseCards, cardsToAppend) {
    const merged = baseCards.map(card => ({ ...card }));
    const indexByIdentity = new Map(merged.map((card, index) => [cardIdentity(card), index]));
    for (const card of cardsToAppend) {
        const identity = cardIdentity(card);
        const existingIndex = indexByIdentity.get(identity);
        if (existingIndex === undefined) {
            indexByIdentity.set(identity, merged.length);
            merged.push({ ...card });
            continue;
        }
        merged[existingIndex] = {
            ...merged[existingIndex],
            amount: merged[existingIndex].amount + card.amount,
        };
    }
    return merged;
}
function cardIdentity(card) {
    return [
        card.setCode?.trim().toUpperCase() ?? '',
        card.cardNumber?.trim().toLowerCase() ?? '',
        card.cardName.trim().toLowerCase(),
    ].join('|');
}
