export class CallbackFixtureService {
    static toFixture(callback, capturedAt = Date.now()) {
        return {
            capturedAt,
            messageId: callback.messageId,
            method: callback.method,
            objectId: callback.objectId,
            data: callback.data,
        };
    }
    static toCallback(fixture) {
        return {
            messageId: fixture.messageId,
            method: fixture.method,
            objectId: fixture.objectId,
            data: fixture.data,
        };
    }
    static serialize(fixtures) {
        return JSON.stringify(fixtures, null, 2);
    }
    static parse(input) {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
            return parsed.map((fixture) => this.assertFixture(fixture));
        }
        if (this.isRecord(parsed) && Array.isArray(parsed.callbackFixtures)) {
            return parsed.callbackFixtures.map((fixture) => this.assertFixture(fixture));
        }
        throw new Error('Expected a callback fixture array or debug export with callbackFixtures');
    }
    static parseCallbacks(input) {
        return this.parse(input).map((fixture) => this.toCallback(fixture));
    }
    static fromDebugExport(data) {
        return data.callbackFixtures;
    }
    static assertFixture(value) {
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
            method: value.method,
            objectId: value.objectId,
            data: value.data,
        };
    }
    static isRecord(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
