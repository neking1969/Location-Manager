import React, { useState, useRef } from 'react';
import * as api from '../services/api';

export default function LinkAccount({ onSuccess }) {
  const [mode, setMode] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [source, setSource] = useState('fidelity');
  const [accountName, setAccountName] = useState('');
  const fileRef = useRef();
  const photoRef = useRef();

  const [manualName, setManualName] = useState('');
  const [manualInst, setManualInst] = useState('Fidelity');
  const [manualTicker, setManualTicker] = useState('');
  const [manualShares, setManualShares] = useState('');
  const [manualCost, setManualCost] = useState('');

  const [preview, setPreview] = useState(null);

  const resetState = () => {
    setMode(null);
    setError(null);
    setSuccess(null);
    setPreview(null);
    setImporting(false);
  };

  const handleScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPreview(base64);
      const result = await api.importScreenshot(base64);
      setSuccess(`Imported ${result.positionsImported} positions from ${result.institution || 'screenshot'}`);
      setPreview(null);
      // Stay in screenshot mode so user can scan another account
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
      if (photoRef.current) photoRef.current.value = '';
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const csv = await file.text();
      let result;
      if (source === 'fidelity') {
        result = await api.importFidelity(csv, accountName || 'Fidelity');
      } else if (source === 'merrill') {
        result = await api.importMerrill(csv, accountName || 'Merrill Lynch');
      } else {
        result = await api.importGeneric(csv, accountName || 'Imported', source);
      }
      setSuccess(`Imported ${result.positionsImported} positions`);
      setMode(null);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleManualAdd = async () => {
    if (!manualTicker || !manualShares) return;
    setError(null);

    try {
      await api.addAccount({
        name: manualName || manualInst,
        institution: manualInst,
        positions: [{
          id: `pos-${Date.now()}`,
          ticker: manualTicker.toUpperCase(),
          name: manualTicker.toUpperCase(),
          shares: Number(manualShares),
          costBasis: Number(manualCost) || 0,
          type: manualTicker.toUpperCase() === 'SPAXX' ? 'money_market' : 'stock',
          addedAt: new Date().toISOString(),
        }],
      });
      setSuccess(`Added ${manualTicker.toUpperCase()}`);
      setMode(null);
      setManualTicker('');
      setManualShares('');
      setManualCost('');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      {success && mode !== 'screenshot' && (
        <div style={{ color: 'var(--accent-green)', fontSize: 13, textAlign: 'center', marginBottom: 8, padding: 10, background: 'rgba(34,197,94,0.1)', borderRadius: 8 }}>
          {success}
        </div>
      )}

      {!mode && (
        <div>
          <button
            className="btn-primary"
            onClick={() => { setMode('screenshot'); setError(null); setSuccess(null); }}
            style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            Scan Screenshot
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="link-btn" style={{ flex: 1 }} onClick={() => { setMode('csv'); setError(null); setSuccess(null); }}>
              Import CSV
            </button>
            <button className="link-btn" style={{ flex: 1 }} onClick={() => { setMode('manual'); setError(null); setSuccess(null); }}>
              + Add Manually
            </button>
          </div>
        </div>
      )}

      {mode === 'screenshot' && (
        <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: 14, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Scan Account Screenshot</span>
            <button onClick={resetState} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>X</button>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Screenshot your positions from Fidelity, Merrill Lynch, Robinhood, or any brokerage. Re-scanning the same institution updates it automatically.
          </div>

          {preview && (
            <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={preview} alt="Screenshot preview" style={{ width: '100%', display: 'block' }} />
            </div>
          )}

          {importing ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div className="spinner" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                AI is reading your screenshot...
              </div>
            </div>
          ) : (
            <>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                onChange={handleScreenshot}
                style={{ display: 'none' }}
              />
              <button
                className="btn-primary"
                onClick={() => photoRef.current?.click()}
                style={{ width: '100%', marginBottom: 8 }}
              >
                Choose Photo
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                ~$0.01 per scan via Claude AI
              </div>
            </>
          )}

          {success && (
            <div style={{ marginTop: 12, padding: 10, background: 'rgba(34,197,94,0.1)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ color: 'var(--accent-green)', fontSize: 13, marginBottom: 4 }}>{success}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scan another account or tap X to close</div>
            </div>
          )}
        </div>
      )}

      {mode === 'csv' && (
        <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: 14, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Import Holdings CSV</span>
            <button onClick={resetState} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>X</button>
          </div>

          <div className="form-group">
            <label>Source</label>
            <select value={source} onChange={e => setSource(e.target.value)}>
              <option value="fidelity">Fidelity</option>
              <option value="merrill">Merrill Lynch / Merrill Edge</option>
              <option value="other">Other Brokerage</option>
            </select>
          </div>

          <div className="form-group">
            <label>Account Name (optional)</label>
            <input
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              placeholder={source === 'fidelity' ? 'e.g. Fidelity IRA' : 'e.g. Merrill Brokerage'}
            />
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {source === 'fidelity'
              ? 'Fidelity.com > Positions > Download'
              : source === 'merrill'
              ? 'Merrill Edge > Portfolio > Download Positions'
              : 'Export positions as CSV with Symbol, Quantity columns'}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileImport}
            disabled={importing}
            style={{
              width: '100%', padding: 10, background: 'var(--bg-card)',
              border: '1px dashed var(--border)', borderRadius: 8,
              color: 'var(--text-primary)', fontSize: 13,
            }}
          />
          {importing && <div className="loading"><div className="spinner" />Importing...</div>}
        </div>
      )}

      {mode === 'manual' && (
        <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: 14, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Add Position</span>
            <button onClick={resetState} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>X</button>
          </div>

          <div className="form-group">
            <label>Institution</label>
            <select value={manualInst} onChange={e => setManualInst(e.target.value)}>
              <option>Fidelity</option>
              <option>Merrill Lynch</option>
              <option>Robinhood</option>
              <option>Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Account Name (optional)</label>
            <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="e.g. Brokerage, IRA" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="form-group">
              <label>Ticker</label>
              <input value={manualTicker} onChange={e => setManualTicker(e.target.value)} placeholder="DIS" />
            </div>
            <div className="form-group">
              <label>Shares</label>
              <input type="number" value={manualShares} onChange={e => setManualShares(e.target.value)} placeholder="100" />
            </div>
          </div>

          <div className="form-group">
            <label>Cost Basis (total, optional)</label>
            <input type="number" value={manualCost} onChange={e => setManualCost(e.target.value)} placeholder="10000" />
          </div>

          <button className="btn-primary" onClick={handleManualAdd} disabled={!manualTicker || !manualShares}>
            Add Position
          </button>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          {error}
        </div>
      )}
    </div>
  );
}
