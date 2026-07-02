import type { ClientCallback, UUID } from '../types/index.js';

interface TournamentLifecycleOptions {
    getSessionId: () => string | null | undefined;
    joinTournament: (tournamentId: UUID, sessionId: string) => Promise<boolean>;
    joinDraft?: (draftId: UUID, sessionId: string) => Promise<boolean>;
    onError?: (error: unknown, tournamentId: UUID) => void;
}

export interface TournamentLifecycleHandler {
    handleCallback: (callback: ClientCallback) => void;
}

export function createTournamentLifecycleHandler(options: TournamentLifecycleOptions): TournamentLifecycleHandler {
    const joinedTournamentIds = new Set<UUID>();
    const pendingTournamentIds = new Set<UUID>();
    const joinedDraftIds = new Set<UUID>();
    const pendingDraftIds = new Set<UUID>();

    return {
        handleCallback: (callback) => {
            if (callback.method === 'startDraft' && callback.objectId && options.joinDraft) {
                const draftId = callback.objectId;
                if (joinedDraftIds.has(draftId) || pendingDraftIds.has(draftId)) {
                    return;
                }

                const sessionId = options.getSessionId();
                if (!sessionId) {
                    return;
                }

                pendingDraftIds.add(draftId);
                options.joinDraft(draftId, sessionId)
                    .then((joined) => {
                        if (joined) {
                            joinedDraftIds.add(draftId);
                        }
                    })
                    .catch((error) => {
                        options.onError?.(error, draftId);
                    })
                    .finally(() => {
                        pendingDraftIds.delete(draftId);
                    });
                return;
            }

            if (callback.method !== 'startTournament' || !callback.objectId) {
                return;
            }

            const tournamentId = callback.objectId;
            if (joinedTournamentIds.has(tournamentId) || pendingTournamentIds.has(tournamentId)) {
                return;
            }

            const sessionId = options.getSessionId();
            if (!sessionId) {
                return;
            }

            pendingTournamentIds.add(tournamentId);
            options.joinTournament(tournamentId, sessionId)
                .then((joined) => {
                    if (joined) {
                        joinedTournamentIds.add(tournamentId);
                    }
                })
                .catch((error) => {
                    options.onError?.(error, tournamentId);
                })
                .finally(() => {
                    pendingTournamentIds.delete(tournamentId);
                });
        },
    };
}
