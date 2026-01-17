import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import ProjectList from './components/ProjectList';
import ProjectDashboard from './components/ProjectDashboard';
import BudgetManager from './components/BudgetManager';
import LedgerManager from './components/LedgerManager';
import Comparison from './components/Comparison';
import Upload from './components/Upload';

const API_URL = process.env.REACT_APP_API_URL || '';

function App() {
  const location = useLocation();
  const [currentProject, setCurrentProject] = useState(null);

  const isActive = (path) => {
    return location.pathname.includes(path) ? 'active' : '';
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Production Cost Tracker</h1>
        <nav>
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            Projects
          </Link>
          {currentProject && (
            <>
              <Link to={`/project/${currentProject.id}/dashboard`} className={isActive('dashboard')}>
                Dashboard
              </Link>
              <Link to={`/project/${currentProject.id}/budget`} className={isActive('budget')}>
                Budget
              </Link>
              <Link to={`/project/${currentProject.id}/ledger`} className={isActive('ledger')}>
                Ledger
              </Link>
              <Link to={`/project/${currentProject.id}/compare`} className={isActive('compare')}>
                Compare
              </Link>
              <Link to={`/project/${currentProject.id}/upload`} className={isActive('upload')}>
                Upload
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={<ProjectList onSelectProject={setCurrentProject} />}
          />
          <Route
            path="/project/:projectId/dashboard"
            element={<ProjectDashboard onProjectLoad={setCurrentProject} />}
          />
          <Route
            path="/project/:projectId/budget"
            element={<BudgetManager onProjectLoad={setCurrentProject} />}
          />
          <Route
            path="/project/:projectId/ledger"
            element={<LedgerManager onProjectLoad={setCurrentProject} />}
          />
          <Route
            path="/project/:projectId/compare"
            element={<Comparison onProjectLoad={setCurrentProject} />}
          />
          <Route
            path="/project/:projectId/upload"
            element={<Upload onProjectLoad={setCurrentProject} />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
