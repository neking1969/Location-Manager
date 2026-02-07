import React, { useState, useEffect } from 'react';
import { formatCurrency, formatPercent } from '../hooks/usePortfolioData';
import * as api from '../services/api';

export default function Goals2026({ data }) {
  const { portfolio, config } = data;
  const [goals, setGoals] = useState(config?.goals || {});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    targetNetWorth: goals.targetNetWorth || 5595590,
    targetDate: goals.targetDate || '2035-12-31',
    label: goals.label || 'Financial Independence',
    milestones: goals.milestones || [
      { label: '2026 Target', amount: 2200000, reached: false },
      { label: 'Half Million Invested', amount: 2500000, reached: false },
      { label: 'Three Million', amount: 3000000, reached: false },
      { label: 'Goal', amount: 5595590, reached: false },
    ],
  });

  useEffect(() => {
    if (config?.goals) {
      setGoals(config.goals);
      setForm(prev => ({ ...prev, ...config.goals }));
    }
  }, [config]);

  const save = async () => {
    try {
      const updated = await api.updateGoals(form);
      setGoals(updated);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save goals:', err);
    }
  };

  const netWorth = portfolio.netWorth;
  const milestones = form.milestones || [];

  // 2026 specific calculations
  const now = new Date();
  const endOf2026 = new Date('2026-12-31');
  const daysRemaining = Math.max(0, Math.ceil((endOf2026 - now) / 86400000));
  const monthsRemaining = Math.max(0, Math.ceil(daysRemaining / 30.44));

  const target2026 = milestones.find(m => m.label.includes('2026'))?.amount || 2200000;
  const gap2026 = Math.max(0, target2026 - netWorth);
  const monthlyNeeded = monthsRemaining > 0 ? gap2026 / monthsRemaining : 0;
  const pct2026 = target2026 > 0 ? Math.min(100, (netWorth / target2026) * 100) : 0;

  return (
    <div className="page-container">
      <h1>2026 Goals</h1>

      {/* 2026 Progress */}
      <div className="calc-card">
        <h3>2026 Net Worth Target</h3>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Progress</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{formatPercent(pct2026)}</span>
          </div>
          {/* Progress bar */}
          <div style={{
            height: 12,
            background: 'var(--bg-primary)',
            borderRadius: 6,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, pct2026)}%`,
              background: pct2026 >= 100
                ? 'var(--accent-green)'
                : 'linear-gradient(90deg, var(--accent-blue), var(--accent-teal))',
              borderRadius: 6,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        <div className="pension-stat">
          <span className="pension-stat-label">Current Net Worth</span>
          <span className="pension-stat-value">{formatCurrency(netWorth)}</span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">2026 Target</span>
          <span className="pension-stat-value">{formatCurrency(target2026)}</span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Gap</span>
          <span className="pension-stat-value" style={{ color: gap2026 > 0 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
            {gap2026 > 0 ? formatCurrency(gap2026) : 'Reached!'}
          </span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Months Remaining</span>
          <span className="pension-stat-value">{monthsRemaining}</span>
        </div>
        {gap2026 > 0 && (
          <div className="pension-stat">
            <span className="pension-stat-label">Monthly Savings Needed</span>
            <span className="pension-stat-value">{formatCurrency(monthlyNeeded)}</span>
          </div>
        )}
      </div>

      {/* Milestones */}
      <div className="calc-card">
        <h3>Milestones</h3>
        {milestones.map((m, idx) => {
          const reached = netWorth >= m.amount;
          const pct = m.amount > 0 ? Math.min(100, (netWorth / m.amount) * 100) : 0;
          return (
            <div key={idx} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: reached ? 'var(--accent-green)' : 'var(--text-primary)',
                }}>
                  {reached ? '\u2713 ' : ''}{m.label}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  {formatCurrency(m.amount)}
                </span>
              </div>
              <div style={{
                height: 6,
                background: 'var(--bg-primary)',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: reached ? 'var(--accent-green)' : 'var(--accent-blue)',
                  borderRadius: 3,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Long-term goal */}
      <div className="calc-card">
        <h3>{form.label || 'Financial Independence'}</h3>
        <div className="pension-stat">
          <span className="pension-stat-label">Ultimate Goal</span>
          <span className="pension-stat-value">{formatCurrency(form.targetNetWorth)}</span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Progress</span>
          <span className="pension-stat-value">
            {formatPercent(portfolio.goalProgress)}
          </span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Remaining</span>
          <span className="pension-stat-value">{formatCurrency(portfolio.goalRemaining)}</span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Target Date</span>
          <span className="pension-stat-value">{form.targetDate}</span>
        </div>

        {!editing ? (
          <button className="link-btn" onClick={() => setEditing(true)} style={{ marginTop: 12 }}>
            Edit Goals
          </button>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div className="form-group">
              <label>Goal Label</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Target Net Worth ($)</label>
              <input type="number" value={form.targetNetWorth} onChange={e => setForm(f => ({ ...f, targetNetWorth: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label>Target Date</label>
              <input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={save}>Save Goals</button>
          </div>
        )}
      </div>
    </div>
  );
}
