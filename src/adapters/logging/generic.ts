import { Scrubber } from '../../core/scrubber.js';
import { ScrubConfig } from '../../core/types.js';

/**
 * Create a generic redactor for use with any logging library
 *
 * @example
 * ```typescript
 * const redactor = createRedactor({
 *   fields: HEROKU_FIELDS,
 *   paths: ['request.headers.Authorization'],
 *   patterns: PII_PATTERNS
 * });
 *
 * const scrubbed = redactor.scrub({ user: { password: 'secret' } });
 * console.log(scrubbed.data); // { user: { password: '[SCRUBBED]' } }
 * ```
 */
export function createRedactor(config: ScrubConfig) {
  return new Scrubber(config);
}
