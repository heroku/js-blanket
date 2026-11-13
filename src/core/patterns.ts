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
 * `postgres://user:pass@host` becomes `postgres://[SCRUBBED]@host`. An
 * Authorization value with any scheme other than Bearer or Basic is replaced
 * up to the end of the header value, since its credential can span several
 * parameters (`Digest username="u", response="…"`).
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
  // Authorization header values, in header, JSON, or object-literal form:
  // `Authorization: Bearer x`, `"authorization":"x"` or `authorization: 'x'`.
  //
  // A Bearer or Basic credential is a single token, so the scheme is kept and
  // only the token is replaced. The token stops at whitespace, a quote, or the
  // punctuation that can follow it in text, such as `)`, `]`, `>` or `&`.
  /(?<=\bauthorization["']?\s{0,8}[:=]\s{0,8}["']?(?:bearer|basic)\s{1,8})[^\s"'`,;()[\]<>{}&]{1,4096}/gi,

  // Any other value is replaced up to the end of the header value: the closing
  // quote of a quoted value, or for an unquoted value the end of the line or a
  // closing `)`, `]`, `>`, `}` or `&`. That covers parameterized schemes such
  // as `Digest username="u", response="…"`. The scheme word is kept for
  // Digest, Negotiate, NTLM, OAuth and Token, and replaced along with the
  // value for any other scheme. One pattern per quoting style: double-quoted,
  // single-quoted, unquoted.
  /(?<=\bauthorization["']?\s{0,8}[:=]\s{0,8}"(?:(?:digest|negotiate|ntlm|oauth|token)\s{1,8})?)(?!(?:bearer|basic|digest|negotiate|ntlm|oauth|token)\s)(?:\\.|[^"\\\r\n]){1,4096}/gi,
  /(?<=\bauthorization["']?\s{0,8}[:=]\s{0,8}'(?:(?:digest|negotiate|ntlm|oauth|token)\s{1,8})?)(?!(?:bearer|basic|digest|negotiate|ntlm|oauth|token)\s)(?:\\.|[^'\\\r\n]){1,4096}/gi,
  /(?<=\bauthorization["']?\s{0,8}[:=]\s{0,8}(?:(?:digest|negotiate|ntlm|oauth|token)\s{1,8})?)(?![\s"'])(?!(?:bearer|basic|digest|negotiate|ntlm|oauth|token)\s)(?:"[^"\r\n]{0,512}"|[^\r\n"'()[\]<>{}&]){1,4096}/gi,

  // Standalone Bearer values.
  /(?<=\b[Bb]earer\s{1,8})(?=[\w.~+/=-][a-z]{0,4096}[A-Z\d_.~+/=-])[\w.~+/=-]{8,4096}/g,

  // Standalone Basic values (base64 of user:password).
  /(?<=\b[Bb]asic\s{1,8})(?=[A-Za-z\d+/][a-z]{0,4096}[A-Z\d+/=])[A-Za-z\d+/]{8,4096}={0,2}/g,

  // The userinfo of a URL with a password, including an empty username
  // (`rediss://:password@host`) and a password with an unencoded `/` or `@`:
  // everything up to the last `@` before whitespace, a quote, or `<`/`>` is
  // redacted, so the match stays inside one JSON string or quoted value. That
  // over-redacts a URL with a port and an `@` in its path
  // (`https://host:443/u/a@b.com`), which is rare in error text.
  /(?<=\b[a-z][\d+.a-z-]{0,31}:\/\/)[^\s/?#@:]{0,256}:[^\s"'<>]{0,4096}(?=@)/gi,

  // Heroku API tokens. No leading \b: a token right after an ANSI color code
  // (`\x1b[1mHRKU-…`) has no word boundary before it. Listed last so the
  // Authorization patterns above see the token itself, not a replacement.
  /HRKU-[\w-]{1,512}/g,
]);
