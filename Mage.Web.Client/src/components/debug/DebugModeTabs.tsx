import React from 'react';
import { Gamepad2, ScrollText, Settings } from 'lucide-react';

type TabType = 'history' | 'board' | 'config';

interface DebugModeTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const DebugModeTabs: React.FC<DebugModeTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'history' as TabType, label: 'Action History', icon: ScrollText },
    { id: 'board' as TabType, label: 'Board State', icon: Gamepad2 },
    { id: 'config' as TabType, label: 'Config', icon: Settings },
  ];

  return (
    <div className="debug-mode-tabs">
      {tabs.map(tab => {
        const Icon = tab.icon;
        return (
        <button
          key={tab.id}
          className={`debug-mode-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <Icon className="debug-mode-tab-icon" size={16} aria-hidden="true" />
          <span className="debug-mode-tab-label">{tab.label}</span>
        </button>
        );
      })}
    </div>
  );
};
