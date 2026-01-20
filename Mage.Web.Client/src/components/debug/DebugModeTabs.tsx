import React from 'react';

type TabType = 'history' | 'board' | 'config';

interface DebugModeTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const DebugModeTabs: React.FC<DebugModeTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'history' as TabType, label: 'Action History', icon: '📜' },
    { id: 'board' as TabType, label: 'Board State', icon: '🎮' },
    { id: 'config' as TabType, label: 'Config', icon: '⚙️' },
  ];

  return (
    <div className="debug-mode-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`debug-mode-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="debug-mode-tab-icon">{tab.icon}</span>
          <span className="debug-mode-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};
