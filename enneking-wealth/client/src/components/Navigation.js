import React from 'react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '\u2197' },
  { id: 'advisor', label: 'AI Advisor', icon: '\u2693' },
  { id: 'todo', label: 'To-Do', icon: '\u2713' },
  { id: 'calc', label: 'Calc', icon: '\u25A6' },
  { id: 'pension', label: 'Pension', icon: '\u25EB' },
  { id: '2026', label: '2026', icon: '\u25CE' },
];

export default function Navigation({ active, onNavigate }) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
