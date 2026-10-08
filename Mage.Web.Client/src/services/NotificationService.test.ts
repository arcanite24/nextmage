import assert from 'node:assert/strict';
import { test } from 'vitest';
import { getNotificationAutoDismissDelay, NotificationService } from './NotificationService.js';
import type { ClientCallback } from '../types/api.js';

const service = new NotificationService();

function callback(method: ClientCallback['method'], data: unknown = {}, messageId = 1): ClientCallback {
    return {
        method,
        data,
        messageId,
        objectId: '00000000-0000-0000-0000-000000000001',
    };
}

test('notifies when a match starts', () => {
    const notification = service.fromCallback(callback('startGame'));

    assert.equal(notification?.title, 'Match started');
    assert.equal(notification?.kind, 'game');
    assert.equal(notification?.browser, true);
});

test('keeps game priority prompts out of the in-app toast stack', () => {
    const notification = service.fromCallback(callback('gameTarget', { message: 'Choose a target' }));

    assert.equal(notification?.title, 'Priority needed');
    assert.equal(notification?.message, 'Choose a target');
    assert.equal(notification?.tone, 'warning');
    assert.equal(notification?.browser, true);
    assert.equal(notification?.toast, false);
    assert.equal(notification?.dedupeKey, 'priority:00000000-0000-0000-0000-000000000001:gameTarget');
});

test('notifies when a draft pick is ready', () => {
    const notification = service.fromCallback(callback('draftPick', { message: 'Pick one card' }));

    assert.equal(notification?.title, 'Draft pick ready');
    assert.equal(notification?.kind, 'draft');
    assert.equal(notification?.message, 'Pick one card');
});

test('notifies for tournament round updates', () => {
    const notification = service.fromCallback(callback('tournamentUpdate'));

    assert.equal(notification?.title, 'Tournament round update');
    assert.equal(notification?.kind, 'tournament');
    assert.equal(notification?.browser, true);
});

test('notifies for major server and user messages', () => {
    const userMessage = service.fromCallback(callback('showUserMessage', ['Warning', 'Server restart soon']));
    const serverMessage = service.fromCallback(callback('serverMessage', { message: '<b>Welcome</b> back' }));

    assert.equal(userMessage?.title, 'Warning');
    assert.equal(userMessage?.message, 'Server restart soon');
    assert.equal(userMessage?.browser, true);
    assert.equal(serverMessage?.title, 'Server message');
    assert.equal(serverMessage?.message, '<b>Welcome</b> back');
});

test('notifies for connection loss and reconnect attempts', () => {
    const lost = service.fromConnectionStatus('connected', 'disconnected', true);
    const reconnecting = service.fromConnectionStatus('disconnected', 'connecting', true);
    const websocketReconnecting = service.fromConnectionStatus('connected', 'reconnecting', true);
    const restored = service.fromConnectionStatus('reconnecting', 'connected', true);

    assert.equal(lost?.title, 'Connection lost');
    assert.equal(lost?.browser, true);
    assert.equal(reconnecting?.title, 'Reconnecting');
    assert.equal(websocketReconnecting?.title, 'Reconnecting');
    assert.equal(reconnecting?.browser, false);
    assert.equal(restored?.title, 'Reconnected');
});

test('does not notify for ordinary game updates', () => {
    assert.equal(service.fromCallback(callback('gameUpdate')), null);
});

test('gives every notification tone an auto-dismiss delay', () => {
    assert.ok(getNotificationAutoDismissDelay('info') > 0);
    assert.ok(getNotificationAutoDismissDelay('success') > 0);
    assert.ok(getNotificationAutoDismissDelay('warning') > 0);
    assert.ok(getNotificationAutoDismissDelay('danger') > 0);
    assert.ok(getNotificationAutoDismissDelay('danger') > getNotificationAutoDismissDelay('info'));
});
