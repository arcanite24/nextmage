/**
 * Lobby Page
 * 
 * Main lobby view with table list, chat, and table management.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useSessionStore, useLobbyStore, useChatStore } from '../../stores';
import { Button, Navbar } from '../common';
import { TableList } from './TableList';
import { TableFilters } from './TableFilters';
import { TableDetails } from './TableDetails';
import { LobbyInfoPanels } from './LobbyInfoPanels';
import { ChatPanel } from '../chat/ChatPanel';
import { CreateTableDialog } from './CreateTableDialog';
import { CreateTournamentDialog } from './CreateTournamentDialog';
import { JoinTableDialog } from './JoinTableDialog';
import { WaitingRoom } from './WaitingRoom';
import { appConfigService, webSocketBridgeService } from '../../services';
import { MatchView, TableView } from '../../types';
import './LobbyPage.css';

interface LobbyPageProps {
    onEnterGame: (gameId: string) => void;
    onLogout: () => void;
    onOpenDeckEditor: () => void;
    onOpenTournament: (tableId: string, title: string) => void;
    supportMenu?: React.ReactNode;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({
    onEnterGame,
    onLogout,
    onOpenDeckEditor,
    onOpenTournament,
    supportMenu,
}) => {
    const [showCreateTable, setShowCreateTable] = useState(false);
    const [showCreateTournament, setShowCreateTournament] = useState(false);
    const [showJoinTable, setShowJoinTable] = useState(false);
    const [selectedTable, setSelectedTable] = useState<TableView | null>(null);
    const [ignoredUsers, setIgnoredUsers] = useState<string[]>(() =>
        appConfigService.loadIgnoredUsers(useSessionStore.getState().serverUrl)
    );
    const [chatDraft, setChatDraft] = useState<string | null>(null);

    const { userName, sessionId, mainRoomId, serverUrl, logout, showAlert } = useSessionStore();
    const {
        tables,
        filteredTables,
        finishedMatches,
        filteredFinishedMatches,
        roomUsers,
        isLoading,
        startPolling,
        stopPolling,
        currentTable,
        watchTable,
        selectTable,
        selectedTableId,
        tableLayout,
        setTableSort,
        setTableColumnOrder,
        setTableColumnWidth,
        resetTableLayout,
        refreshTableFilters,
    } = useLobbyStore();
    const {
        joinLobbyChat,
        lobbyChannelId,
        sendMessage,
        setActiveChannel,
    } = useChatStore();

    // Find the selected table from the list
    const detailsTable = selectedTableId
        ? filteredTables.find(t => t.tableId === selectedTableId) || null
        : null;

    useEffect(() => {
        // Start polling for tables and join lobby chat
        if (mainRoomId) {
            startPolling(5000);
            joinLobbyChat(mainRoomId);
        }

        return () => {
            stopPolling();
        };
    }, [mainRoomId, startPolling, stopPolling, joinLobbyChat]);

    useEffect(() => {
        setIgnoredUsers(appConfigService.loadIgnoredUsers(serverUrl));
    }, [serverUrl]);

    const handleIgnoreUser = useCallback((targetUserName: string) => {
        const nextUsers = appConfigService.addIgnoredUser(serverUrl, targetUserName);
        setIgnoredUsers(nextUsers);
        refreshTableFilters();
        showAlert('Ignored user', `${targetUserName} cannot chat with you or join new tables you create on this server.`);
    }, [serverUrl, refreshTableFilters, showAlert]);

    const handleUnignoreUser = useCallback((targetUserName: string) => {
        const nextUsers = appConfigService.removeIgnoredUser(serverUrl, targetUserName);
        setIgnoredUsers(nextUsers);
        refreshTableFilters();
        showAlert('Ignored user removed', `${targetUserName} can join new tables you create on this server again.`);
    }, [serverUrl, refreshTableFilters, showAlert]);

    const handleWhisperUser = useCallback((targetUserName: string) => {
        if (lobbyChannelId) {
            setActiveChannel(lobbyChannelId);
        }
        setChatDraft(`/w ${targetUserName} `);
    }, [lobbyChannelId, setActiveChannel]);

    const handleShowUserHistory = useCallback((targetUserName: string) => {
        if (!lobbyChannelId) {
            showAlert('Player history', 'Lobby chat is still joining. Try again in a moment.');
            return;
        }

        setActiveChannel(lobbyChannelId);
        void sendMessage(`/history ${targetUserName}`, lobbyChannelId);
    }, [lobbyChannelId, sendMessage, setActiveChannel, showAlert]);

    const handleChatDraftConsumed = useCallback(() => {
        setChatDraft(null);
    }, []);

    const handleLogout = () => {
        stopPolling();
        logout();
        onLogout();
    };

    const handleTableClick = (table: TableView) => {
        selectTable(table.tableId);
    };

    const handleJoinClick = (table: TableView) => {
        setSelectedTable(table);
        setShowJoinTable(true);
    };

    const handleWatchClick = async (table: TableView) => {
        const success = await watchTable(table.tableId);
        if (success) {
            // This would transition to the game viewer
            // For now, just log it
            console.log('Watching table:', table.tableId);
        }
    };

    const handleShowTournamentClick = useCallback(async (tableId: string, title: string) => {
        try {
            const success = await webSocketBridgeService.watchTournament(sessionId, tableId);
            if (!success) {
                showAlert('Tournament', 'The server did not open this tournament. Showing the local activity shell instead.');
                onOpenTournament(tableId, title);
            }
        } catch (error) {
            console.error('Failed to open tournament:', error);
            showAlert('Tournament', error instanceof Error ? error.message : 'Failed to open the tournament.');
            onOpenTournament(tableId, title);
        }
    }, [onOpenTournament, sessionId, showAlert]);

    const handleReplayClick = async (match: MatchView) => {
        const gameId = match.games?.[0];
        if (!gameId || !match.replayAvailable) return;

        try {
            await webSocketBridgeService.initReplay(gameId, sessionId);
            await webSocketBridgeService.startReplay(gameId, sessionId);
        } catch (error) {
            console.error('Failed to start replay:', error);
        }
    };

    const handleTableCreated = (tableId: string) => {
        setShowCreateTable(false);
        // Select the newly created table
        selectTable(tableId);
    };

    const handleTournamentCreated = (tableId: string) => {
        setShowCreateTournament(false);
        selectTable(tableId);
    };

    const handleTableJoined = () => {
        setShowJoinTable(false);
        // The server will send a callback that transitions to the game
    };

    return (
        <div className="lobby-page">
            {/* Navbar */}
            <Navbar
                currentPage="lobby"
                onNavigate={(page) => {
                    if (page === 'decks') onOpenDeckEditor();
                    // Add other navigation targets as needed
                }}
                onLogout={handleLogout}
                supportMenu={supportMenu}
            />

            {/* Main content */}
            <main className="lobby-main">
                {/* Left: Tables section */}
                <section className="lobby-tables">
                    <div className="section-header">
                        <h2>Game Tables</h2>
                        <div className="section-header-actions">
                            <Button
                                variant="secondary"
                                onClick={() => setShowCreateTournament(true)}
                            >
                                + Create Tournament
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => setShowCreateTable(true)}
                            >
                                + Create Table
                            </Button>
                        </div>
                    </div>

                    <TableFilters />

                    <TableList
                        tables={filteredTables}
                        finishedMatches={filteredFinishedMatches}
                        isLoading={isLoading}
                        userName={userName}
                        onTableClick={handleTableClick}
                        onJoin={(tableId: string) => {
                            const table = filteredTables.find(t => t.tableId === tableId);
                            if (table) handleJoinClick(table);
                        }}
                        onWatch={(tableId: string) => {
                            const table = filteredTables.find(t => t.tableId === tableId);
                            if (table) handleWatchClick(table);
                        }}
                        onShowTournament={handleShowTournamentClick}
                        onReplay={handleReplayClick}
                        tableLayout={tableLayout}
                        onSortChange={setTableSort}
                        onColumnOrderChange={setTableColumnOrder}
                        onColumnWidthChange={setTableColumnWidth}
                        onResetTableLayout={resetTableLayout}
                        selectedTableId={selectedTableId}
                    />
                </section>

                {/* Right sidebar */}
                <aside className="lobby-sidebar">
                    {/* Table details (if selected) or chat */}
                    {detailsTable ? (
                        <TableDetails
                            table={detailsTable}
                            onJoin={() => handleJoinClick(detailsTable)}
                            onWatch={() => handleWatchClick(detailsTable)}
                            onClose={() => selectTable(null)}
                        />
                    ) : (
                        <div className="sidebar-placeholder">
                            <p>Select a table to view details</p>
                        </div>
                    )}

                    <LobbyInfoPanels
                        roomUsers={roomUsers}
                        finishedMatches={finishedMatches}
                        currentUserName={userName}
                        ignoredUsers={ignoredUsers}
                        onWhisperUser={handleWhisperUser}
                        onShowUserHistory={handleShowUserHistory}
                        onIgnoreUser={handleIgnoreUser}
                        onUnignoreUser={handleUnignoreUser}
                        onReplay={handleReplayClick}
                    />

                    {/* Chat always visible at bottom */}
                    <ChatPanel
                        draftMessage={chatDraft}
                        onDraftConsumed={handleChatDraftConsumed}
                    />
                </aside>
            </main>

            {/* Create table dialog */}
            <CreateTableDialog
                isOpen={showCreateTable}
                onClose={() => setShowCreateTable(false)}
                onTableCreated={handleTableCreated}
            />

            <CreateTournamentDialog
                isOpen={showCreateTournament}
                onClose={() => setShowCreateTournament(false)}
                onTournamentCreated={handleTournamentCreated}
            />

            {/* Join table dialog */}
            <JoinTableDialog
                isOpen={showJoinTable}
                onClose={() => setShowJoinTable(false)}
                table={selectedTable}
                onJoined={handleTableJoined}
            />

            {/* Waiting Room Overlay */}
            {currentTable && !isLoading && (
                <WaitingRoom />
            )}
        </div>
    );
};

export default LobbyPage;
