const ALLOWED_TAGS = new Set([
    'a',
    'b',
    'br',
    'div',
    'em',
    'font',
    'i',
    'li',
    'ol',
    'p',
    'small',
    'span',
    'strong',
    'u',
    'ul',
]);

const VOID_TAGS = new Set(['br']);

const STRIP_CONTENT_TAGS = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TOKEN_PATTERN = /<\/?[^>]+>|[^<]+/g;
const ATTRIBUTE_PATTERN = /([a-zA-Z:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
const SAFE_COLOR_PATTERN = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\))$/;

export function sanitizeServerHtml(input: string): string {
    if (!input) return '';

    const withoutScript = input.replace(STRIP_CONTENT_TAGS, '');
    const tokens = withoutScript.match(HTML_TOKEN_PATTERN);
    if (!tokens) {
        return escapeHtml(withoutScript);
    }

    return tokens.map(token => {
        if (!token.startsWith('<')) {
            return escapeHtml(token).replace(/\r?\n/g, '<br>');
        }

        return sanitizeTag(token);
    }).join('');
}

export function serverHtmlToPlainText(input: string): string {
    return sanitizeServerHtml(input)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, '&')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function sanitizeTag(token: string): string {
    const closingMatch = token.match(/^<\s*\/\s*([a-zA-Z0-9:-]+)\s*>$/);
    if (closingMatch) {
        const tagName = normalizeTagName(closingMatch[1]);
        return tagName && ALLOWED_TAGS.has(tagName) && !VOID_TAGS.has(tagName)
            ? `</${tagName}>`
            : '';
    }

    const openingMatch = token.match(/^<\s*([a-zA-Z0-9:-]+)([\s\S]*?)\/?\s*>$/);
    if (!openingMatch) return '';

    const tagName = normalizeTagName(openingMatch[1]);
    if (!tagName || !ALLOWED_TAGS.has(tagName)) return '';
    if (VOID_TAGS.has(tagName)) return '<br>';

    const attrs = sanitizeAttributes(tagName, openingMatch[2] ?? '');
    return `<${tagName}${attrs}>`;
}

function sanitizeAttributes(tagName: string, rawAttributes: string): string {
    const attrs: string[] = [];
    let match: RegExpExecArray | null;

    ATTRIBUTE_PATTERN.lastIndex = 0;
    while ((match = ATTRIBUTE_PATTERN.exec(rawAttributes)) !== null) {
        const name = match[1].toLowerCase();
        const value = unquoteAttribute(match[2] ?? '');

        if ((tagName === 'font' || tagName === 'span') && name === 'color') {
            const safeColor = sanitizeColor(value);
            if (safeColor) {
                attrs.push(`color="${escapeAttribute(safeColor)}"`);
            }
        }

        if (tagName === 'a' && name === 'href') {
            const href = sanitizeHref(value);
            if (href) {
                attrs.push(`href="${escapeAttribute(href)}"`, 'target="_blank"', 'rel="noopener noreferrer"');
            }
        }
    }

    return attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
}

function normalizeTagName(tagName: string): string | null {
    const normalized = tagName.toLowerCase();
    if (normalized === 'html' || normalized === 'body') return null;
    return normalized;
}

function sanitizeColor(value: string): string | null {
    const trimmed = value.trim();
    return SAFE_COLOR_PATTERN.test(trimmed) ? trimmed : null;
}

function sanitizeHref(value: string): string | null {
    const trimmed = value.trim();
    if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
    return null;
}

function unquoteAttribute(value: string): string {
    const trimmed = value.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
    return escapeHtml(value).replace(/`/g, '&#96;');
}
