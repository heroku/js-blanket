/**
 * Sentry Exception Handler Adapter
 *
 * This is a thin adapter (~40 lines) that wraps the core Scrubber
 * to automatically scrub Sentry events before they're sent.
 *
 * Usage:
 *   import { initSentryWithBlanket } from '@heroku/js-blanket/sentry';
 *   import { HEROKU_FIELDS, PII_PATTERNS } from '@heroku/js-blanket';
 *
 *   initSentryWithBlanket({
 *     dsn: process.env.SENTRY_DSN,
 *     environment: 'production',
 *     fields: HEROKU_FIELDS,
 *     patterns: PII_PATTERNS,
 *   });
 */

import type { Scrubber } from '../../core/scrubber.js';

// Mock Sentry types for demonstration (in real implementation, these would come from @sentry/node)
export interface SentryEvent {
  message?: string;
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: unknown;
    }>;
  };
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    data?: unknown;
  };
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SentryOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  beforeSend?: (event: SentryEvent) => SentryEvent | null;
  [key: string]: unknown;
}

export interface SentryBlanketConfig extends SentryOptions {
  // Scrubbing configuration
  fields?: (string | RegExp)[];
  paths?: string[];
  patterns?: RegExp[];
  replacement?: string;

  // Behavior options
  preserveUserCallback?: boolean;
}

/**
 * Initialize Sentry with automatic PII scrubbing
 *
 * This function wraps Sentry.init() and automatically scrubs sensitive data
 * from all events before they're sent to Sentry.
 *
 * @param config - Combined Sentry options + scrubbing configuration
 * @returns void (initializes Sentry globally)
 */
export function initSentryWithBlanket(
  config: SentryBlanketConfig,
  ScrubberClass: typeof Scrubber
): void {
  const scrubber = new ScrubberClass({
    fields: config.fields || [],
    paths: config.paths || [],
    patterns: config.patterns || [],
    replacement: config.replacement || '[SCRUBBED]',
    recursive: true,
  });

  const userBeforeSend = config.beforeSend;

  // Wrap the user's beforeSend callback (if any) with our scrubbing logic
  const wrappedBeforeSend = (event: SentryEvent): SentryEvent | null => {
    // First, scrub the event
    const { data: scrubbedEvent } = scrubber.scrub(event);

    // Then, if the user provided their own beforeSend, call it
    if (userBeforeSend && config.preserveUserCallback !== false) {
      return userBeforeSend(scrubbedEvent as SentryEvent);
    }

    return scrubbedEvent as SentryEvent;
  };

  // In a real implementation, this would call Sentry.init()
  // For the spike, we'll just store the config
  const sentryConfig: SentryOptions = {
    ...config,
    beforeSend: wrappedBeforeSend,
  };

  // Mock Sentry.init for demonstration
  console.log('✅ Sentry initialized with blanket scrubbing');
  console.log('   DSN:', sentryConfig.dsn ? '[configured]' : '[not set]');
  console.log('   Environment:', sentryConfig.environment || 'development');
  console.log('   Scrubbing:', scrubber ? 'enabled' : 'disabled');
}

/**
 * Create a standalone Sentry event scrubber
 *
 * Useful for manually scrubbing Sentry events or testing.
 *
 * @param config - Scrubbing configuration
 * @returns Function that scrubs Sentry events
 */
export function createSentryEventScrubber(
  config: Pick<
    SentryBlanketConfig,
    'fields' | 'paths' | 'patterns' | 'replacement'
  >,
  ScrubberClass: typeof Scrubber
) {
  const scrubber = new ScrubberClass({
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
