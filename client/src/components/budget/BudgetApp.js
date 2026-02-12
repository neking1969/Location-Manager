import React, { useState } from 'react';
import Dashboard from './Dashboard';
import BudgetsList from './BudgetsList';
import BudgetDetail from './BudgetDetail';
import LocationsList from './LocationsList';
import LocationDetail from './LocationDetail';
import TransactionsList from './TransactionsList';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'chart' },
  { id: 'budgets', label: 'Budgets', icon: 'wallet' },
  { id: 'locations', label: 'Locations', icon: 'pin' },
  { id: 'transactions', label: 'Transactions', icon: 'receipt' },
];

function TabIcon({ icon, active }) {
  const color = active ? 'var(--accent)' : 'var(--muted)';
  const svgs = {
    chart: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
      </svg>
    ),
    wallet: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
      </svg>
    ),
    pin: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
      </svg>
    ),
    receipt: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
        <path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" />
      </svg>
    ),
  };
  return svgs[icon] || null;
}

function BudgetApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [navigationStack, setNavigationStack] = useState([]);

  const navigateTo = (view, data = null) => {
    setNavigationStack(prev => [...prev, { tab: activeTab, view: currentView, data: currentData }]);
    setCurrentView(view);
    setCurrentData(data);
  };

  const goBack = () => {
    if (navigationStack.length > 0) {
      const prev = navigationStack[navigationStack.length - 1];
      setNavigationStack(stack => stack.slice(0, -1));
      setActiveTab(prev.tab);
      setCurrentView(prev.view);
      setCurrentData(prev.data);
    }
  };

  const [currentView, setCurrentView] = useState(null);
  const [currentData, setCurrentData] = useState(null);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCurrentView(null);
    setCurrentData(null);
    setNavigationStack([]);
  };

  const renderContent = () => {
    // Detail views
    if (currentView === 'budget-detail' && currentData) {
      return <BudgetDetail budgetId={currentData} onBack={goBack} onNavigate={navigateTo} />;
    }
    if (currentView === 'location-detail' && currentData) {
      return <LocationDetail locationId={currentData} onBack={goBack} onNavigate={navigateTo} />;
    }

    // Tab views
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={navigateTo} />;
      case 'budgets':
        return <BudgetsList onNavigate={navigateTo} />;
      case 'locations':
        return <LocationsList onNavigate={navigateTo} />;
      case 'transactions':
        return <TransactionsList onNavigate={navigateTo} />;
      default:
        return <Dashboard onNavigate={navigateTo} />;
    }
  };

  return (
    <div className="budget-app">
      <div className="budget-app-content">
        {renderContent()}
      </div>

      <nav className="bottom-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`bottom-tab ${activeTab === tab.id && !currentView ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <TabIcon icon={tab.icon} active={activeTab === tab.id && !currentView} />
            <span className="bottom-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default BudgetApp;
