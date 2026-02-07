import React, { useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import * as api from '../services/api';

export default function LinkAccount({ onSuccess }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const initLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.createLinkToken();
      setLinkToken(data.link_token);
    } catch (err) {
      setError('Failed to initialize account linking. Check API keys.');
      setLoading(false);
    }
  };

  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    try {
      await api.exchangeToken(publicToken, metadata.institution);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError('Failed to link account');
    }
    setLinkToken(null);
    setLoading(false);
  }, [onSuccess]);

  const onPlaidExit = useCallback(() => {
    setLinkToken(null);
    setLoading(false);
  }, []);

  const plaidConfig = {
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  };

  const { open, ready } = usePlaidLink(plaidConfig);

  // Auto-open Plaid Link when token is ready
  React.useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <div>
      <button
        className="link-btn"
        onClick={initLink}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 0 }} />
            Connecting...
          </>
        ) : (
          <>+ Link Fidelity, Merrill Lynch, or other account</>
        )}
      </button>
      {error && (
        <div style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          {error}
        </div>
      )}
    </div>
  );
}
