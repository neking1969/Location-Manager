import React, { useState } from 'react';
import { usePortfolioData } from './hooks/usePortfolioData';
import Overview from './components/Overview';
import AIAdvisor from './components/AIAdvisor';
import TodoList from './components/TodoList';
import Calculator from './components/Calculator';
import Pension from './components/Pension';
import Goals2026 from './components/Goals2026';
import Navigation from './components/Navigation';

const TABS = ['overview', 'advisor', 'todo', 'calc', 'pension', '2026'];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const portfolioData = usePortfolioData();

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview data={portfolioData} />;
      case 'advisor':
        return <AIAdvisor data={portfolioData} />;
      case 'todo':
        return <TodoList />;
      case 'calc':
        return <Calculator data={portfolioData} />;
      case 'pension':
        return <Pension data={portfolioData} />;
      case '2026':
        return <Goals2026 data={portfolioData} />;
      default:
        return <Overview data={portfolioData} />;
    }
  };

  return (
    <div className="app">
      {renderTab()}
      <Navigation active={activeTab} onNavigate={setActiveTab} tabs={TABS} />
    </div>
  );
}
