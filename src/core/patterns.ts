/**
 * Regex patterns for detecting PII in string content
 */
export const PII_PATTERNS: readonly RegExp[] = Object.freeze([
  // Social Security Numbers (US)
  /\b\d{3}-\d{2}-\d{4}\b/g,

  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone numbers (US format)
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,

  // JWT tokens
  /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
]);

/**
 * Regex patterns for credentials in free text, such as error messages and log
 * lines: Heroku API tokens, Authorization header values, `Bearer`/`Basic`
 * credentials, and the password in a URL. Each pattern matches only the secret,
 * so `Bearer abc123…` becomes `Bearer [SCRUBBED]` and
 * `postgres://user:pass@host` becomes `postgres://[SCRUBBED]@host`.
 *
 * Every quantifier is bounded, so the cost stays linear on long input.
 *
 * Standalone `Bearer`/`Basic` values are matched only when they look like a
 * credential (8 or more characters, with a digit, symbol, or uppercase letter
 * after the first character), so prose like "Basic size dynos" is left alone.
 * Legacy UUID-format Heroku tokens look like any other ID; redact those by
 * exact value.
 *
 * @example
 * ```typescript
 * import { CREDENTIAL_PATTERNS, Scrubber } from '@heroku/js-blanket';
 *
 * const scrubber = new Scrubber({ patterns: CREDENTIAL_PATTERNS });
 * scrubber.scrub('rediss://:p4ssw0rd@ec2-1-2-3-4.compute-1.amazonaws.com:6379').data;
 * // 'rediss://[SCRUBBED]@ec2-1-2-3-4.compute-1.amazonaws.com:6379'
 * ```
 */
export const CREDENTIAL_PATTERNS: readonly RegExp[] = Object.freeze([
  // Heroku API tokens. No leading \b: a token right after an ANSI color code
  // (`\x1b[1mHRKU-…`) has no word boundary before it.
  /HRKU-[\w-]{1,512}/g,

  // Authorization header values, with or without a scheme, as in
  // `Authorization: Bearer x`, `"authorization":"x"` or `authorization='x'`.
  /(?<=\bauthorization["']?\s{0,8}[:=]\s{0,8}["']?(?:(?:bearer|basic|token)\s{1,8})?)(?!(?:bearer|basic|token)\s)[^\s"',;}]{1,4096}/gi,

  // Standalone Bearer values.
  /(?<=\b[Bb]earer\s{1,8})(?=[\w.~+/=-][a-z]{0,4096}[A-Z\d_.~+/=-])[\w.~+/=-]{8,4096}/g,

  // Standalone Basic values (base64 of user:password).
  /(?<=\b[Bb]asic\s{1,8})(?=[A-Za-z\d+/][a-z]{0,4096}[A-Z\d+/=])[A-Za-z\d+/]{8,4096}={0,2}/g,

  // The userinfo of a URL with a password, including an empty username
  // (`rediss://:password@host`) and a password with an unencoded `/` or `@`:
  // everything up to the last `@` in the URL is redacted. That over-redacts a
  // URL with a port and an `@` in its path (`https://host:443/u/a@b.com`),
  // which is rare in error text.
  /(?<=\b[a-z][\d+.a-z-]{0,31}:\/\/)[^\s/?#@:]{0,256}:\S{0,4096}(?=@)/gi,
]);
