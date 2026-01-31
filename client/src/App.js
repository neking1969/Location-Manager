import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import GlideDashboard from './components/GlideDashboard';

function App() {
  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1>
            <Link to="/" style={{ color: 'var(--foreground)', textDecoration: 'none' }}>
              Shards Ledger
            </Link>
          </h1>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
          The Shards - Season 1
        </div>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<GlideDashboard />} />
          <Route path="*" element={<GlideDashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
