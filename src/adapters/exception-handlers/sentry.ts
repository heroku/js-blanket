/**
 * Sentry Exception Handler Adapter
 *
 * A thin adapter (~100 lines) that wraps the core Scrubber to automatically
 * scrub Sentry events and transactions before they're sent.
 *
 * ### Features
 * - Scrubs error events via `beforeSend` hook
 * - Scrubs transaction events via `beforeSendTransaction` hook
 * - Scrubs breadcrumbs (console logs, HTTP requests, etc.)
 * - Preserves user's existing callbacks
 * - Immutable operations (original events unchanged)
 *
 * ### Usage
 * ```typescript
 * import * as Sentry from '@sentry/node';
 * import { initSentryWithBlanket, HEROKU_FIELDS } from '@heroku/js-blanket';
 *
 * initSentryWithBlanket(Sentry, {
 *   dsn: process.env.SENTRY_DSN,
 *   environment: 'production',
 *   fields: HEROKU_FIELDS,
 *   patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g], // Email pattern
 * });
 * ```
 *
 * ### Compatibility
 * - Sentry SDK: >=10.0.0 (tested with v10.x, v11.x, v12.x)
 * - Node.js: >=20.0.0
 * - Uses stable APIs: beforeSend, beforeSendTransaction (since v5)
 *
 * @see {@link https://docs.sentry.io/platforms/javascript/configuration/filtering/}
 */

import { Scrubber } from '../../core/scrubber.js';

/**
 * Sentry Event interface
 *
 * Represents a Sentry error or transaction event. This is compatible with
 * both @sentry/node and @sentry/browser Event types.
 *
 * @see {@link https://docs.sentry.io/platforms/javascript/enriching-events/}
 */
export interface SentryEvent {
  event_id?: string;
  timestamp?: number;
  start_timestamp?: number;
  level?: string;
  message?: string;
  logger?: string;
  platform?: string;
  type?: string;
  transaction?: string;

  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: unknown;
      mechanism?: unknown;
    }>;
  };

  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    data?: unknown;
    query_string?: string;
    cookies?: Record<string, string>;
  };

  user?: {
    id?: string;
    email?: string;
    username?: string;
    ip_address?: string;
    [key: string]: unknown;
  };

  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, string>;
  fingerprint?: string[];

  breadcrumbs?: Array<{
    timestamp?: number;
    type?: string;
    category?: string;
    level?: string;
    message?: string;
    data?: Record<string, unknown>;
  }>;

  spans?: Array<{
    span_id?: string;
    trace_id?: string;
    parent_span_id?: string;
    op?: string;
    description?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;

  [key: string]: unknown;
}

/**
 * Sentry Options interface
 *
 * Compatible with both @sentry/node and @sentry/browser init options.
 *
 * @see {@link https://docs.sentry.io/platforms/javascript/configuration/options/}
 */
export interface SentryOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  debug?: boolean;
  sampleRate?: number;
  tracesSampleRate?: number;
  maxBreadcrumbs?: number;
  attachStacktrace?: boolean;

  beforeSend?: (event: SentryEvent, hint?: unknown) => SentryEvent | null;
  beforeSendTransaction?: (
    event: SentryEvent,
    hint?: unknown
  ) => SentryEvent | null;

  [key: string]: unknown;
}

/**
 * Sentry Blanket Configuration
 *
 * Combines standard Sentry options with scrubbing configuration.
 *
 * @example Basic Usage
 * ```typescript
 * const config: SentryBlanketConfig = {
 *   dsn: process.env.SENTRY_DSN,
 *   environment: 'production',
 *   fields: ['password', 'apiToken'],
 *   replacement: '[REDACTED]'
 * };
 * ```
 *
 * @example Advanced Usage with All Options
 * ```typescript
 * const config: SentryBlanketConfig = {
 *   // Standard Sentry options
 *   dsn: process.env.SENTRY_DSN,
 *   environment: 'production',
 *   sampleRate: 0.1,
 *   tracesSampleRate: 0.01,
 *
 *   // Scrubbing options
 *   fields: [...HEROKU_FIELDS, ...GDPR_FIELDS],
 *   paths: ['user.email', 'request.headers.authorization'],
 *   patterns: [/\b\d{3}-\d{2}-\d{4}\b/g], // SSN
 *   replacement: '[SCRUBBED]',
 *
 *   // Callback options
 *   preserveUserCallback: true,
 *   beforeSend: (event) => {
 *     // Your custom logic runs AFTER scrubbing
 *     return event;
 *   }
 * };
 * ```
 */
export interface SentryBlanketConfig extends SentryOptions {
  /**
   * Field names to scrub (exact match or regex pattern)
   *
   * @example ['password', 'apiToken', /api[-_]?key/i]
   */
  fields?: (string | RegExp)[];

  /**
   * Dot-notation paths to scrub
   *
   * @example ['user.email', 'request.headers.authorization']
   */
  paths?: string[];

  /**
   * Regex patterns for content scrubbing
   *
   * @example [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g] // Email pattern
   */
  patterns?: RegExp[];

