import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../hooks/usePortfolioData';
import * as api from '../services/api';

export default function Pension({ data }) {
  const { config } = data;
  const [pension, setPension] = useState(config?.pensionConfig || {});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    plan: pension.plan || 'MPIPHP',
    iapBalance: pension.iapBalance || pension.currentBalance || 0,
    estimatedMonthly: pension.estimatedMonthly || 0,
    creditedHours: pension.creditedHours || 0,
    qualifiedYears: pension.qualifiedYears || 0,
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
      const updated = await api.updatePension({
        ...form,
        currentBalance: form.iapBalance,
      });
      setPension(updated);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save pension config:', err);
    }
  };

  const iapBalance = form.iapBalance || form.currentBalance || 0;
  const yearsToRetirement = Math.max(0, (form.retirementAge || 65) - (form.currentAge || 40));
  const monthlyRate = (form.expectedReturn || 6) / 100 / 12;
  const months = yearsToRetirement * 12;
  const projectedIAP = months > 0
    ? iapBalance * Math.pow(1 + monthlyRate, months)
    : iapBalance;

  const monthlyPension = form.estimatedMonthly || 0;
  const monthlyFromIAP = projectedIAP * 0.04 / 12;
  const totalMonthly = monthlyPension + monthlyFromIAP;

  return (
    <div className="page-container">
      <h1>Pension & Retirement</h1>

      {/* IAP */}
      <div className="pension-card">
        <h3>Individual Account Plan (IAP)</h3>
        <div className="subtitle">MPIPHP - Defined Contribution</div>

        {editing ? (
          <>
            <div className="form-group">
              <label>IAP Lump Sum Balance ($)</label>
              <input type="number" value={form.iapBalance} onChange={e => setForm(f => ({ ...f, iapBalance: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label>Accrued Monthly Pension ($)</label>
              <input type="number" value={form.estimatedMonthly} onChange={e => setForm(f => ({ ...f, estimatedMonthly: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label>Credited Hours</label>
              <input type="number" value={form.creditedHours} onChange={e => setForm(f => ({ ...f, creditedHours: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label>Qualified Years</label>
              <input type="number" value={form.qualifiedYears} onChange={e => setForm(f => ({ ...f, qualifiedYears: Number(e.target.value) }))} />
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
              <span className="pension-stat-label">Lump Sum Benefit</span>
              <span className="pension-stat-value" style={{ color: 'var(--accent-green)' }}>
                {formatCurrency(iapBalance)}
              </span>
            </div>
            <div className="pension-stat">
              <span className="pension-stat-label">Status</span>
              <span className="pension-stat-value">{pension.iapStatus || 'Active'}</span>
            </div>
            {pension.iapValuationYear && (
              <div className="pension-stat">
                <span className="pension-stat-label">Valuation Year</span>
                <span className="pension-stat-value">{pension.iapValuationYear}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Defined Benefit Pension */}
      <div className="pension-card">
        <h3>Pension Plan</h3>
        <div className="subtitle">MPIPHP - Defined Benefit</div>

        <div className="pension-stat">
          <span className="pension-stat-label">Accrued Monthly Benefit</span>
          <span className="pension-stat-value" style={{ color: 'var(--accent-green)' }}>
            {formatCurrency(monthlyPension)}
          </span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Annual Benefit</span>
          <span className="pension-stat-value">{formatCurrency(monthlyPension * 12)}</span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Status</span>
          <span className="pension-stat-value">{pension.pensionStatus || 'Active'}</span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Credited Hours</span>
          <span className="pension-stat-value">
            {(pension.creditedHours || 0).toLocaleString()}
          </span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Qualified Years</span>
          <span className="pension-stat-value">{pension.qualifiedYears || 0}</span>
        </div>
        {pension.pensionAsOf && (
          <div className="pension-stat">
            <span className="pension-stat-label">As of</span>
            <span className="pension-stat-value">{pension.pensionAsOf}</span>
          </div>
        )}
      </div>

      {/* Projections */}
      <div className="pension-card">
        <h3>Retirement Projections</h3>
        <div className="subtitle">At age {form.retirementAge} ({yearsToRetirement} years) &middot; {form.expectedReturn}% return</div>

        <div className="pension-stat">
          <span className="pension-stat-label">Projected IAP Value</span>
          <span className="pension-stat-value" style={{ color: 'var(--accent-green)' }}>
            {formatCurrency(projectedIAP)}
          </span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">IAP Monthly (4% rule)</span>
          <span className="pension-stat-value">{formatCurrency(monthlyFromIAP)}</span>
        </div>
        <div className="pension-stat">
          <span className="pension-stat-label">Pension Monthly</span>
          <span className="pension-stat-value">{formatCurrency(monthlyPension)}</span>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
          <div className="pension-stat">
            <span className="pension-stat-label" style={{ fontWeight: 600 }}>Total Monthly at Retirement</span>
            <span className="pension-stat-value" style={{ color: 'var(--accent-green)', fontSize: 20 }}>
              {formatCurrency(totalMonthly)}
            </span>
          </div>
          <div className="pension-stat">
            <span className="pension-stat-label" style={{ fontWeight: 600 }}>Total Annual at Retirement</span>
            <span className="pension-stat-value" style={{ fontSize: 18 }}>
              {formatCurrency(totalMonthly * 12)}
            </span>
          </div>
        </div>
      </div>

      {!editing && (
        <button
          className="link-btn"
          onClick={() => setEditing(true)}
          style={{ marginTop: 12, width: '100%' }}
        >
          Edit Details
        </button>
      )}
    </div>
  );
}
