import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../hooks/usePortfolioData';
import * as api from '../services/api';

export default function Pension({ data }) {
  const { config } = data;
  const [pension, setPension] = useState(config?.pensionConfig || {});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    plan: pension.plan || 'MPIPHP IAP',
    currentBalance: pension.currentBalance || 0,
    monthlyContribution: pension.monthlyContribution || 0,
    employerMatch: pension.employerMatch || 0,
    estimatedMonthly: pension.estimatedMonthly || 0,
    retirementAge: pension.retirementAge || 65,
    currentAge: pension.currentAge || 40,
    expectedReturn: pension.expectedReturn || 6,
  });

  useEffect(() => {
    if (config?.pensionConfig) {
      setPension(config.pensionConfig);
      setForm(prev => ({ ...prev, ...config.pensionConfig }));
    }
  }, [config]);

  const save = async () => {
    try {
      const updated = await api.updatePension(form);
      setPension(updated);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save pension config:', err);
    }
  };

  // Project pension value at retirement
  const yearsToRetirement = Math.max(0, (form.retirementAge || 65) - (form.currentAge || 40));
  const monthlyRate = (form.expectedReturn || 6) / 100 / 12;
  const months = yearsToRetirement * 12;
  const totalContrib = (form.monthlyContribution || 0) + (form.employerMatch || 0);
  const projectedValue = months > 0
    ? (form.currentBalance || 0) * Math.pow(1 + monthlyRate, months) +
      totalContrib * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
    : form.currentBalance || 0;

  // 4% rule monthly income
  const monthlyIncome4Pct = projectedValue * 0.04 / 12;

  return (
    <div className="page-container">
      <h1>Pension</h1>

      {/* Plan overview */}
      <div className="pension-card">
        <h3>{pension.plan || 'MPIPHP IAP'}</h3>
        <div className="subtitle">Motion Picture Industry Pension & Health Plans</div>

        {editing ? (
          <>
            <div className="form-group">
              <label>Plan Name</label>
              <input value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Current Balance ($)</label>
              <input type="number" value={form.currentBalance} onChange={e => setForm(f => ({ ...f, currentBalance: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label>Your Monthly Contribution ($)</label>
              <input type="number" value={form.monthlyContribution} onChange={e => setForm(f => ({ ...f, monthlyContribution: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label>Employer Match ($)</label>
              <input type="number" value={form.employerMatch} onChange={e => setForm(f => ({ ...f, employerMatch: Number(e.target.value) }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Current Age</label>
                <input type="number" value={form.currentAge} onChange={e => setForm(f => ({ ...f, currentAge: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Retirement Age</label>
                <input type="number" value={form.retirementAge} onChange={e => setForm(f => ({ ...f, retirementAge: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Expected Annual Return (%)</label>
              <input type="number" value={form.expectedReturn} step="0.5" onChange={e => setForm(f => ({ ...f, expectedReturn: Number(e.target.value) }))} />
            </div>
            <button className="btn-primary" onClick={save}>Save</button>
          </>
        ) : (
          <>
            <div className="pension-stat">
              <span className="pension-stat-label">Current Balance</span>
              <span className="pension-stat-value">{formatCurrency(form.currentBalance)}</span>
            </div>
            <div className="pension-stat">
              <span className="pension-stat-label">Monthly Contribution</span>
              <span className="pension-stat-value">{formatCurrency(form.monthlyContribution)}</span>
            </div>
            <div className="pension-stat">
              <span className="pension-stat-label">Employer Match</span>
              <span className="pension-stat-value">{formatCurrency(form.employerMatch)}</span>
            </div>
            <div className="pension-stat">
              <span className="pension-stat-label">Years to Retirement</span>
              <span className="pension-stat-value">{yearsToRetirement} years</span>
            </div>
            <button
              className="link-btn"
              onClick={() => setEditing(true)}
              style={{ marginTop: 12 }}
            >
              Edit Details
            </button>
          </>
        )}
      </div>

      {/* Projections */}
      <div className="pension-card">
        <h3>Retirement Projections</h3>
        <div className="subtitle">Based on {form.expectedReturn}% annual return</div>

        <div className="pension-stat">
          <span className="pension-stat-label">Projected Value at {form.retirementAge}</span>
          <span className="pension-stat-value" style={{ color: 'var(--accent-green)' }}>
            {formatCurrency(projectedValue)}
          </span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Monthly Income (4% rule)</span>
          <span className="pension-stat-value">{formatCurrency(monthlyIncome4Pct)}</span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Annual Income (4% rule)</span>
          <span className="pension-stat-value">{formatCurrency(monthlyIncome4Pct * 12)}</span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Total Contributions</span>
          <span className="pension-stat-value">
            {formatCurrency(form.currentBalance + totalContrib * months)}
          </span>
        </div>
      </div>

      {/* Estimated Pension Benefit */}
      {(pension.estimatedMonthly || 0) > 0 && (
        <div className="pension-card">
          <h3>Defined Benefit Pension</h3>
          <div className="subtitle">Estimated monthly benefit at retirement</div>
          <div className="pension-stat">
            <span className="pension-stat-label">Monthly Benefit</span>
            <span className="pension-stat-value" style={{ color: 'var(--accent-green)' }}>
              {formatCurrency(pension.estimatedMonthly)}
            </span>
          </div>
          <div className="pension-stat">
            <span className="pension-stat-label">Annual Benefit</span>
            <span className="pension-stat-value">
              {formatCurrency(pension.estimatedMonthly * 12)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
