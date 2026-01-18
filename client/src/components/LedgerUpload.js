import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api';

const LedgerUpload = ({ projectId, onImportComplete, onClose }) => {
  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [selectedDuplicates, setSelectedDuplicates] = useState(new Set());
  const [importSummary, setImportSummary] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Generate unique ID for files
  const generateId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Handle drag events
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf' || file.name.endsWith('.pdf')
    );

    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add files to queue
  const addFiles = (newFiles) => {
    const fileObjects = newFiles.map(file => ({
      id: generateId(),
      file,
      name: file.name,
      size: file.size,
      status: 'pending', // pending, uploading, parsing, success, error, duplicate
      progress: 0,
      error: null,
      parsedData: null,
      fileId: null
    }));

    setFiles(prev => [...prev, ...fileObjects]);

    // Auto-process each file
    fileObjects.forEach(fileObj => {
      processFile(fileObj);
    });
  };

  // Process individual file
  const processFile = async (fileObj) => {
    const updateFile = (id, updates) => {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    try {
      updateFile(fileObj.id, { status: 'uploading', progress: 20 });

      const formData = new FormData();
      formData.append('file', fileObj.file);

      const response = await axios.post(
        `${API_BASE_URL}/upload/ledger/${projectId}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 50);
            updateFile(fileObj.id, { progress: 20 + progress });
          }
        }
      );

      updateFile(fileObj.id, {
        status: 'parsing',
        progress: 75
      });

      // Check for duplicates in the parsed entries
      const { entries, grouped, file_id } = response.data;

      // Check duplicates against existing entries
      const duplicateCheck = await axios.post(
        `${API_BASE_URL}/upload/check-duplicates/${projectId}`,
        { entries }
      );

      const { duplicates: foundDuplicates, newEntries } = duplicateCheck.data;

      if (foundDuplicates && foundDuplicates.length > 0) {
        setDuplicates(prev => [...prev, ...foundDuplicates.map(d => ({
          ...d,
          sourceFileId: fileObj.id,
          sourceFileName: fileObj.name
        }))]);

        updateFile(fileObj.id, {
          status: 'duplicate',
          progress: 100,
          parsedData: { entries: newEntries, grouped, allEntries: entries },
          fileId: file_id,
          duplicateCount: foundDuplicates.length,
          newCount: newEntries.length
        });
      } else {
        updateFile(fileObj.id, {
          status: 'success',
          progress: 100,
          parsedData: { entries, grouped },
          fileId: file_id,
          entryCount: entries.length
        });
      }
    } catch (error) {
      console.error('File processing error:', error);
      updateFile(fileObj.id, {
        status: 'error',
        progress: 100,
        error: error.response?.data?.error || error.message || 'Failed to process file'
      });
    }
  };

  // Handle file input change
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(
      file => file.type === 'application/pdf' || file.name.endsWith('.pdf')
    );
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    e.target.value = '';
  };

  // Remove file from queue
  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setDuplicates(prev => prev.filter(d => d.sourceFileId !== id));
  };

  // Toggle duplicate selection
  const toggleDuplicate = (entryId) => {
    setSelectedDuplicates(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  // Select/deselect all duplicates
  const selectAllDuplicates = (select) => {
    if (select) {
      setSelectedDuplicates(new Set(duplicates.map(d => d.id)));
    } else {
      setSelectedDuplicates(new Set());
    }
  };

  // Import all files
  const handleImport = async () => {
    setIsImporting(true);

    const successFiles = files.filter(f => f.status === 'success' || f.status === 'duplicate');
    let totalImported = 0;
    let totalSkipped = 0;
    let totalEpisodes = 0;
    let totalSets = 0;
    let errors = [];

    for (const fileObj of successFiles) {
      try {
        // Filter out selected duplicates if this file had duplicates
        let entriesToImport = fileObj.parsedData.entries;

        if (fileObj.status === 'duplicate' && fileObj.parsedData.allEntries) {
          const skipIds = new Set(
            duplicates
              .filter(d => d.sourceFileId === fileObj.id && !selectedDuplicates.has(d.id))
              .map(d => d.originalEntryIndex)
          );

          entriesToImport = fileObj.parsedData.allEntries.filter((_, idx) => !skipIds.has(idx));
          totalSkipped += skipIds.size;
        }

        if (entriesToImport.length === 0) continue;

        const response = await axios.post(
          `${API_BASE_URL}/upload/ledger/import-custom/${projectId}`,
          {
            entries: entriesToImport
          }
        );

        totalImported += response.data.entries_imported || 0;
        totalEpisodes += response.data.episodes_created || 0;
        totalSets += response.data.sets_created || 0;
      } catch (error) {
        errors.push({
          file: fileObj.name,
          error: error.response?.data?.error || error.message
        });
      }
    }

    setImportSummary({
      imported: totalImported,
      skipped: totalSkipped,
      episodes: totalEpisodes,
      sets: totalSets,
      errors
    });

    setIsImporting(false);

    if (onImportComplete && errors.length === 0) {
      setTimeout(() => {
        onImportComplete();
      }, 2000);
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '○';
      case 'uploading': return '↑';
      case 'parsing': return '◐';
      case 'success': return '✓';
      case 'error': return '✕';
      case 'duplicate': return '⚠';
      default: return '○';
    }
  };

  // Get ready files count
  const readyFilesCount = files.filter(f => f.status === 'success' || f.status === 'duplicate').length;
  const totalEntries = files
    .filter(f => f.status === 'success' || f.status === 'duplicate')
    .reduce((sum, f) => sum + (f.parsedData?.entries?.length || f.parsedData?.allEntries?.length || 0), 0);

  return (
    <div className="ledger-upload-container">
      <div className="ledger-upload-header">
        <h2>Ledger Upload</h2>
        <p>Upload production ledger PDFs to import cost data</p>
      </div>

      {/* Upload Zone */}
      <div
        className={`multi-upload-zone ${isDragOver ? 'dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="upload-zone-icon">📄</div>
        <div className="upload-zone-title">Drop ledger files here</div>
        <div className="upload-zone-subtitle">
          or <span>browse</span> to select PDF files
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* File Queue */}
      {files.length > 0 && (
        <div className="file-queue">
          <div className="file-queue-header">
            <h3>Files ({files.length})</h3>
            {readyFilesCount > 0 && !importSummary && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setFiles([])}
              >
                Clear All
              </button>
            )}
          </div>

          <div className="file-queue-list">
            {files.map(fileObj => (
              <div
                key={fileObj.id}
                className={`file-queue-item ${fileObj.status}`}
              >
                <div className="file-icon">
                  {fileObj.status === 'uploading' || fileObj.status === 'parsing' ? (
                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                  ) : (
                    getStatusIcon(fileObj.status)
                  )}
                </div>

                <div className="file-info">
                  <div className="file-name">{fileObj.name}</div>
                  <div className="file-meta">
                    <span>{formatSize(fileObj.size)}</span>
                    {fileObj.status === 'success' && (
                      <span style={{ color: 'var(--success)' }}>
                        {fileObj.entryCount} entries found
                      </span>
                    )}
                    {fileObj.status === 'duplicate' && (
                      <span style={{ color: 'var(--warning)' }}>
                        {fileObj.duplicateCount} duplicates, {fileObj.newCount} new
                      </span>
                    )}
                    {fileObj.status === 'error' && (
                      <span style={{ color: 'var(--danger)' }}>
                        {fileObj.error}
                      </span>
                    )}
                  </div>

                  {(fileObj.status === 'uploading' || fileObj.status === 'parsing') && (
                    <div className="upload-progress">
                      <div className="upload-progress-bar">
                        <div
                          className="upload-progress-fill"
                          style={{ width: `${fileObj.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="file-status">
                  {fileObj.status === 'success' && <span className="badge badge-success">Ready</span>}
                  {fileObj.status === 'duplicate' && <span className="badge badge-warning">Review</span>}
                  {fileObj.status === 'error' && <span className="badge badge-danger">Failed</span>}
                </div>

                <div className="file-actions">
                  <button
                    className="file-action-btn danger"
                    onClick={() => removeFile(fileObj.id)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate Detection Panel */}
      {duplicates.length > 0 && !importSummary && (
        <div className="duplicate-panel">
          <div className="duplicate-panel-header">
            <div className="duplicate-panel-icon">⚠</div>
            <div>
              <div className="duplicate-panel-title">Potential Duplicates Found</div>
              <div className="duplicate-panel-subtitle">
                {duplicates.length} entries match existing records. Select which to import anyway.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => selectAllDuplicates(true)}
            >
              Select All
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => selectAllDuplicates(false)}
            >
              Deselect All
            </button>
          </div>

          <div className="duplicate-list">
            {duplicates.map(dup => (
              <div key={dup.id} className="duplicate-item">
                <div className="duplicate-item-info">
                  <input
                    type="checkbox"
                    className="duplicate-item-checkbox"
                    checked={selectedDuplicates.has(dup.id)}
                    onChange={() => toggleDuplicate(dup.id)}
                  />
                  <div className="duplicate-item-details">
                    <div className="duplicate-item-name">
                      {dup.vendor || dup.description || 'Unknown Entry'}
                    </div>
                    <div className="duplicate-item-meta">
                      ${dup.amount?.toLocaleString()} • {dup.category} • {dup.date || 'No date'}
                      <span style={{ opacity: 0.5 }}> • from {dup.sourceFileName}</span>
                    </div>
                  </div>
                </div>
                <div className="duplicate-item-meta">
                  Matches existing entry
                </div>
              </div>
            ))}
          </div>

          <div className="duplicate-actions">
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
              {selectedDuplicates.size} of {duplicates.length} duplicates selected to import
            </span>
          </div>
        </div>
      )}

      {/* Import Summary */}
      {importSummary && (
        <div className="import-summary">
          <div className="import-summary-header">Import Complete</div>

          <div className="import-stats">
            <div className="import-stat success">
              <div className="import-stat-value">{importSummary.imported}</div>
              <div className="import-stat-label">Entries Imported</div>
            </div>
            <div className="import-stat">
              <div className="import-stat-value">{importSummary.episodes}</div>
              <div className="import-stat-label">Episodes Created</div>
            </div>
            <div className="import-stat">
              <div className="import-stat-value">{importSummary.sets}</div>
              <div className="import-stat-label">Sets Created</div>
            </div>
            {importSummary.skipped > 0 && (
              <div className="import-stat warning">
                <div className="import-stat-value">{importSummary.skipped}</div>
                <div className="import-stat-label">Skipped Duplicates</div>
              </div>
            )}
          </div>

          {importSummary.errors.length > 0 && (
            <div className="alert alert-error">
              <strong>Some files had errors:</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                {importSummary.errors.map((err, idx) => (
                  <li key={idx}>{err.file}: {err.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="modal-footer" style={{ borderTop: 'none', marginTop: '2rem' }}>
        {onClose && (
          <button className="btn btn-secondary" onClick={onClose}>
            {importSummary ? 'Close' : 'Cancel'}
          </button>
        )}

        {readyFilesCount > 0 && !importSummary && (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleImport}
            disabled={isImporting}
          >
            {isImporting ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Importing...
              </>
            ) : (
              <>Import {totalEntries} Entries</>
            )}
          </button>
        )}

        {importSummary && onImportComplete && (
          <button
            className="btn btn-primary"
            onClick={onImportComplete}
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};

export default LedgerUpload;
