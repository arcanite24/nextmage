import assert from 'node:assert/strict';
import test from 'node:test';
import { applyClientKeybind, KeybindService } from './KeybindService.js';
function keyboardEvent(overrides = {}) {
    let prevented = false;
    return {
        altKey: false,
        ctrlKey: false,
        key: '1',
        metaKey: false,
        preventDefault: () => {
            prevented = true;
        },
        repeat: false,
        shiftKey: false,
        target: null,
        get defaultPrevented() {
            return prevented;
        },
        ...overrides,
    };
}
test('runs separate Alt+1 keydown and keyup handlers', () => {
    const service = new KeybindService();
    const calls = [];
    service.registerMany([
        {
            id: 'first-mana-on',
            label: 'Hold first mana ability',
            key: '1',
            altKey: true,
            ignoreRepeat: true,
            handler: () => {
                calls.push('on');
            },
        },
        {
            id: 'first-mana-off',
            label: 'Release first mana ability',
            key: '1',
            eventType: 'keyup',
            altKey: true,
            handler: () => {
                calls.push('off');
            },
        },
    ]);
    const down = keyboardEvent({ altKey: true });
    const repeat = keyboardEvent({ altKey: true, repeat: true });
    const up = keyboardEvent({ altKey: true });
    service.handleKeyDown(down);
    service.handleKeyDown(repeat);
    service.handleKeyUp(up);
    assert.deepEqual(calls, ['on', 'off']);
    assert.equal(down.defaultPrevented, true);
    assert.equal(repeat.defaultPrevented, true);
    assert.equal(up.defaultPrevented, true);
});
test('requires explicit Alt modifier when altKey is true', () => {
    const service = new KeybindService();
    let calls = 0;
    service.registerMany([
        {
            id: 'first-mana-on',
            label: 'Hold first mana ability',
            key: '1',
            altKey: true,
            handler: () => {
                calls += 1;
            },
        },
    ]);
    const plainOne = keyboardEvent();
    service.handleKeyDown(plainOne);
    assert.equal(calls, 0);
    assert.equal(plainOne.defaultPrevented, false);
});
test('ignores shortcuts when typing into editable controls', () => {
    const originalInputElement = globalThis.HTMLInputElement;
    class FakeInputElement {
    }
    globalThis.HTMLInputElement = FakeInputElement;
    try {
        const service = new KeybindService();
        let calls = 0;
        service.registerMany([
            {
                id: 'first-mana-on',
                label: 'Hold first mana ability',
                key: '1',
                altKey: true,
                handler: () => {
                    calls += 1;
                },
            },
        ]);
        const event = keyboardEvent({
            altKey: true,
            target: new FakeInputElement(),
        });
        service.handleKeyDown(event);
        assert.equal(calls, 0);
        assert.equal(event.defaultPrevented, false);
    }
    finally {
        globalThis.HTMLInputElement = originalInputElement;
    }
});
test('applies persisted client keybind overrides', () => {
    const definition = applyClientKeybind({
        id: 'confirm-request',
        actionId: 'confirm',
        label: 'Confirm current request',
        key: 'F2',
        handler: () => { },
    }, {
        key: 'Enter',
        eventType: 'keyup',
        ctrlOrMeta: true,
        altKey: false,
        shiftKey: true,
        enabled: true,
    });
    assert.deepEqual(definition && {
        key: definition.key,
        eventType: definition.eventType,
        ctrlOrMeta: definition.ctrlOrMeta,
        altKey: definition.altKey,
        shiftKey: definition.shiftKey,
    }, {
        key: 'Enter',
        eventType: 'keyup',
        ctrlOrMeta: true,
        altKey: false,
        shiftKey: true,
    });
});
test('disables keybinds from client settings', () => {
    const definition = applyClientKeybind({
        id: 'toggle-macro',
        actionId: 'toggleMacro',
        label: 'Toggle macro recording',
        key: 'm',
        handler: () => { },
    }, {
        key: 'm',
        eventType: 'keydown',
        ctrlOrMeta: true,
        altKey: false,
        shiftKey: false,
        enabled: false,
    });
    assert.equal(definition, null);
});
