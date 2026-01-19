/**
 * Form validation utilities
 */

/**
 * Validate a project form
 */
export function validateProject(data) {
  const errors = {};

  if (!data.name || !data.name.trim()) {
    errors.name = 'Project name is required';
  } else if (data.name.length > 200) {
    errors.name = 'Project name must be less than 200 characters';
  }

  if (data.start_date && data.end_date) {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    if (start > end) {
      errors.end_date = 'End date must be after start date';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate an episode/tab form
 */
export function validateEpisode(data) {
  const errors = {};

  if (!data.name || !data.name.trim()) {
    errors.name = 'Tab name is required';
  } else if (data.name.length > 100) {
    errors.name = 'Tab name must be less than 100 characters';
  }

  if (!data.type) {
    errors.type = 'Tab type is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate a set form
 */
export function validateSet(data) {
  const errors = {};

  if (!data.set_name || !data.set_name.trim()) {
    errors.set_name = 'Set name is required';
  } else if (data.set_name.length > 200) {
    errors.set_name = 'Set name must be less than 200 characters';
  }

  // Validate budget fields are non-negative numbers
  const budgetFields = [
    'budget_loc_fees', 'budget_security', 'budget_fire',
    'budget_rentals', 'budget_permits', 'budget_police'
  ];

  budgetFields.forEach(field => {
    const value = parseFloat(data[field]);
    if (data[field] && (isNaN(value) || value < 0)) {
      errors[field] = 'Must be a positive number';
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate a cost entry form
 */
export function validateCost(data) {
  const errors = {};

  if (!data.amount || parseFloat(data.amount) <= 0) {
    errors.amount = 'Amount must be greater than 0';
  }

  if (data.amount && parseFloat(data.amount) > 10000000) {
    errors.amount = 'Amount seems too large. Please verify.';
  }

  if (!data.category) {
    errors.category = 'Category is required';
  }

  if (data.description && data.description.length > 500) {
    errors.description = 'Description must be less than 500 characters';
  }

  if (data.vendor && data.vendor.length > 200) {
    errors.vendor = 'Vendor name must be less than 200 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Format validation errors for display
 */
export function getFieldError(errors, fieldName) {
  return errors[fieldName] || null;
}

/**
 * Check if a field has an error
 */
export function hasError(errors, fieldName) {
  return Boolean(errors[fieldName]);
}

export default {
  validateProject,
  validateEpisode,
  validateSet,
  validateCost,
  getFieldError,
  hasError
};
