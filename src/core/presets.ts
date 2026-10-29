/**
 * Heroku-specific sensitive field patterns
 *
 * Consolidated list of field names and patterns that contain sensitive data in Heroku applications.
 *
 * Use this preset to ensure consistent PII handling across Heroku services.
 *
 * @example
 * ```typescript
 * import { HEROKU_FIELDS } from '@heroku/js-blanket/core/presets';
 * import { Scrubber } from '@heroku/js-blanket';
 *
 * const scrubber = new Scrubber({ fields: HEROKU_FIELDS });
 * const result = scrubber.scrub(data);
 * ```
 */
export const HEROKU_FIELDS: readonly (string | RegExp)[] = Object.freeze([
  // Base substring matches. Field matching is case-insensitive *substring*
  // (see Scrubber.isSensitiveField), so these three cover every key that
  // merely contains them — `token` catches access_token / oauth_token /
  // authenticity_token / x-refresh-token / secret_token / bouncer.*, `secret`
  // catches client_secret / old_secret / *_session_secret, `password` catches
  // database_password / confirm_password / password_confirmation. Do NOT
  // re-list those variants; it's dead weight that the base entries already match.
  'token',
  'secret',
  'password',
  'passwd', // not a substring of "password", so listed separately

  // Authentication & Sessions
  /api[-_]?key/i, // Matches api_key, api-key, apikey (case insensitive)
  'heroku_session_nonce',
  'postgres_session_nonce',
  'heroku_user_session',

  // Passwords & Secrets
  'pre_shared_key',
  'private_key', // TLS/SSH/GPG private keys (not matched by the api_key pattern)

  // Headers (case-insensitive)
  /authorization/i,
  /cookie/i,
  'heroku-two-factor-code',
  'x-addon-sso',
  'heroku-webhook-hmac-sha256', // Heroku webhook signature header

  // SSO & Sessions
  'www-sso-session',

  // Payment
  'payment_method',

  // Infrastructure — credential-bearing URLs. Keys are matched case- AND
  // separator-insensitively, so camelCase / kebab / snake all scrub. This
  // matters because the Platform API returns the snake_case spellings
  // (logplex_url, attach_url), which a camelCase literal would miss.
  /logplex[-_]?url/i, // log-session URL — tokenized, grants log access
  /resource[-_]?url/i, // addon resource URL w/ embedded creds (postgres://user:pass@host/db)
  /attach[-_]?url/i, // `heroku run`/exec dyno attach URL — rendezvous://…/<secret>
  // Addon DB connection URLs whose value embeds credentials, e.g. REDIS_URL,
  // REDIS_TLS_URL, HEROKU_POSTGRESQL_<COLOR>_URL, MONGODB_URL. (kafka_*_url is
  // intentionally excluded — those are often plain, non-credential broker lists.)
  /(?:redis|postgres(?:ql)?|mongo(?:db)?|mysql|memcached?|amqp|rabbitmq|clickhouse)[\w-]*_url/i,
  'database_url', // Config var whose value embeds credentials
  'connection_string', // Config var whose value embeds credentials
]);

/**
 * GDPR-relevant PII field patterns
 *
 * Field names that typically contain personally identifiable information (PII)
 * regulated by GDPR (General Data Protection Regulation).
 *
 * Use this preset when handling EU user data to ensure compliance with GDPR requirements.
 *
 * @see {@link https://gdpr.eu/what-is-gdpr/|GDPR Official Documentation}
 *
 * @example
 * ```typescript
 * import { GDPR_FIELDS, HEROKU_FIELDS } from '@heroku/js-blanket/core/presets';
 * import { Scrubber } from '@heroku/js-blanket';
 *
 * // Combine multiple presets
 * const scrubber = new Scrubber({
 *   fields: [...HEROKU_FIELDS, ...GDPR_FIELDS]
 * });
 * ```
 */
export const GDPR_FIELDS: readonly string[] = Object.freeze([
  'email',
  'phone',
  'address',
  'postal_code',
  'ssn',
  'tax_id',
]);

/**
 * PCI-DSS relevant field patterns
 *
 * Field names that typically contain payment card information regulated by
 * PCI-DSS (Payment Card Industry Data Security Standard).
 *
 * Use this preset when handling payment card data to help maintain PCI-DSS compliance.
 *
 * **Important**: This preset helps reduce exposure of sensitive payment data in logs and
 * error reports, but is not a substitute for full PCI-DSS compliance measures.
 *
 * @see {@link https://www.pcisecuritystandards.org/|PCI Security Standards Council}
 *
 * @example
 * ```typescript
 * import { PCI_FIELDS } from '@heroku/js-blanket/core/presets';
 * import { Scrubber } from '@heroku/js-blanket';
 *
 * const scrubber = new Scrubber({
 *   fields: PCI_FIELDS,
 *   patterns: [/\d{4}-\d{4}-\d{4}-\d{4}/g]  // Also scrub card numbers in text
 * });
 * ```
 */
export const PCI_FIELDS: readonly string[] = Object.freeze([
  'card_number',
  'cvv',
  'credit_card',
  'payment_method',
]);
