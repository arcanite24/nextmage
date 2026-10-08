import type { PlayerAction, UserRequestMessage } from '../types/api.js';

export interface UserRequestButton {
    index: 1 | 2 | 3;
    text: string;
    action: PlayerAction | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readAction(value: unknown): PlayerAction | null {
    return typeof value === 'string' && value.length > 0 ? value as PlayerAction : null;
}

export class UserRequestService {
    static normalize(input: unknown): UserRequestMessage {
        if (!isRecord(input)) {
            return {
                title: 'Message',
                message: String(input ?? ''),
                button1Text: 'OK',
                button1Action: null,
            };
        }

        return {
            title: readString(input.title) ?? 'Message',
            message: readString(input.message) ?? '',
            windowSizeRatio: readNumber(input.windowSizeRatio),
            relatedUserId: readString(input.relatedUserId),
            relatedUserName: readString(input.relatedUserName),
            matchId: readString(input.matchId),
            tournamentId: readString(input.tournamentId),
            gameId: readString(input.gameId),
            roomId: readString(input.roomId),
            tableId: readString(input.tableId),
            button1Text: readString(input.button1Text),
            button1Action: readAction(input.button1Action),
            button2Text: readString(input.button2Text),
            button2Action: readAction(input.button2Action),
            button3Text: readString(input.button3Text),
            button3Action: readAction(input.button3Action),
        };
    }

    static getButtons(message: UserRequestMessage): UserRequestButton[] {
        const buttons: UserRequestButton[] = [];

        if (message.button3Text) {
            buttons.push({ index: 3, text: message.button3Text, action: message.button3Action ?? null });
        }

        if (message.button2Text) {
            buttons.push({ index: 2, text: message.button2Text, action: message.button2Action ?? null });
        }

        if (message.button1Text) {
            buttons.push({ index: 1, text: message.button1Text, action: message.button1Action ?? null });
        }

        return buttons.length > 0 ? buttons : [{ index: 1, text: 'OK', action: null }];
    }

    static getButton(message: UserRequestMessage, index: 1 | 2 | 3): UserRequestButton | null {
        return this.getButtons(message).find(button => button.index === index) ?? null;
    }
}
