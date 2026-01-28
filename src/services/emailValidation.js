/**
 * Email Validation Service
 * Handles email validation, normalization, and extraction
 */

// RFC 5322 basic email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Common free email providers
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.com.br',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mail.com',
  'protonmail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'gmx.net',
  'uol.com.br',
  'bol.com.br',
  'terra.com.br',
  'ig.com.br',
]);

/**
 * Validates an email address against RFC 5322 basic rules
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmed = email.trim();

  // Check length constraints
  if (trimmed.length < 3 || trimmed.length > 254) {
    return false;
  }

  // Check basic format
  if (!EMAIL_REGEX.test(trimmed)) {
    return false;
  }

  // Check local part length (max 64 chars)
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex > 64) {
    return false;
  }

  // Check domain length
  const domain = trimmed.slice(atIndex + 1);
  if (domain.length > 253) {
    return false;
  }

  return true;
}

/**
 * Normalizes an email address for consistent storage and comparison
 * - Converts to lowercase
 * - Trims whitespace
 * - Removes plus aliases (e.g., user+tag@gmail.com -> user@gmail.com)
 * - Removes dots in Gmail local part (optional, for Gmail normalization)
 * @param {string} email - Email address to normalize
 * @param {Object} options - Normalization options
 * @param {boolean} options.removeAlias - Remove +alias tags (default: true)
 * @param {boolean} options.normalizeGmailDots - Remove dots from Gmail local part (default: false)
 * @returns {string|null} - Normalized email or null if invalid
 */
export function normalizeEmail(email, options = {}) {
  const { removeAlias = true, normalizeGmailDots = false } = options;

  if (!isValidEmail(email)) {
    return null;
  }

  let normalized = email.trim().toLowerCase();
  const parts = extractEmailParts(normalized);

  if (!parts) {
    return null;
  }

  let { local, domain } = parts;

  // Remove plus alias (user+tag -> user)
  if (removeAlias && local.includes('+')) {
    local = local.split('+')[0];
  }

  // Normalize Gmail dots (jo.hn.doe -> johndoe)
  if (normalizeGmailDots && (domain === 'gmail.com' || domain === 'googlemail.com')) {
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
}

/**
 * Extracts local and domain parts from an email address
 * @param {string} email - Email address
 * @returns {Object|null} - { local, domain } or null if invalid
 */
export function extractEmailParts(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');

  if (atIndex === -1 || atIndex === 0 || atIndex === trimmed.length - 1) {
    return null;
  }

  return {
    local: trimmed.slice(0, atIndex),
    domain: trimmed.slice(atIndex + 1),
  };
}

/**
 * Checks if an email belongs to a business/corporate domain
 * (i.e., not a free email provider)
 * @param {string} email - Email address to check
 * @returns {boolean} - True if business email
 */
export function isBusinessEmail(email) {
  const parts = extractEmailParts(email);

  if (!parts) {
    return false;
  }

  return !FREE_EMAIL_DOMAINS.has(parts.domain);
}

/**
 * Validates a batch of emails and returns validation results
 * @param {string[]} emails - Array of emails to validate
 * @returns {Object} - { valid: string[], invalid: string[], normalized: Map }
 */
export function validateEmailBatch(emails) {
  const result = {
    valid: [],
    invalid: [],
    normalized: new Map(),
  };

  if (!Array.isArray(emails)) {
    return result;
  }

  for (const email of emails) {
    if (isValidEmail(email)) {
      result.valid.push(email);
      result.normalized.set(email, normalizeEmail(email));
    } else {
      result.invalid.push(email);
    }
  }

  return result;
}

/**
 * Extracts all email addresses from a text string
 * @param {string} text - Text containing email addresses
 * @returns {string[]} - Array of extracted email addresses
 */
export function extractEmailsFromText(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // More permissive regex for extraction (then validate each)
  const extractionRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(extractionRegex) || [];

  // Filter to only valid emails
  return matches.filter(isValidEmail);
}

export default {
  isValidEmail,
  normalizeEmail,
  extractEmailParts,
  isBusinessEmail,
  validateEmailBatch,
  extractEmailsFromText,
};
