import assert from 'node:assert/strict';
import { test } from 'vitest';
import { UserRequestService } from './UserRequestService.js';

test('normalizes Java user request payloads', () => {
    const request = UserRequestService.normalize({
        title: 'Confirm disconnect',
        message: 'Wait for me?',
        windowSizeRatio: 1.3,
        gameId: '11111111-1111-4111-8111-111111111111',
        relatedUserId: '22222222-2222-4222-8222-222222222222',
        button1Text: 'Cancel',
        button1Action: null,
        button2Text: 'Wait for me',
        button2Action: 'CLIENT_DISCONNECT_KEEP_GAMES',
        button3Text: 'Quit',
        button3Action: 'CLIENT_DISCONNECT_FULL',
    });

    assert.equal(request.title, 'Confirm disconnect');
    assert.equal(request.message, 'Wait for me?');
    assert.equal(request.windowSizeRatio, 1.3);
    assert.equal(request.gameId, '11111111-1111-4111-8111-111111111111');
    assert.equal(request.relatedUserId, '22222222-2222-4222-8222-222222222222');
    assert.equal(request.button2Action, 'CLIENT_DISCONNECT_KEEP_GAMES');
});

test('returns buttons in desktop visual order while preserving button indexes', () => {
    const request = UserRequestService.normalize({
        title: 'Confirm',
        message: 'Choose',
        button1Text: 'Cancel',
        button1Action: null,
        button2Text: 'Wait',
        button2Action: 'CLIENT_DISCONNECT_KEEP_GAMES',
        button3Text: 'Quit',
        button3Action: 'CLIENT_DISCONNECT_FULL',
    });

    assert.deepEqual(UserRequestService.getButtons(request), [
        { index: 3, text: 'Quit', action: 'CLIENT_DISCONNECT_FULL' },
        { index: 2, text: 'Wait', action: 'CLIENT_DISCONNECT_KEEP_GAMES' },
        { index: 1, text: 'Cancel', action: null },
    ]);
});

test('falls back to an OK button for simple messages', () => {
    const request = UserRequestService.normalize('Server restarted');

    assert.deepEqual(UserRequestService.getButtons(request), [
        { index: 1, text: 'OK', action: null },
    ]);
});

test('finds a selected button by its Java button index', () => {
    const request = UserRequestService.normalize({
        title: 'Confirm',
        message: 'Choose',
        button2Text: 'Yes',
        button2Action: 'CLIENT_RECONNECT',
    });

    assert.deepEqual(UserRequestService.getButton(request, 2), {
        index: 2,
        text: 'Yes',
        action: 'CLIENT_RECONNECT',
    });
    assert.equal(UserRequestService.getButton(request, 3), null);
});
