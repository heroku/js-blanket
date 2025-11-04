/**
 * Heroku-specific sensitive fields
 * Consolidated from Ruby sentry-blanket gem, Dashboard, and Herokudata-frontend
 */
export const HEROKU_FIELDS = [
  // Authentication & Sessions
  'access_token',
  /api[-_]?key/i, // Matches api_key, api-key, apikey (case insensitive)
  'authenticity_token',
  'heroku_oauth_token',
  'heroku_session_nonce',
  'heroku_user_session',
  'oauth_token',
  'sudo_oauth_token',
  'super_user_session_secret',
  'user_session_secret',
  'postgres_session_nonce',

  // Passwords & Secrets
  'password',
  'passwd',
  'old_secret',
  'secret',
  'secret_token',
  'confirm_password',
  'password_confirmation',
  /client[-_]?secret/i, // Matches client_secret, client-secret, clientsecret

  // Tokens & Codes
  'token',
  'code',
  'state',
  'bouncer.token',
  'bouncer.refresh_token',

  // Headers (case-insensitive)
  /authorization/i,
  /cookie/i,
  /x-refresh-token/i,

  // SSO & Sessions
  'www-sso-session',

  // Payment
  'payment_method',

  // Infrastructure
  'logplexUrl',
];

/**
 * GDPR-relevant PII fields
 */
export const GDPR_FIELDS = [
  'email',
  'phone',
  'address',
  'postal_code',
  'ssn',
  'tax_id',
];

/**
 * PCI-DSS relevant fields
 */
export const PCI_FIELDS = [
  'card_number',
  'cvv',
  'credit_card',
  'payment_method',
];
