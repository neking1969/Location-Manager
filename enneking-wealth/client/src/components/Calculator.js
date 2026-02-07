import React, { useState } from 'react';
import { formatCurrency } from '../hooks/usePortfolioData';

export default function Calculator({ data }) {
  const { portfolio } = data;

  // Compound growth calculator
  const [principal, setPrincipal] = useState(portfolio.investable || 0);
  const [monthlyAdd, setMonthlyAdd] = useState(5000);
  const [rate, setRate] = useState(8);
  const [years, setYears] = useState(10);

  // RSU calculator
  const [rsuShares, setRsuShares] = useState(100);
  const [rsuPrice, setRsuPrice] = useState(108);
  const [rsuTaxRate, setRsuTaxRate] = useState(37);

  const compoundResult = (() => {
    const r = rate / 100 / 12;
    const n = years * 12;
    const fv = principal * Math.pow(1 + r, n) + monthlyAdd * ((Math.pow(1 + r, n) - 1) / r);
    const totalContributed = principal + monthlyAdd * n;
    const growth = fv - totalContributed;
    return { futureValue: fv, totalContributed, growth };
  })();

  const rsuResult = (() => {
    const grossValue = rsuShares * rsuPrice;
    const taxes = grossValue * (rsuTaxRate / 100);
    const netValue = grossValue - taxes;
    return { grossValue, taxes, netValue };
  })();

  return (
    <div className="page-container">
      <h1>Calculators</h1>

      {/* Compound Growth */}
      <div className="calc-card">
        <h3>Compound Growth</h3>
        <div className="form-group">
          <label>Starting Amount</label>
          <input
            type="number"
            value={principal}
            onChange={e => setPrincipal(Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>Monthly Contribution</label>
          <input
            type="number"
            value={monthlyAdd}
            onChange={e => setMonthlyAdd(Number(e.target.value))}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Annual Return (%)</label>
            <input
              type="number"
              value={rate}
              onChange={e => setRate(Number(e.target.value))}
              step="0.5"
            />
          </div>
          <div className="form-group">
            <label>Years</label>
            <input
              type="number"
              value={years}
              onChange={e => setYears(Number(e.target.value))}
            />
          </div>
        </div>

        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 8,
          padding: 16,
          marginTop: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Future Value</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)' }}>
              {formatCurrency(compoundResult.futureValue)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Total Contributed</span>
            <span style={{ fontSize: 14 }}>{formatCurrency(compoundResult.totalContributed)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Investment Growth</span>
            <span style={{ fontSize: 14, color: 'var(--accent-green)' }}>
              {formatCurrency(compoundResult.growth)}
            </span>
          </div>
        </div>
      </div>

      {/* RSU Tax Calculator */}
      <div className="calc-card">
        <h3>RSU Tax Estimator</h3>
        <div className="form-group">
          <label>Shares Vesting</label>
          <input
            type="number"
            value={rsuShares}
            onChange={e => setRsuShares(Number(e.target.value))}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Price at Vest ($)</label>
            <input
              type="number"
              value={rsuPrice}
              onChange={e => setRsuPrice(Number(e.target.value))}
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label>Tax Rate (%)</label>
            <input
              type="number"
              value={rsuTaxRate}
              onChange={e => setRsuTaxRate(Number(e.target.value))}
            />
          </div>
        </div>

        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 8,
          padding: 16,
          marginTop: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Gross Value</span>
            <span style={{ fontSize: 14 }}>{formatCurrency(rsuResult.grossValue)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Estimated Taxes</span>
            <span style={{ fontSize: 14, color: 'var(--accent-red)' }}>
              -{formatCurrency(rsuResult.taxes)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Net Value</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)' }}>
              {formatCurrency(rsuResult.netValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
