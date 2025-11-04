// Core exports
export { Scrubber } from './core/scrubber.js';
export type { ScrubConfig, ScrubResult } from './core/types.js';
export { HEROKU_FIELDS, GDPR_FIELDS, PCI_FIELDS } from './core/presets.js';
export { PII_PATTERNS } from './core/patterns.js';

// Logging adapter
export { createRedactor } from './adapters/logging/generic.js';

// Exception handler adapters
export {
  initSentryWithBlanket,
  createSentryEventScrubber,
} from './adapters/exception-handlers/sentry.js';
export type {
  SentryEvent,
  SentryBlanketConfig,
} from './adapters/exception-handlers/sentry.js';