  /**
   * Replacement string for scrubbed values
   *
   * @default '[SCRUBBED]'
   */
  replacement?: string;

  /**
   * Whether to preserve and call user's beforeSend/beforeSendTransaction callbacks
   *
   * @default true
   */
  preserveUserCallback?: boolean;
}

/**
 * Initialize Sentry with automatic PII scrubbing
 *
 * This function initializes Sentry with automatic PII scrubbing via
 * `beforeSend` and `beforeSendTransaction` hooks. It wraps any existing
 * user callbacks to ensure scrubbing happens first, then user logic.
 *
 * ### What Gets Scrubbed
 * - **Error events**: exception messages, request data, user info, breadcrumbs
 * - **Transaction events**: span data, trace context data
 * - **Breadcrumbs**: console logs, HTTP requests, navigation events
 *
 * ### Callback Preservation
 * If you provide your own `beforeSend` or `beforeSendTransaction` callbacks,
 * they will be called AFTER scrubbing. This allows you to:
 * - Add custom tags or metadata
 * - Filter events (return null to drop)
 * - Modify events further
 *
 * ### Integration with Real Sentry SDK
 * ```typescript
 * import * as Sentry from '@sentry/node';
 * import { initSentryWithBlanket, HEROKU_FIELDS } from '@heroku/js-blanket';
 *
 * // One-step initialization with automatic PII scrubbing
 * initSentryWithBlanket(Sentry, {
 *   dsn: process.env.SENTRY_DSN,
 *   environment: 'production',
 *   fields: HEROKU_FIELDS
 * });
 * ```
 *
 * @param SentryModule - The Sentry SDK module (@sentry/node or @sentry/browser)
 * @param config - Combined Sentry options + scrubbing configuration
 * @returns void (initializes Sentry with scrubbing enabled)
 */
export function initSentryWithBlanket(
  SentryModule: { init: (config: SentryOptions) => void },
  config: SentryBlanketConfig
): void {
  // Create scrubber instance
  const scrubber = new Scrubber({
    fields: config.fields || [],
    paths: config.paths || [],
    patterns: config.patterns || [],
    replacement: config.replacement || '[SCRUBBED]',
    recursive: true,
  });

  // Store user's original callbacks
  const userBeforeSend = config.beforeSend;
  const userBeforeSendTransaction = config.beforeSendTransaction;

  // Build wrapped config with scrubbing callbacks
  const wrappedConfig: SentryOptions = {
    ...config,
    // Wrap beforeSend for error events
    beforeSend: (event: SentryEvent, hint?: unknown): SentryEvent | null => {
      // 1. Scrub the event
      const { data: scrubbedEvent } = scrubber.scrub(event);

      // 2. Call user's callback if they provided one
      if (userBeforeSend && config.preserveUserCallback !== false) {
        return userBeforeSend(scrubbedEvent as SentryEvent, hint);
      }

      return scrubbedEvent as SentryEvent;
    },
    // Wrap beforeSendTransaction for performance events
    beforeSendTransaction: (
      event: SentryEvent,
      hint?: unknown
    ): SentryEvent | null => {
      // 1. Scrub the transaction event
      const { data: scrubbedEvent } = scrubber.scrub(event);

      // 2. Call user's callback if they provided one
      if (userBeforeSendTransaction && config.preserveUserCallback !== false) {
        return userBeforeSendTransaction(scrubbedEvent as SentryEvent, hint);
      }

      return scrubbedEvent as SentryEvent;
    },
  };

  // Initialize Sentry with wrapped config
  SentryModule.init(wrappedConfig);
}

/**
 * Create a standalone Sentry event scrubber
 *
 * Useful for manually scrubbing Sentry events, testing, or custom integrations.
 *
 * ### Use Cases
 * - Manual event processing before sending to Sentry
 * - Testing scrubbing behavior
 * - Custom Sentry integrations
 * - Scrubbing events from Sentry API responses
 *
 * @example
 * ```typescript
 * import { createSentryEventScrubber, HEROKU_FIELDS } from '@heroku/js-blanket';
 *
 * const scrubber = createSentryEventScrubber({
 *   fields: HEROKU_FIELDS,
 *   replacement: '[REDACTED]'
 * });
 *
 * const event = { user: { email: 'user@example.com' }, extra: { password: 'secret' } };
 * const scrubbed = scrubber(event);
 * // Result: { user: { email: '[REDACTED]' }, extra: { password: '[REDACTED]' } }
 * ```
 *
 * @param config - Scrubbing configuration (fields, paths, patterns, replacement)
 * @returns Function that scrubs Sentry events immutably
 */
export function createSentryEventScrubber(
  config: Pick<
    SentryBlanketConfig,
    'fields' | 'paths' | 'patterns' | 'replacement'
  >
): (event: SentryEvent) => SentryEvent {
  const scrubber = new Scrubber({
    fields: config.fields || [],
    paths: config.paths || [],
    patterns: config.patterns || [],
    replacement: config.replacement || '[SCRUBBED]',
    recursive: true,
  });

  return (event: SentryEvent): SentryEvent => {
    const { data } = scrubber.scrub(event);
    return data as SentryEvent;
  };
}
