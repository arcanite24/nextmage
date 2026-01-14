
import { DeckCardLists, DeckCardInfo } from '../types';

export class DeckSerializer {
    private static readonly IGNORE_HEADERS = new Set([
        "lands", "creatures", "planeswalkers", "other spells", "sideboard cards",
        "instant", "land", "enchantment", "artifact", "sorcery", "planeswalker", "creature",
        "constructed", "count", "name"
    ]);

    private static readonly SET_REMAPPING: Record<string, string> = {
        'DAR': 'DOM',
    };

    private static normalizeName(name: string): string {
        let n = name
            .replace(/&amp;/g, "//")
            .replace(/\/\/\//g, "//")
            .replace(/Ã†/g, "Ae")
            .replace(/Ã¶/g, "A")
            .replace(/ö/g, "o")
            .replace(/û/g, "u")
            .replace(/í/g, "i")
            .replace(/ï/g, "i")
            .replace(/î/g, "i")
            .replace(/â/g, "a")
            .replace(/á/g, "a")
            .replace(/à/g, "a")
            .replace(/é/g, "e")
            .replace(/ú/g, "u")
            .replace(/†/g, "+")
            .replace(/★/g, "*")
            .replace(/ó/g, "o")
            .replace(/ä/g, "a")
            .replace(/ü/g, "u")
            .replace(/É/g, "E")
            .replace(/ñ/g, "n")
            .replace(/꞉/g, "")
            .replace(/®/g, "")
            .replace(/—/g, "")
            .replace(/\s*\*F\*\s*/g, ""); // Remove *F* foil marker

        // Fix split card "//" spacing: "Fire/Ice" -> "Fire // Ice"
        // Use regex replacement that looks for / surrounded by non-space or single space
        n = n.replace(/(?<=[^/])\s*\/\s*(?=[^/])/g, " // ");

        return n.trim();
    }

    /**
     * Parse a deck file content into a DeckCardLists object.
     * Supports:
     * - XMage .dck format: count [set:num] name
     * - MTGA format: count name (set) num
     * - Header-based separation (Deck, Sideboard, Commander, etc.)
     * - "SB:" prefix
     */
    public static importDeck(content: string): DeckCardLists {
        const lines = content.split(/\r?\n/);
        const mainDeck: DeckCardInfo[] = [];
        const sideboard: DeckCardInfo[] = [];

        // Pre-scan for explicit sideboard headers to decide on empty-line behavior
        const lowerContent = content.toLowerCase();
        const hasExplicitSideboard = lowerContent.includes('sideboard') ||
            lowerContent.includes('commander') ||
            lowerContent.includes('maybeboard') ||
            lowerContent.includes('sb:');

        let currentZone: 'main' | 'side' = 'main';

        for (let line of lines) {
            line = line.trim();
            if (!line) {
                // strict MTGA/Text parsed: if no explicit sideboard headers were found in the file,
                // assume the first empty line after cards indicates a switch to sideboard.
                if (!hasExplicitSideboard && mainDeck.length > 0 && currentZone === 'main') {
                    currentZone = 'side';
                }
                continue;
            }

            const lowerLine = line.toLowerCase();

            // Skip comments
            if (line.startsWith('//') || line.startsWith('#')) continue;

            // Detect headers (always switch zones explicitly)
            if (lowerLine === 'deck' || lowerLine === 'mainboard') {
                currentZone = 'main';
                continue;
            }
            if (lowerLine === 'sideboard' || lowerLine === 'commander' || lowerLine === 'maybeboard') {
                currentZone = 'side';
                continue;
            }

            // Ignore non-card headers (e.g. "Creatures", "Lands")
            // Check exact match against ignore list (ignoring numbers/spaces if purely a header)
            if (this.IGNORE_HEADERS.has(lowerLine)) {
                continue;
            }

            // Check for explicit "SB:" prefix
            let isLineSideboard = false;
            if (line.startsWith('SB:')) {
                isLineSideboard = true;
                line = line.substring(3).trim();
            }

            let count = 1;
            let name = '';
            let setCode: string | null = null;
            let cardNumber: string | null = null;

            // Match XMage Style: 1 [Set:Num] Name
            const xmageMatch = line.match(/^(\d+)\s+\[([^:]+):([^\]]+)\]\s+(.+)$/);

            // Match MTGA Style: 1 Name (Set) Num  OR  1 Name (Set)
            // Enhanced to effectively capture optional number
            const mtgaMatch = line.match(/^(\d+)\s+(.+?)\s+\((\w+)\)(?:\s+(\w+))?$/);

            // Match Simple Style: 1 Name
            const simpleMatch = line.match(/^(\d+)\s+(.+)$/);

            if (xmageMatch) {
                count = parseInt(xmageMatch[1]);
                setCode = xmageMatch[2];
                cardNumber = xmageMatch[3];
                name = xmageMatch[4].trim();
            } else if (mtgaMatch) {
                count = parseInt(mtgaMatch[1]);
                name = mtgaMatch[2].trim();
                setCode = mtgaMatch[3];
                cardNumber = mtgaMatch[4] || null; // Capture group 4 might be undefined
            } else if (simpleMatch) {
                count = parseInt(simpleMatch[1]);
                let rawName = simpleMatch[2].trim();

                // Advanced parsing for "Name <Num> [Set] (F)" formats commonly found in text exports

                // Extract Set Code: [XYZ]
                const setMatch = rawName.match(/\s*\[([a-zA-Z0-9]+)\]/);
                if (setMatch) {
                    setCode = setMatch[1];
                    rawName = rawName.replace(setMatch[0], '');
                }

                // Extract Collector Number: <123>
                const numMatch = rawName.match(/\s*<([^>]+)>/);
                if (numMatch) {
                    cardNumber = numMatch[1];
                    rawName = rawName.replace(numMatch[0], '');
                }

                // Cleanup flags like (F) for foil
                rawName = rawName.replace(/\s*\([^)]+\)$/, '');

                name = rawName.trim();
            } else {
                // fallback, assume line is just a name (e.g. "Black Lotus")
                // Check if it's on ignore list first? already done above.
                name = line.trim();
            }

            if (name) {
                name = this.normalizeName(name);

                // Apply Set Remapping
                if (setCode && this.SET_REMAPPING[setCode]) {
                    setCode = this.SET_REMAPPING[setCode];
                }

                // Ensure we have both setCode and cardNumber, or neither
                const finalSetCode = (setCode && cardNumber) ? setCode : null;
                const finalCardNumber = (setCode && cardNumber) ? cardNumber : null;

                const cardInfo: DeckCardInfo = {
                    amount: count,
                    cardName: name,
                    setCode: finalSetCode,
                    cardNumber: finalCardNumber
                };

                if (isLineSideboard || currentZone === 'side') {
                    sideboard.push(cardInfo);
                } else {
                    mainDeck.push(cardInfo);
                }
            }
        }

        return {
            name: 'Imported Deck',
            cards: mainDeck,
            sideboard: sideboard
        };
    }

    /**
     * Serialize a DeckCardLists object into .dck file content
     */
    public static exportDeck(deck: DeckCardLists): string {
        let content = '';

        // Main Deck
        for (const card of deck.cards) {
            const setCode = card.setCode || 'UNK';
            const num = card.cardNumber || '0';
            content += `${card.amount} [${setCode}:${num}] ${card.cardName}\n`;
        }

        // Sideboard
        for (const card of deck.sideboard) {
            const setCode = card.setCode || 'UNK';
            const num = card.cardNumber || '0';
            content += `SB: ${card.amount} [${setCode}:${num}] ${card.cardName}\n`;
        }

        return content;
    }
}
