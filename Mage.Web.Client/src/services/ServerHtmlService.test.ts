import assert from 'node:assert/strict';
import { test } from 'vitest';
import { sanitizeServerHtml, serverHtmlToPlainText } from './ServerHtmlService.js';

test('keeps simple server formatting while removing executable markup', () => {
    const html = 'Hello <b>mage</b><br><script>alert(1)</script><font color="#ff0000">red</font>';

    assert.equal(
        sanitizeServerHtml(html),
        'Hello <b>mage</b><br><font color="#ff0000">red</font>'
    );
});

test('strips unsafe attributes and links from notification html', () => {
    const html = '<a href="javascript:alert(1)" onclick="x()">bad</a> <a href="https://xmage.today">good</a>';

    assert.equal(
        sanitizeServerHtml(html),
        '<a>bad</a> <a href="https://xmage.today" target="_blank" rel="noopener noreferrer">good</a>'
    );
});

test('converts server html into browser notification text', () => {
    assert.equal(
        serverHtmlToPlainText('<html><body>Line <b>one</b><br>Line two</body></html>'),
        'Line one\nLine two'
    );
});
