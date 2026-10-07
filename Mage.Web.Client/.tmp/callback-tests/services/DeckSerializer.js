export class DeckSerializer {
    static IGNORE_HEADERS = new Set([
        "lands", "creatures", "planeswalkers", "other spells", "sideboard cards",
        "instant", "land", "enchantment", "artifact", "sorcery", "planeswalker", "creature",
        "constructed", "count", "name", "quantity"
    ]);
    static SET_REMAPPING = {
        'DAR': 'DOM',
    };
    static normalizeName(name) {
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
    static isLikelyHeader(line) {
        const normalized = line.trim().toLowerCase();
        if (!normalized)
            return true;
        if (this.IGNORE_HEADERS.has(normalized))
            return true;
        const cells = normalized.split(/\t|,/).map(cell => cell.trim()).filter(Boolean);
        if (cells.length > 1) {
            const headerCells = new Set(["count", "qty", "quantity", "name", "card", "card name", "set", "collector number", "number"]);
            const headerMatches = cells.filter(cell => headerCells.has(cell)).length;
            return headerMatches >= Math.min(2, cells.length);
        }
        return false;
    }
    static normalizeDraftLogSetCode(setCode) {
        const normalized = (setCode ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        return normalized || 'UNK';
    }
    static normalizeDraftLogLine(value) {
        return this.normalizeName(value).replace(/\s+/g, ' ').trim();
    }
    static formatDraftLogExportTime(value) {
        if (value instanceof Date)
            return value.toISOString();
        if (typeof value === 'number')
            return new Date(value).toISOString();
        if (typeof value === 'string' && value.trim())
            return value.trim();
        return new Date().toISOString();
    }
    /**
     * Parse a deck file content into a DeckCardLists object.
     * Supports:
     * - XMage .dck format: count [set:num] name
     * - MTGA format: count name (set) num
     * - Cockatrice .cod XML format
     * - OCTGN .o8d XML format
     * - MTGJSON deck format
     * - XMage draft log format
     * - Header-based separation (Deck, Sideboard, Commander, etc.)
     * - "SB:" prefix
     */
    static importDeck(content) {
        if (this.isMtgJsonDeck(content)) {
            return this.importMtgJsonDeck(content);
        }
        if (this.isCockatriceDeck(content)) {
            return this.importCockatriceDeck(content);
        }
        if (this.isO8dDeck(content)) {
            return this.importO8dDeck(content);
        }
        if (this.isDraftLogDeck(content)) {
            return this.importDraftLogDeck(content);
        }
        const lines = content.split(/\r?\n/);
        const mainDeck = [];
        const sideboard = [];
        // Pre-scan for explicit sideboard headers to decide on empty-line behavior
        const lowerContent = content.toLowerCase();
        const hasExplicitSideboard = lowerContent.includes('sideboard') ||
            lowerContent.includes('commander') ||
            lowerContent.includes('maybeboard') ||
            lowerContent.includes('sb:');
        let currentZone = 'main';
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
            if (line.startsWith('//') || line.startsWith('#'))
                continue;
            // Detect headers (always switch zones explicitly)
            if (lowerLine === 'deck' || lowerLine === 'mainboard') {
                currentZone = 'main';
                continue;
            }
            if (lowerLine === 'sideboard' || lowerLine === 'commander' || lowerLine === 'maybeboard') {
                currentZone = 'side';
                continue;
            }
            // Ignore non-card headers (e.g. "Creatures", "Lands", CSV headers)
            if (this.isLikelyHeader(line)) {
                continue;
            }
            if (mainDeck.length === 0 && sideboard.length === 0 && /^name\b/i.test(line) && !/^\d+/.test(line)) {
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
            let setCode = null;
            let cardNumber = null;
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
            }
            else if (mtgaMatch) {
                count = parseInt(mtgaMatch[1]);
                name = mtgaMatch[2].trim();
                setCode = mtgaMatch[3];
                cardNumber = mtgaMatch[4] || null; // Capture group 4 might be undefined
            }
            else if (simpleMatch) {
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
            }
            else {
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
                const cardInfo = {
                    amount: count,
                    cardName: name,
                    setCode: finalSetCode,
                    cardNumber: finalCardNumber
                };
                if (isLineSideboard || currentZone === 'side') {
                    sideboard.push(cardInfo);
                }
                else {
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
    static isCockatriceDeck(content) {
        return /<\s*cockatrice_deck\b/i.test(content);
    }
    static isMtgJsonDeck(content) {
        const trimmed = content.trim();
        if (!trimmed.startsWith('{'))
            return false;
        try {
            const parsed = JSON.parse(trimmed);
            return this.getMtgJsonData(parsed) !== null;
        }
        catch {
            return false;
        }
    }
    static isO8dDeck(content) {
        return /<\s*deck\b/i.test(content) &&
            /<\s*section\b[^>]*\bname\s*=\s*(["'])Main\1/i.test(content);
    }
    static isDraftLogDeck(content) {
        return /^\s*------ [A-Za-z0-9]+ ------\s*$/m.test(content) && /^\s*-->\s+.+$/m.test(content);
    }
    static importCockatriceDeck(content) {
        const parsed = typeof DOMParser !== 'undefined'
            ? this.importCockatriceDeckWithDomParser(content)
            : this.importCockatriceDeckWithPatternParser(content);
        return {
            name: parsed.name || 'Imported Deck',
            cards: parsed.cards,
            sideboard: parsed.sideboard,
        };
    }
    static importMtgJsonDeck(content) {
        try {
            const parsed = JSON.parse(content);
            const data = this.getMtgJsonData(parsed);
            if (!data)
                return { name: 'Imported Deck', cards: [], sideboard: [] };
            const deckSet = this.readString(data, 'code');
            const deckName = this.readString(data, 'name') || 'Imported Deck';
            const cards = this.parseMtgJsonBoard(data, 'mainBoard', deckSet);
            const sideboard = [
                ...this.parseMtgJsonBoard(data, 'sideBoard', deckSet),
                ...this.parseMtgJsonBoard(data, 'commander', deckSet),
            ];
            return {
                name: deckName,
                cards,
                sideboard,
            };
        }
        catch {
            return { name: 'Imported Deck', cards: [], sideboard: [] };
        }
    }
    static getMtgJsonData(value) {
        if (!value || typeof value !== 'object')
            return null;
        const root = value;
        const data = root.data;
        if (!data || typeof data !== 'object' || Array.isArray(data))
            return null;
        const candidate = data;
        const hasMtgJsonBoard = ['mainBoard', 'sideBoard', 'commander'].some(key => Array.isArray(candidate[key]));
        return hasMtgJsonBoard ? candidate : null;
    }
    static parseMtgJsonBoard(data, key, deckSet) {
        const board = data[key];
        if (!Array.isArray(board))
            return [];
        return board
            .map(card => this.parseMtgJsonCard(card, deckSet))
            .filter((card) => Boolean(card));
    }
    static parseMtgJsonCard(value, deckSet) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return null;
        const card = value;
        const name = this.readString(card, 'name');
        if (!name)
            return null;
        const count = this.clampDeckQuantity(this.readNumber(card, 'count') ?? 1);
        const setCode = this.readString(card, 'setCode') || deckSet;
        const cardNumber = this.readString(card, 'number');
        return {
            amount: count,
            cardName: this.normalizeName(name),
            setCode: setCode && cardNumber ? setCode : null,
            cardNumber: setCode && cardNumber ? cardNumber : null,
        };
    }
    static importDraftLogDeck(content) {
        const cards = [];
        let currentSet = null;
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            const setMatch = line.match(/^------ ([A-Za-z0-9]+) ------$/);
            if (setMatch) {
                currentSet = setMatch[1];
                continue;
            }
            const pickMatch = line.match(/^-->\s+(.+)$/);
            if (!pickMatch)
                continue;
            const name = this.normalizeName(pickMatch[1].trim());
            if (!name)
                continue;
            cards.push({
                amount: 1,
                cardName: name,
                setCode: currentSet,
                cardNumber: null,
            });
        }
        return {
            name: 'Imported Draft Log',
            cards,
            sideboard: [],
        };
    }
    static importCockatriceDeckWithDomParser(content) {
        const document = new DOMParser().parseFromString(content, 'application/xml');
        if (document.getElementsByTagName('parsererror').length > 0) {
            return { name: 'Imported Deck', cards: [], sideboard: [] };
        }
        const deckName = document.getElementsByTagName('deckname')[0]?.textContent?.trim() || 'Imported Deck';
        const cards = [];
        const sideboard = [];
        Array.from(document.getElementsByTagName('zone')).forEach(zone => {
            const zoneName = zone.getAttribute('name')?.trim().toLowerCase();
            const target = zoneName === 'side' ? sideboard : zoneName === 'main' ? cards : null;
            if (!target)
                return;
            Array.from(zone.getElementsByTagName('card')).forEach(card => {
                const name = card.getAttribute('name')?.trim();
                if (!name)
                    return;
                target.push({
                    amount: this.parseCockatriceQuantity(card.getAttribute('number')),
                    cardName: this.normalizeName(name),
                    setCode: null,
                    cardNumber: null,
                });
            });
        });
        return { name: deckName, cards, sideboard };
    }
    static importCockatriceDeckWithPatternParser(content) {
        const deckName = this.decodeXmlEntities(content.match(/<deckname>([\s\S]*?)<\/deckname>/i)?.[1]?.trim() || 'Imported Deck');
        const cards = this.parseCockatriceZoneWithPattern(content, 'main');
        const sideboard = this.parseCockatriceZoneWithPattern(content, 'side');
        return { name: deckName, cards, sideboard };
    }
    static parseCockatriceZoneWithPattern(content, zone) {
        const zoneMatch = content.match(new RegExp(`<zone\\b[^>]*name=["']${zone}["'][^>]*>([\\s\\S]*?)<\\/zone>`, 'i'));
        if (!zoneMatch)
            return [];
        return Array.from(zoneMatch[1].matchAll(/<card\b([^>]*)\/?>/gi))
            .map(match => this.parseCockatriceCardAttributes(match[1]))
            .filter((card) => Boolean(card));
    }
    static parseCockatriceCardAttributes(attributes) {
        const name = this.getXmlAttribute(attributes, 'name')?.trim();
        if (!name)
            return null;
        return {
            amount: this.parseCockatriceQuantity(this.getXmlAttribute(attributes, 'number')),
            cardName: this.normalizeName(this.decodeXmlEntities(name)),
            setCode: null,
            cardNumber: null,
        };
    }
    static getXmlAttribute(attributes, name) {
        const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
        return match?.[2] ?? null;
    }
    static parseCockatriceQuantity(value) {
        const parsed = Number.parseInt(value || '', 10);
        return this.clampDeckQuantity(parsed);
    }
    static clampDeckQuantity(value) {
        if (!Number.isFinite(value))
            return 1;
        return Math.min(100, Math.max(1, Math.trunc(value)));
    }
    static readString(record, key) {
        const value = record[key];
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed || null;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return String(value);
        }
        return null;
    }
    static readNumber(record, key) {
        const value = record[key];
        if (typeof value === 'number')
            return value;
        if (typeof value === 'string') {
            const parsed = Number.parseInt(value, 10);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }
    static decodeXmlEntities(value) {
        return value
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
    }
    static importO8dDeck(content) {
        const parsed = typeof DOMParser !== 'undefined'
            ? this.importO8dDeckWithDomParser(content)
            : this.importO8dDeckWithPatternParser(content);
        return {
            name: 'Imported Deck',
            cards: parsed.cards,
            sideboard: parsed.sideboard,
        };
    }
    static importO8dDeckWithDomParser(content) {
        const document = new DOMParser().parseFromString(content, 'application/xml');
        if (document.getElementsByTagName('parsererror').length > 0) {
            return { name: 'Imported Deck', cards: [], sideboard: [] };
        }
        const cards = [];
        const sideboard = [];
        Array.from(document.getElementsByTagName('section')).forEach(section => {
            const sectionName = section.getAttribute('name')?.trim().toLowerCase();
            const target = sectionName === 'sideboard' ? sideboard : sectionName === 'main' ? cards : null;
            if (!target)
                return;
            Array.from(section.getElementsByTagName('card')).forEach(card => {
                const name = card.textContent?.trim();
                if (!name)
                    return;
                target.push({
                    amount: this.parseCockatriceQuantity(card.getAttribute('qty')),
                    cardName: this.normalizeName(name),
                    setCode: null,
                    cardNumber: null,
                });
            });
        });
        return { name: 'Imported Deck', cards, sideboard };
    }
    static importO8dDeckWithPatternParser(content) {
        return {
            name: 'Imported Deck',
            cards: this.parseO8dSectionWithPattern(content, 'Main'),
            sideboard: this.parseO8dSectionWithPattern(content, 'Sideboard'),
        };
    }
    static parseO8dSectionWithPattern(content, section) {
        const sectionMatch = content.match(new RegExp(`<section\\b[^>]*name=["']${section}["'][^>]*>([\\s\\S]*?)<\\/section>`, 'i'));
        if (!sectionMatch)
            return [];
        return Array.from(sectionMatch[1].matchAll(/<card\b([^>]*)>([\s\S]*?)<\/card>/gi))
            .map(match => this.parseO8dCard(match[1], match[2]))
            .filter((card) => Boolean(card));
    }
    static parseO8dCard(attributes, textContent) {
        const name = this.decodeXmlEntities(textContent.trim());
        if (!name)
            return null;
        return {
            amount: this.parseCockatriceQuantity(this.getXmlAttribute(attributes, 'qty')),
            cardName: this.normalizeName(name),
            setCode: null,
            cardNumber: null,
        };
    }
    /**
     * Serialize a DeckCardLists object into .dck file content
     */
    static exportDeck(deck) {
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
    /**
     * Serialize picked draft cards into an XMage-style .draft log that this
     * browser importer can read back through importDeck.
     */
    static exportDraftLog(deck, options = {}) {
        const lines = [];
        const draftId = options.draftId?.trim() || 'browser-draft';
        const sourceName = options.sourceName?.trim() || deck.name?.trim() || 'Draft Picks';
        const players = (options.players ?? [])
            .map(player => player.trim())
            .filter(Boolean);
        lines.push(`Event #: ${draftId}`);
        lines.push(`Exported: ${this.formatDraftLogExportTime(options.exportedAt)}`);
        lines.push(`Deck: ${sourceName}`);
        if (players.length > 0) {
            lines.push('Players:');
            for (const player of players) {
                lines.push(`    ${player.replace(/\s+/g, ' ')}`);
            }
        }
        let currentSet = null;
        let packNumber = 0;
        let pickNumber = 0;
        for (const card of deck.cards) {
            const cardName = this.normalizeDraftLogLine(card.cardName);
            if (!cardName)
                continue;
            const amount = Number.isFinite(card.amount) ? Math.max(0, Math.floor(card.amount)) : 0;
            const setCode = this.normalizeDraftLogSetCode(card.setCode);
            for (let copy = 0; copy < amount; copy += 1) {
                if (setCode !== currentSet) {
                    currentSet = setCode;
                    packNumber += 1;
                    pickNumber = 0;
                    lines.push('');
                    lines.push(`------ ${setCode} ------`);
                    lines.push('');
                }
                pickNumber += 1;
                lines.push(`Pack ${packNumber} pick ${pickNumber}:`);
                lines.push(`--> ${cardName}`);
                lines.push('');
            }
        }
        return `${lines.join('\n').trimEnd()}\n`;
    }
}
