import React from 'react';

/**
 * Reusable form field with validation error display
 */
function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  required = false,
  placeholder,
  min,
  max,
  step,
  options,
  disabled = false,
  autoFocus = false
}) {
  const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: `1px solid ${error ? 'var(--danger)' : 'var(--gray-300)'}`,
    borderRadius: '0.375rem',
    fontSize: '1rem',
    transition: 'border-color 0.2s',
    background: disabled ? 'var(--gray-100)' : 'white'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--gray-700)',
    marginBottom: '0.25rem'
  };

  const errorStyle = {
    color: 'var(--danger)',
    fontSize: '0.75rem',
    marginTop: '0.25rem'
  };

  const renderInput = () => {
    if (type === 'select' && options) {
      return (
        <select
          name={name}
          value={value}
          onChange={onChange}
          style={inputStyle}
          disabled={disabled}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (type === 'textarea') {
      return (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      );
    }

    return (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        style={inputStyle}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    );
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      {label && (
        <label style={labelStyle}>
          {label}
          {required && <span style={{ color: 'var(--danger)' }}> *</span>}
        </label>
      )}
      {renderInput()}
      {error && (
        <p style={errorStyle}>{error}</p>
      )}
    </div>
  );
}

export default FormField;
