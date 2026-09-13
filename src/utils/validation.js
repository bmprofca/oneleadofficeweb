export function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value).trim() === '';
}

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export const validators = {
  required:
    (message = 'This field is required') =>
    (value) =>
      (isEmpty(value) ? message : ''),

  minLength:
    (min, message) =>
    (value) => {
      if (isEmpty(value)) return '';
      return String(value).trim().length < min
        ? message || `Must be at least ${min} characters`
        : '';
    },

  maxLength:
    (max, message) =>
    (value) => {
      if (isEmpty(value)) return '';
      return String(value).trim().length > max
        ? message || `Must be at most ${max} characters`
        : '';
    },

  phone:
    (message = 'Enter a valid 10-digit mobile number') =>
    (value) => {
      if (isEmpty(value)) return '';
      const digits = normalizePhone(value);
      return digits.length === 10 ? '' : message;
    },

  email:
    (message = 'Enter a valid email address') =>
    (value) => {
      if (isEmpty(value)) return '';
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
      return ok ? '' : message;
    },

  otp:
    (message = 'Enter a valid 6-digit OTP') =>
    (value) => {
      if (isEmpty(value)) return '';
      return /^\d{6}$/.test(String(value).trim()) ? '' : message;
    },

  url:
    (message = 'Enter a valid URL') =>
    (value) => {
      if (isEmpty(value)) return '';
      try {
        const parsed = new URL(String(value).trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          ? ''
          : message;
      } catch {
        return message;
      }
    },

  oneOf:
    (list, message = 'Select a valid option') =>
    (value) => {
      if (isEmpty(value)) return '';
      return list.map(String).includes(String(value)) ? '' : message;
    },

  arrayMin:
    (min, message) =>
    (value) =>
      Array.isArray(value) && value.length >= min
        ? ''
        : message || `Select at least ${min}`,

  datetime:
    (message = 'Select a valid date and time') =>
    (value) => {
      if (isEmpty(value)) return '';
      const date = new Date(String(value).replace(' ', 'T'));
      return Number.isNaN(date.getTime()) ? message : '';
    },

  custom: (fn) => (value, values) => fn(value, values) || '',
};

/**
 * schema: { field: [validatorFn, ...] }
 * returns { valid: boolean, errors: { field: message } }
 */
export function validateForm(schema, values) {
  const errors = {};

  Object.entries(schema).forEach(([field, rules]) => {
    const list = Array.isArray(rules) ? rules : [rules];
    for (const rule of list) {
      const message = rule(values[field], values);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function clearFieldError(errors, field) {
  if (!errors?.[field]) return errors || {};
  const next = { ...errors };
  delete next[field];
  return next;
}
