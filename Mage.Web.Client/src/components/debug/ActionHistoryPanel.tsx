import React, { useState, useMemo } from 'react';
import { useDebugStore } from '../../stores/debugStore';
import { ActionEntry } from './ActionEntry';

export const ActionHistoryPanel: React.FC = () => {
  const { actions } = useDebugStore();
  const [filter, setFilter] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');

  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      if (actionTypeFilter !== 'all' && action.actionType !== actionTypeFilter) {
        return false;
      }

      if (filter) {
        const searchLower = filter.toLowerCase();
        return (
          action.summary.toLowerCase().includes(searchLower) ||
          action.method.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [actions, filter, actionTypeFilter]);

  return (
    <div className="action-history-panel">
      <div className="action-history-filters">
        <input
          type="text"
          className="action-history-search"
          placeholder="Search actions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <select
          className="action-history-filter-type"
          value={actionTypeFilter}
          onChange={(e) => setActionTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="state">State Updates</option>
          <option value="interaction">Interactions</option>
          <option value="error">Errors</option>
          <option value="system">System</option>
        </select>

        <div className="action-history-count">
          {filteredActions.length} actions
        </div>
      </div>

      <div className="action-history-list">
        {filteredActions.length === 0 ? (
          <div className="action-history-empty">No actions match your filters</div>
        ) : (
          filteredActions.map(action => (
            <ActionEntry key={action.id} action={action} />
          ))
        )}
      </div>
    </div>
  );
};
