import type { ClientCallback } from '../types/api.js';

export interface CallbackFixture {
    capturedAt: number;
    messageId: number;
    method: ClientCallback['method'];
    objectId: ClientCallback['objectId'];
    data: unknown;
}

export interface CallbackFixtureExport {
    callbackFixtures: CallbackFixture[];
}

export class CallbackFixtureService {
    static toFixture(callback: ClientCallback, capturedAt = Date.now()): CallbackFixture {
        return {
            capturedAt,
            messageId: callback.messageId,
            method: callback.method,
            objectId: callback.objectId,
            data: callback.data,
        };
    }

    static toCallback(fixture: CallbackFixture): ClientCallback {
        return {
            messageId: fixture.messageId,
            method: fixture.method,
            objectId: fixture.objectId,
            data: fixture.data,
        };
    }

    static serialize(fixtures: CallbackFixture[]): string {
        return JSON.stringify(fixtures, null, 2);
    }

    static parse(input: string): CallbackFixture[] {
        const parsed = JSON.parse(input) as unknown;

        if (Array.isArray(parsed)) {
            return parsed.map((fixture) => this.assertFixture(fixture));
        }

        if (this.isRecord(parsed) && Array.isArray(parsed.callbackFixtures)) {
            return parsed.callbackFixtures.map((fixture) => this.assertFixture(fixture));
        }

        throw new Error('Expected a callback fixture array or debug export with callbackFixtures');
    }

    static parseCallbacks(input: string): ClientCallback[] {
        return this.parse(input).map((fixture) => this.toCallback(fixture));
    }

    static fromDebugExport(data: CallbackFixtureExport): CallbackFixture[] {
        return data.callbackFixtures;
    }

    private static assertFixture(value: unknown): CallbackFixture {
        if (!this.isRecord(value)) {
            throw new Error('Callback fixture must be an object');
        }

        if (typeof value.capturedAt !== 'number') {
            throw new Error('Callback fixture is missing capturedAt');
        }

        if (typeof value.messageId !== 'number') {
            throw new Error('Callback fixture is missing messageId');
        }

        if (typeof value.method !== 'string') {
            throw new Error('Callback fixture is missing method');
        }

        if (value.objectId !== null && typeof value.objectId !== 'string') {
            throw new Error('Callback fixture objectId must be a string or null');
        }

        return {
            capturedAt: value.capturedAt,
            messageId: value.messageId,
            method: value.method as CallbackFixture['method'],
            objectId: value.objectId,
            data: value.data,
        };
    }

    private static isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
