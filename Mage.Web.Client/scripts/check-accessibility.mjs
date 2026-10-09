#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(projectRoot, 'src');

const failures = [];

await checkModalAccessibility();
await checkReducedMotion();
await checkReadableContrast();
await checkHighScaleText();
await checkButtonAccessibleNames();
await checkCoverageDoc();

if (failures.length > 0) {
    console.error('Accessibility coverage check failed:');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log('Accessibility coverage check passed.');

async function checkModalAccessibility() {
    // every dialog goes through the app's Dialog, built on Radix: it supplies role="dialog", aria-modal,
    // the focus trap and focus return; the title names the dialog
    const source = await readProjectFile('src/app/ui/Dialog.tsx');
    const requiredSnippets = [
        ["from '@radix-ui/react-dialog'", 'the shared dialog must be built on Radix Dialog (focus trap, aria-modal, focus return)'],
        ['RadixDialog.Content', 'the shared dialog must render Radix dialog content'],
        ['RadixDialog.Title', 'the shared dialog must name itself with a Radix title'],
    ];

    for (const [snippet, label] of requiredSnippets) {
        if (!source.includes(snippet)) {
            failures.push(`${label} (${snippet})`);
        }
    }
}

async function checkReducedMotion() {
    const cssFiles = await listFiles(srcRoot, file => file.endsWith('.css'));
    const hasReducedMotion = await someFileContains(cssFiles, '@media (prefers-reduced-motion: reduce)');

    if (!hasReducedMotion) {
        failures.push('CSS must include a prefers-reduced-motion coverage block');
    }
}

async function checkReadableContrast() {
    // ink and status colours on the mat surfaces text sits on; translucent inks are blended over each surface
    const colors = extractCssColorVariables(await readProjectFile('src/app/styles/tokens.css'));
    const surfaces = ['--mat-950', '--mat-900', '--mat-800', '--mat-700'];
    const textPairs = [
        ['--ink', 4.5],
        ['--ink-strong', 4.5],
        ['--ink-soft', 4.5],
        ['--ink-dim', 4.5],
        ['--danger-text', 4.5],
        ['--sage', 4.5],
        ['--decision', 3],
    ];

    for (const [textVariable, minimumRatio] of textPairs) {
        for (const surfaceVariable of surfaces) {
            const textColor = colors.get(textVariable);
            const surfaceColor = colors.get(surfaceVariable);

            if (!textColor || !surfaceColor) {
                failures.push(`missing color variable for contrast check: ${textVariable} on ${surfaceVariable}`);
                continue;
            }

            const ratio = contrastRatio(blend(textColor, surfaceColor), surfaceColor);
            if (ratio < minimumRatio) {
                failures.push(`${textVariable} contrast on ${surfaceVariable} is ${ratio.toFixed(2)}:1, below ${minimumRatio}:1`);
            }
        }
    }
}

async function checkHighScaleText() {
    const cssFiles = await listFiles(srcRoot, file => file.endsWith('.css'));
    const viewportFontSizePattern = /font-size\s*:[^;]*(vw|vh|vmin|vmax)/i;

    for (const file of cssFiles) {
        const source = await readFile(file, 'utf8');
        const match = source.match(viewportFontSizePattern);

        if (match) {
            failures.push(`${relativePath(file)} uses viewport-scaled font sizing: ${match[0]}`);
        }
    }
}

async function checkButtonAccessibleNames() {
    const tsxFiles = (await listFiles(srcRoot, file => file.endsWith('.tsx')))
        .filter(file => !file.endsWith(`${path.sep}Button.tsx`));

    for (const file of tsxFiles) {
        const source = await readFile(file, 'utf8');
        for (const button of findButtonElements(source)) {
            if (hasAccessibleButtonName(button.attributes, button.body)) continue;

            failures.push(`${relativePath(file)}:${lineNumberAt(source, button.index)} has a button without a static, labelled, or documented dynamic accessible name`);
        }
    }
}

async function checkCoverageDoc() {
    const source = await readProjectFile('docs/AccessibilityCoverage.md');
    const expectedTopics = [
        'Keyboard-only play',
        'Focus traps',
        'Readable contrast',
        'Reduced motion',
        'Screen-reader names',
        'High-scale text',
    ];

    for (const topic of expectedTopics) {
        if (!source.includes(topic)) {
            failures.push(`AccessibilityCoverage.md must cover ${topic}`);
        }
    }
}

function findButtonElements(source) {
    const buttonPattern = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
    const buttons = [];
    let match;

    while ((match = buttonPattern.exec(source)) !== null) {
        buttons.push({
            index: match.index,
            attributes: match[1],
            body: match[2],
        });
    }

    return buttons;
}

function hasAccessibleButtonName(attributes, body) {
    if (/\b(aria-label|aria-labelledby|title)=/.test(attributes)) return true;
    if (/\bdata-a11y-dynamic-name\b/.test(attributes)) return true;

    const staticText = body
        .replace(/\{[\s\S]*?\}/g, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (/[A-Za-z0-9]{2,}/.test(staticText)) return true;

    return /\{[^}]*\b(label|title|name|text|displayName|pageName|tab\.label|activity\.title)\b[^}]*\}/i.test(body);
}

async function someFileContains(files, needle) {
    for (const file of files) {
        const source = await readFile(file, 'utf8');
        if (source.includes(needle)) return true;
    }

    return false;
}

async function readProjectFile(relativeFilePath) {
    return readFile(path.join(projectRoot, relativeFilePath), 'utf8');
}

async function listFiles(root, predicate) {
    const entries = await readdir(root, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFiles(fullPath, predicate));
        } else if (predicate(fullPath)) {
            files.push(fullPath);
        }
    }

    return files;
}

/** `--name: #rrggbb` and `--name: rgb(r g b / a)` declarations, as [r, g, b, a]. */
function extractCssColorVariables(source) {
    const colors = new Map();
    for (const match of source.matchAll(/(--[\w-]+)\s*:\s*#([0-9a-f]{6})\b/gi)) {
        const value = Number.parseInt(match[2], 16);
        colors.set(match[1], [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1]);
    }
    for (const match of source.matchAll(/(--[\w-]+)\s*:\s*rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)/gi)) {
        colors.set(match[1], [Number(match[2]), Number(match[3]), Number(match[4]), match[5] === undefined ? 1 : Number(match[5])]);
    }
    return colors;
}

/** A translucent colour as it shows over an opaque one. */
function blend([r, g, b, a], [sr, sg, sb]) {
    return [r * a + sr * (1 - a), g * a + sg * (1 - a), b * a + sb * (1 - a), 1];
}

function contrastRatio(foreground, background) {
    const foregroundLuminance = relativeLuminance(foreground);
    const backgroundLuminance = relativeLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);

    return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color) {
    const [red, green, blue] = color.slice(0, 3).map(channel => {
        const normalized = channel / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function lineNumberAt(source, index) {
    return source.slice(0, index).split('\n').length;
}

function relativePath(file) {
    return path.relative(projectRoot, file);
}
