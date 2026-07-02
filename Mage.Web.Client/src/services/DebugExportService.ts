/**
 * Debug Export Service
 * 
 * Provides export functionality for debug data including
 * file downloads and clipboard operations.
 */

import { DebugExportData } from '../types/debug';

export class DebugExportService {

  static async exportAsJson(data: DebugExportData, filename?: string): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `mage-debug-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async exportAsText(data: DebugExportData, filename?: string): Promise<void> {
    const text = this.formatAsText(data);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `mage-debug-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async exportToClipboard(data: DebugExportData): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.formatAsText(data));
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      throw new Error('Clipboard access denied or not supported');
    }
  }

  static formatAsText(data: DebugExportData): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('XMAGE DEBUG EXPORT');
    lines.push('='.repeat(80));
    lines.push(`Generated: ${new Date(data.timestamp).toISOString()}`);
    lines.push('');

    lines.push('--- Metadata ---');
    lines.push(`Total Actions: ${data.metadata.totalActions}`);
    lines.push(`Total Callback Fixtures: ${data.metadata.totalCallbackFixtures}`);
    lines.push(`Match ID: ${data.metadata.matchId || 'N/A'}`);
    lines.push(`Last Update: ${new Date(data.metadata.lastUpdate).toISOString()}`);
    lines.push('');

    if (data.boardStateSummary) {
      lines.push('--- Board State ---');
      lines.push(this.formatBoardStateText(data.boardStateSummary));
      lines.push('');
    }

    if (data.currentGameView) {
      lines.push('--- Full GameView JSON ---');
      lines.push(JSON.stringify(data.currentGameView, null, 2));
      lines.push('');
    }

    lines.push('--- Action History ---');
    lines.push(this.formatActionHistoryText(data.actionHistory));

    return lines.join('\n');
  }

  static formatBoardStateText(summary: any): string {
    const lines: string[] = [];

    lines.push(`Turn: ${summary.turn}`);
    lines.push(`Phase: ${summary.phase}`);
    lines.push(`Step: ${summary.step}`);
    lines.push(`Active Player: ${summary.activePlayer}`);
    lines.push(`Priority Player: ${summary.priorityPlayer}`);
    lines.push(`Stack Items: ${summary.stackItems.length}`);
    lines.push(`Combat Groups: ${summary.combatGroups}`);
    lines.push('');

    lines.push('Players:');
    for (const player of summary.players) {
      lines.push(`  ${player.name}:`);
      lines.push(`    Life: ${player.life}`);
      lines.push(`    Hand: ${player.handCount}`);
      lines.push(`    Graveyard: ${player.graveyardCount}`);
      lines.push(`    Exile: ${player.exileCount}`);
      lines.push(`    Battlefield: ${player.battlefieldCount}`);
      lines.push(`    Library: ${player.libraryCount}`);
      lines.push(`    Mana Pool: W:${player.manaPool.white} U:${player.manaPool.blue} B:${player.manaPool.black} R:${player.manaPool.red} G:${player.manaPool.green} C:${player.manaPool.colorless}`);
      lines.push(`    Has Priority: ${player.hasPriority}`);
      lines.push(`    Is Active: ${player.isActive}`);
      if (player.designations.length > 0) {
        lines.push(`    Designations: ${player.designations.join(', ')}`);
      }
    }

    if (summary.stackItems.length > 0) {
      lines.push('');
      lines.push('Stack:');
      for (const item of summary.stackItems) {
        lines.push(`  - ${item.cardName} (${item.type}, controlled by ${item.controller})`);
      }
    }

    return lines.join('\n');
  }

  static formatActionHistoryText(actions: any[]): string {
    const lines: string[] = [];

    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];
      const timestamp = new Date(action.timestamp).toLocaleTimeString();
      const typeBadge = `[${action.actionType.toUpperCase()}]`;

      lines.push(`${timestamp} ${typeBadge} ${action.method}`);
      lines.push(`  ${action.summary}`);

      if (action.data && typeof action.data === 'object') {
        const dataStr = JSON.stringify(action.data, null, 2);
        if (dataStr.length < 200) {
          lines.push(`  Data: ${dataStr}`);
        } else {
          lines.push(`  Data: <${dataStr.length} chars - truncated>`);
        }
      }
      lines.push('');
    }

    if (actions.length === 0) {
      lines.push('(No action history available)');
    }

    return lines.join('\n');
  }
}
