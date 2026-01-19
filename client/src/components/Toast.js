import React, { useEffect } from 'react';

/**
 * Toast notification component for showing feedback messages
 */
function Toast({ message, type = 'info', duration = 3000, onClose }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      default:
        return '#2563eb';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '\u2713'; // checkmark
      case 'error':
        return '\u2717'; // X
      case 'warning':
        return '\u26A0'; // warning
      default:
        return '\u2139'; // info
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: getBackgroundColor(),
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 9999,
        animation: 'slideIn 0.3s ease',
        maxWidth: '400px'
      }}
    >
      <span style={{ fontSize: '1.2em' }}>{getIcon()}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          padding: '0 4px',
          fontSize: '1.2em',
          opacity: 0.8
        }}
      >
        &times;
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default Toast;
