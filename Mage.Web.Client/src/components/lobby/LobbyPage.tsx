/**
 * Lobby Page
 * 
 * Main lobby view with table list, chat, and table management.
 */

import React, { useEffect, useState } from 'react';
import { useSessionStore, useLobbyStore, useChatStore } from '../../stores';
import { Button, Navbar } from '../common';
import { TableList } from './TableList';
import { TableFilters } from './TableFilters';
import { TableDetails } from './TableDetails';
import { ChatPanel } from '../chat/ChatPanel';
import { CreateTableDialog } from './CreateTableDialog';
import { JoinTableDialog } from './JoinTableDialog';
import { WaitingRoom } from './WaitingRoom';
import { TableView } from '../../types';
import './LobbyPage.css';

interface LobbyPageProps {
    onEnterGame: (gameId: string) => void;
    onLogout: () => void;
    onOpenDeckEditor: () => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({ onEnterGame, onLogout, onOpenDeckEditor }) => {
    const [showCreateTable, setShowCreateTable] = useState(false);
    const [showJoinTable, setShowJoinTable] = useState(false);
    const [selectedTable, setSelectedTable] = useState<TableView | null>(null);

    const { userName, mainRoomId, logout } = useSessionStore();
    const {
        tables,
        filteredTables,
        isLoading,
        startPolling,
        stopPolling,
        currentTable,
        watchTable,
        selectTable,
        selectedTableId,
    } = useLobbyStore();
    const { joinLobbyChat } = useChatStore();

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

    const handleTableCreated = (tableId: string) => {
        setShowCreateTable(false);
        // Select the newly created table
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
            />

            {/* Main content */}
            <main className="lobby-main">
                {/* Left: Tables section */}
                <section className="lobby-tables">
                    <div className="section-header">
                        <h2>Game Tables</h2>
                        <Button
                            variant="primary"
                            onClick={() => setShowCreateTable(true)}
                        >
                            + Create Table
                        </Button>
                    </div>

                    <TableFilters />

                    <TableList
                        tables={filteredTables}
                        isLoading={isLoading}
                        onTableClick={handleTableClick}
                        onJoin={(tableId: string) => {
                            const table = filteredTables.find(t => t.tableId === tableId);
                            if (table) handleJoinClick(table);
                        }}
                        onWatch={(tableId: string) => {
                            const table = filteredTables.find(t => t.tableId === tableId);
                            if (table) handleWatchClick(table);
                        }}
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

                    {/* Chat always visible at bottom */}
                    <ChatPanel />
                </aside>
            </main>

            {/* Create table dialog */}
            <CreateTableDialog
                isOpen={showCreateTable}
                onClose={() => setShowCreateTable(false)}
                onTableCreated={handleTableCreated}
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
