import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

function Upload({ onProjectLoad }) {
  const { projectId } = useParams();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState('ledger');
  const [parsedData, setParsedData] = useState(null);
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [filesRes, categoriesRes, projectRes] = await Promise.all([
        axios.get(`/api/upload/files/${projectId}`),
        axios.get('/api/budgets/categories'),
        axios.get(`/api/projects/${projectId}`)
      ]);
      setUploadedFiles(filesRes.data);
      setCategories(categoriesRes.data);
      if (onProjectLoad) {
        onProjectLoad(projectRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', uploadType);

    setUploading(true);
    setMessage(null);

    try {
      const response = await axios.post(`/api/upload/pdf/${projectId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setParsedData({
        fileId: response.data.file_id,
        filename: response.data.filename,
        entries: response.data.parsed_entries
      });
      setSelectedEntries(response.data.parsed_entries.map((_, i) => i));
      setMessage({
        type: 'success',
        text: `Found ${response.data.entries_found} potential entries in ${response.data.filename}`
      });

      // Refresh files list
      const filesRes = await axios.get(`/api/upload/files/${projectId}`);
      setUploadedFiles(filesRes.data);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to upload file'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handleFileUpload(file);
    } else {
      setMessage({ type: 'error', text: 'Please upload a PDF file' });
    }
  }, [projectId, uploadType]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const toggleEntry = (index) => {
    if (selectedEntries.includes(index)) {
      setSelectedEntries(selectedEntries.filter(i => i !== index));
    } else {
      setSelectedEntries([...selectedEntries, index]);
    }
  };

  const toggleAll = () => {
    if (selectedEntries.length === parsedData.entries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(parsedData.entries.map((_, i) => i));
    }
  };

  const updateEntryCategory = (index, category) => {
    const newEntries = [...parsedData.entries];
    newEntries[index] = { ...newEntries[index], category };
    setParsedData({ ...parsedData, entries: newEntries });
  };

  const importEntries = async () => {
    const entriesToImport = selectedEntries.map(i => parsedData.entries[i]);

    try {
      const response = await axios.post(`/api/upload/import/${parsedData.fileId}`, {
        entries: entriesToImport,
        type: uploadType
      });

      setMessage({
        type: 'success',
        text: `Successfully imported ${response.data.imported_count} entries`
      });
      setParsedData(null);
      setSelectedEntries([]);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to import entries'
      });
    }
  };

  const deleteFile = async (fileId) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await axios.delete(`/api/upload/files/${fileId}`);
        setUploadedFiles(uploadedFiles.filter(f => f.id !== fileId));
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Upload Area */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>Upload PDF</h3>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Import as:</label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="uploadType"
                value="ledger"
                checked={uploadType === 'ledger'}
                onChange={e => setUploadType(e.target.value)}
              />
              Ledger Entries (Actual Costs)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="uploadType"
                value="budget"
                checked={uploadType === 'budget'}
                onChange={e => setUploadType(e.target.value)}
              />
              Budget Items (Planned Costs)
            </label>
          </div>
        </div>

        <div
          className={`upload-area ${dragOver ? 'dragging' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('file-input').click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          {uploading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p style={{ marginTop: '1rem' }}>Processing PDF...</p>
            </div>
          ) : (
            <>
              <div className="upload-icon">📄</div>
              <p className="upload-text">
                <strong>Click to upload</strong> or drag and drop<br />
                PDF files only (max 10MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Parsed Data Review */}
      {parsedData && parsedData.entries.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">
              Review Extracted Data - {parsedData.filename}
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={toggleAll}>
                {selectedEntries.length === parsedData.entries.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                className="btn btn-primary"
                onClick={importEntries}
                disabled={selectedEntries.length === 0}
              >
                Import {selectedEntries.length} Selected
              </button>
            </div>
          </div>

          <p style={{ marginBottom: '1rem', color: 'var(--gray-600)' }}>
            Review and adjust the extracted data before importing. You can change categories and deselect items you don't want to import.
          </p>

          <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedEntries.length === parsedData.entries.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.entries.map((entry, index) => (
                  <tr
                    key={index}
                    style={{
                      opacity: selectedEntries.includes(index) ? 1 : 0.5,
                      background: selectedEntries.includes(index) ? 'white' : 'var(--gray-50)'
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedEntries.includes(index)}
                        onChange={() => toggleEntry(index)}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={entry.category}
                        onChange={e => updateEntryCategory(index, e.target.value)}
                        style={{ minWidth: '150px' }}
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>
                      {entry.description?.substring(0, 60)}
                      {entry.description?.length > 60 && '...'}
                    </td>
                    <td>{entry.date || '-'}</td>
                    <td className="amount">{formatCurrency(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: '0.375rem' }}>
            <strong>Selected Total:</strong>{' '}
            {formatCurrency(
              selectedEntries.reduce((sum, i) => sum + (parsedData.entries[i]?.amount || 0), 0)
            )}
            {' '}({selectedEntries.length} items)
          </div>
        </div>
      )}

      {parsedData && parsedData.entries.length === 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">No Entries Found</div>
            <p>
              Could not extract cost data from this PDF. The file may have an unsupported format
              or the data may need to be entered manually.
            </p>
          </div>
        </div>
      )}

      {/* Previously Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Previously Uploaded Files</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {uploadedFiles.map(file => (
                  <tr key={file.id}>
                    <td>{file.original_name}</td>
                    <td>
                      <span className={`badge ${file.upload_type === 'budget' ? 'badge-info' : 'badge-success'}`}>
                        {file.upload_type || 'ledger'}
                      </span>
                    </td>
                    <td>{formatFileSize(file.file_size)}</td>
                    <td>{new Date(file.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteFile(file.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card" style={{ marginTop: '1.5rem', background: 'var(--gray-50)' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>Tips for PDF Upload</h4>
        <ul style={{ marginLeft: '1.5rem', color: 'var(--gray-600)' }}>
          <li>Works best with structured PDFs like invoices, cost reports, and vendor statements</li>
          <li>The parser looks for dollar amounts and tries to categorize based on keywords</li>
          <li>Review and adjust categories before importing - the auto-detection may not be perfect</li>
          <li>You can deselect entries that shouldn't be imported</li>
          <li>For complex PDFs, you may need to enter data manually</li>
        </ul>
      </div>
    </div>
  );
}

export default Upload;
