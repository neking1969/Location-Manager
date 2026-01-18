import React, { useState } from 'react';
import api from '../api';

function LedgerImport({ projectId, onClose, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParseResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/api/upload/ledger/${projectId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParseResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse ledger PDF');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!parseResult?.file_id) return;

    setImporting(true);
    setError(null);

    try {
      const response = await api.post(`/api/upload/ledger/import/${parseResult.file_id}`, {
        projectId
      });

      alert(`Import Complete!\n\n${response.data.episodes_created} episodes created\n${response.data.sets_created} sets created\n${response.data.entries_imported} entries imported`);

      if (onImportComplete) {
        onImportComplete();
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import ledger data');
    } finally {
      setImporting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h3 className="modal-title">Import Production Ledger</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div style={{ padding: '1rem' }}>
          {/* Upload Section */}
          {!parseResult && (
            <div>
              <p style={{ marginBottom: '1rem', color: 'var(--gray-600)' }}>
                Upload a GL 505 General Ledger PDF to automatically import costs.
                The system will parse account codes, episodes, locations, and amounts.
              </p>

              <div style={{
                border: '2px dashed var(--gray-300)',
                borderRadius: '8px',
                padding: '2rem',
                textAlign: 'center',
                marginBottom: '1rem'
              }}>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="ledger-file"
                />
                <label htmlFor="ledger-file" style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                  {file ? (
                    <div>
                      <strong>{file.name}</strong>
                      <br />
                      <span style={{ color: 'var(--gray-500)' }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ) : (
                    <div>
                      <strong>Click to select a PDF file</strong>
                      <br />
                      <span style={{ color: 'var(--gray-500)' }}>
                        or drag and drop
                      </span>
                    </div>
                  )}
                </label>
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={!file || uploading}
                style={{ width: '100%' }}
              >
                {uploading ? 'Parsing...' : 'Parse Ledger'}
              </button>
            </div>
          )}

          {/* Parse Results */}
          {parseResult && (
            <div>
              <div className="alert" style={{
                background: 'var(--success-light)',
                border: '1px solid var(--success)',
                marginBottom: '1rem'
              }}>
                Found <strong>{parseResult.entries_found}</strong> entries in <strong>{parseResult.grouped?.length || 0}</strong> location groups
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              {/* Summary by Episode/Location */}
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Preview by Episode & Location</h4>
                <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid var(--gray-200)', borderRadius: '4px' }}>
                  <table style={{ width: '100%', fontSize: '0.875rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--gray-100)' }}>
                      <tr>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Episode</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Location</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Entries</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Security</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Police</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Fire</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Permits</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Rentals</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.grouped?.map((group, idx) => {
                        const total = Object.values(group.totals || {}).reduce((sum, v) => sum + v, 0);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                            <td style={{ padding: '0.5rem' }}>{group.episode || 'Unknown'}</td>
                            <td style={{ padding: '0.5rem' }}>{group.location || 'General'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{group.entries?.length || 0}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(group.totals?.Security)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(group.totals?.Police)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(group.totals?.Fire)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(group.totals?.Permits)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(group.totals?.Rentals)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sample Entries */}
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Sample Entries (first 10)</h4>
                <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid var(--gray-200)', borderRadius: '4px' }}>
                  <table style={{ width: '100%', fontSize: '0.75rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--gray-100)' }}>
                      <tr>
                        <th style={{ padding: '0.25rem', textAlign: 'left' }}>Episode</th>
                        <th style={{ padding: '0.25rem', textAlign: 'left' }}>Category</th>
                        <th style={{ padding: '0.25rem', textAlign: 'left' }}>Description</th>
                        <th style={{ padding: '0.25rem', textAlign: 'left' }}>Vendor</th>
                        <th style={{ padding: '0.25rem', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.entries?.slice(0, 10).map((entry, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                          <td style={{ padding: '0.25rem' }}>{entry.episode || '-'}</td>
                          <td style={{ padding: '0.25rem' }}>{entry.category}</td>
                          <td style={{ padding: '0.25rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.description}
                          </td>
                          <td style={{ padding: '0.25rem' }}>{entry.vendor || '-'}</td>
                          <td style={{ padding: '0.25rem', textAlign: 'right', color: entry.amount < 0 ? 'var(--danger)' : 'inherit' }}>
                            {formatCurrency(entry.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: 0, marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setParseResult(null)}>
                  Upload Different File
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? 'Importing...' : `Import ${parseResult.entries_found} Entries`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LedgerImport;
