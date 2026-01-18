import React, { useState } from 'react';
import api from '../api';

function LedgerImport({ projectId, onClose, onImportComplete }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [parseResults, setParseResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [importingFileId, setImportingFileId] = useState(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      setParseResults(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await api.post(`/api/upload/ledger/${projectId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParseResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse ledger PDF(s)');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async (fileResult, handleDuplicate = 'skip') => {
    if (!fileResult?.file_id) return;

    setImportingFileId(fileResult.file_id);
    setError(null);

    try {
      const response = await api.post(`/api/upload/ledger/import/${fileResult.file_id}`, {
        projectId,
        handleDuplicate
      });

      // Update the results to show this file as imported
      setParseResults(prev => ({
        ...prev,
        results: prev.results.map(r =>
          r.file_id === fileResult.file_id
            ? { ...r, imported: true, importResult: response.data }
            : r
        )
      }));

      // Check if all files are imported
      const allImported = parseResults.results.every(r =>
        r.file_id === fileResult.file_id || r.imported || !r.success
      );

      if (allImported && onImportComplete) {
        onImportComplete();
      }

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import ledger data');
    } finally {
      setImportingFileId(null);
    }
  };

  const handleImportAll = async () => {
    const successfulResults = parseResults.results.filter(r => r.success && !r.imported);

    setImporting(true);
    for (const result of successfulResults) {
      await handleImport(result);
    }
    setImporting(false);

    if (onImportComplete) {
      onImportComplete();
    }
    onClose();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const totalEntries = parseResults?.results?.reduce((sum, r) => sum + (r.entries_found || 0), 0) || 0;
  const successfulFiles = parseResults?.results?.filter(r => r.success) || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '950px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h3 className="modal-title">Import Production Ledgers</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div style={{ padding: '1rem' }}>
          {/* Upload Section */}
          {!parseResults && (
            <div>
              <p style={{ marginBottom: '1rem', color: 'var(--gray-600)' }}>
                Upload one or more GL 505 General Ledger PDFs to automatically import costs.
                The system will parse account codes, episodes, locations, and amounts.
                <br /><br />
                <strong>Duplicate Detection:</strong> Files that have already been uploaded will be flagged.
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
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="ledger-files"
                />
                <label htmlFor="ledger-files" style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                  {files.length > 0 ? (
                    <div>
                      <strong>{files.length} file(s) selected</strong>
                      <br />
                      <span style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                        {files.map(f => f.name).join(', ')}
                      </span>
                      <br />
                      <span style={{ color: 'var(--gray-500)' }}>
                        Total: {(files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ) : (
                    <div>
                      <strong>Click to select PDF files</strong>
                      <br />
                      <span style={{ color: 'var(--gray-500)' }}>
                        You can select multiple files
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
                disabled={files.length === 0 || uploading}
                style={{ width: '100%' }}
              >
                {uploading ? 'Parsing...' : `Parse ${files.length || ''} Ledger${files.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {/* Parse Results */}
          {parseResults && (
            <div>
              {/* Summary */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div className="alert" style={{
                  flex: 1,
                  background: 'var(--success-light)',
                  border: '1px solid var(--success)'
                }}>
                  <strong>{parseResults.successful}</strong> file(s) parsed
                  <br />
                  <span style={{ fontSize: '0.875rem' }}>{totalEntries} total entries</span>
                </div>

                {parseResults.failed > 0 && (
                  <div className="alert alert-error" style={{ flex: 1 }}>
                    <strong>{parseResults.failed}</strong> file(s) failed
                  </div>
                )}

                {parseResults.duplicates?.length > 0 && (
                  <div className="alert" style={{
                    flex: 1,
                    background: '#fff3cd',
                    border: '1px solid #ffc107'
                  }}>
                    <strong>{parseResults.duplicates.length}</strong> duplicate(s) detected
                  </div>
                )}
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              {/* Duplicates Warning */}
              {parseResults.duplicates?.length > 0 && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fff3cd', borderRadius: '4px' }}>
                  <h4 style={{ marginBottom: '0.5rem', color: '#856404' }}>Duplicate Files Detected</h4>
                  {parseResults.duplicates.map((dup, idx) => (
                    <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <strong>{dup.filename}</strong>: {dup.message}
                      {dup.type === 'name' && (
                        <button
                          className="btn btn-sm"
                          style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => {
                            // TODO: Handle supersede
                            alert('Supersede feature coming soon');
                          }}
                        >
                          Replace Old Version
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* File Results */}
              {successfulFiles.map((result, idx) => (
                <div key={idx} style={{
                  marginBottom: '1rem',
                  border: '1px solid var(--gray-200)',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '0.75rem 1rem',
                    background: result.imported ? 'var(--success-light)' : 'var(--gray-100)',
                    borderBottom: '1px solid var(--gray-200)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong>{result.filename}</strong>
                      <span style={{ marginLeft: '1rem', color: 'var(--gray-600)' }}>
                        {result.entries_found} entries in {result.grouped?.length || 0} groups
                      </span>
                      {result.imported && (
                        <span style={{ marginLeft: '1rem', color: 'var(--success)' }}>
                          ✓ Imported ({result.importResult?.entries_imported} entries)
                        </span>
                      )}
                    </div>
                    {!result.imported && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleImport(result)}
                        disabled={importingFileId === result.file_id}
                      >
                        {importingFileId === result.file_id ? 'Importing...' : 'Import'}
                      </button>
                    )}
                  </div>

                  {/* Preview Table */}
                  <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.75rem' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                        <tr>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Episode</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Location</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Entries</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Security</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Police</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Fire</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Rentals</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.grouped?.map((group, gidx) => {
                          const total = Object.values(group.totals || {}).reduce((sum, v) => sum + v, 0);
                          return (
                            <tr key={gidx} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                              <td style={{ padding: '0.5rem' }}>{group.episode || 'Unknown'}</td>
                              <td style={{ padding: '0.5rem' }}>{group.location || 'General'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{group.entries?.length || 0}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(group.totals?.Security)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(group.totals?.Police)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(group.totals?.Fire)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(group.totals?.Rentals)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Failed Files */}
              {parseResults.results?.filter(r => !r.success).map((result, idx) => (
                <div key={idx} style={{
                  marginBottom: '0.5rem',
                  padding: '0.75rem 1rem',
                  background: '#fee',
                  border: '1px solid #fcc',
                  borderRadius: '4px'
                }}>
                  <strong>{result.filename}</strong>: {result.error}
                </div>
              ))}

              <div className="modal-footer" style={{ padding: 0, marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => {
                  setParseResults(null);
                  setFiles([]);
                }}>
                  Upload Different Files
                </button>
                {successfulFiles.filter(r => !r.imported).length > 1 && (
                  <button
                    className="btn btn-primary"
                    onClick={handleImportAll}
                    disabled={importing}
                  >
                    {importing ? 'Importing...' : `Import All (${totalEntries} entries)`}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={onClose}>
                  Close
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
