/**
 * Sentry Adapter Tests
 *
 * Comprehensive test suite for Sentry exception handler integration.
 * Tests cover:
 * - Real SDK integration with beforeSend/beforeSendTransaction hooks
 * - Event scrubbing (fields, paths, patterns)
 * - Transaction scrubbing for performance monitoring
 * - Breadcrumb scrubbing
 * - User callback preservation
 * - Edge cases and error handling
 */

import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  initSentryWithBlanket,
  createSentryEventScrubber,
  type SentryEvent,
  type SentryBlanketConfig,
  type SentryOptions,
} from './sentry.js';
import { HEROKU_FIELDS, GDPR_FIELDS, PCI_FIELDS } from '../../core/presets.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock Sentry module for testing
 *
 * Captures all calls to init() for verification in tests
 */
function createMockSentry() {
  const calls: SentryOptions[] = [];
  return {
    init: (config: SentryOptions) => {
      calls.push(config);
    },
    getCalls: () => calls,
    getLastCall: () => calls[calls.length - 1],
  };
}

function createMockSentryEvent(): SentryEvent {
  return {
    event_id: 'test-event-id',
    timestamp: Date.now(),
    level: 'error',
    message: 'Test error message with user@example.com',
    exception: {
      values: [
        {
          type: 'Error',
          value: 'API failed with token abc123',
          stacktrace: { frames: [] },
        },
      ],
    },
    request: {
      url: 'https://api.example.com/users',
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token-123',
        'x-api-key': 'api-key-secret',
      },
      data: {
        username: 'john',
        password: 'hunter2',
        email: 'john@example.com',
      },
    },
    user: {
      id: 'user-123',
      email: 'user@example.com',
      username: 'testuser',
    },
    extra: {
      metadata: {
        apiToken: 'token-abc-123',
        sessionId: 'session-xyz',
      },
    },
    contexts: {
      app: {
        app_name: 'test-app',
      },
    },
    breadcrumbs: [
      {
        timestamp: Date.now(),
        category: 'console',
        message: 'Processing user bob@example.com with token xyz789',
        level: 'info',
      },
      {
        timestamp: Date.now(),
        category: 'http',
        message: 'POST /api/auth',
        data: {
          url: '/api/auth',
          method: 'POST',
          status_code: 200,
          request_headers: {
            authorization: 'Bearer another-secret',
          },
        },
      },
    ],
  };
}

function createMockTransactionEvent(): SentryEvent {
  return {
    event_id: 'transaction-id',
    type: 'transaction',
    timestamp: Date.now(),
    start_timestamp: Date.now() - 1000,
    contexts: {
      trace: {
        trace_id: 'trace-123',
        span_id: 'span-456',
      },
    },
    transaction: '/api/users/:id',
    spans: [
      {
        span_id: 'span-789',
        trace_id: 'trace-123',
        data: {
          password: 'secret123',
          apiKey: 'key-abc',
        },
      },
    ],
  };
}

// ============================================================================
// 1. createSentryEventScrubber Tests
// ============================================================================

describe('createSentryEventScrubber', () => {
  it('should scrub sensitive fields from event', () => {
    const scrubber = createSentryEventScrubber({
      fields: ['password', 'apiToken'],
      replacement: '[SCRUBBED]',
    });

    const event = createMockSentryEvent();
    const scrubbed = scrubber(event);

    // Check scrubbing worked
    assert.equal(
      (scrubbed.request?.data as Record<string, unknown>)?.password,
      '[SCRUBBED]'
    );
    assert.equal(
      (scrubbed.extra?.metadata as Record<string, unknown>)?.apiToken,
      '[SCRUBBED]'
    );

    // Check immutability - original unchanged
    assert.equal(
      (event.request?.data as Record<string, unknown>)?.password,
      'hunter2'
    );
    assert.equal(
      (event.extra?.metadata as Record<string, unknown>)?.apiToken,
      'token-abc-123'
    );
  });

  it('should scrub sensitive paths from event', () => {
    const scrubber = createSentryEventScrubber({
      paths: ['request.headers.authorization', 'user.email'],
      replacement: '[REDACTED]',
    });

    const event = createMockSentryEvent();
    const scrubbed = scrubber(event);

    assert.equal(scrubbed.request?.headers?.authorization, '[REDACTED]');
    assert.equal(scrubbed.user?.email, '[REDACTED]');

    // Unrelated fields preserved
    assert.equal(scrubbed.request?.method, 'POST');
    assert.equal(scrubbed.user?.username, 'testuser');
  });

  it('should scrub patterns from string content', () => {
    const scrubber = createSentryEventScrubber({
      patterns: [
        /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, // Email pattern
        /\b[a-f0-9]{32}\b/g, // MD5 hash pattern
      ],
      replacement: '[EMAIL]',
    });

    const event = createMockSentryEvent();
    const scrubbed = scrubber(event);

    // Email in message scrubbed
    assert.equal(scrubbed.message, 'Test error message with [EMAIL]');

    // Email in exception value scrubbed (if it had one)
    assert.ok(scrubbed.exception?.values?.[0]?.value);
    assert.ok(!scrubbed.exception?.values?.[0]?.value?.includes('@'));
  });

  it('should handle all scrubbing modes together', () => {
    const scrubber = createSentryEventScrubber({
      fields: ['password', 'apiToken'],
      paths: ['request.headers.authorization'],
      patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g],
      replacement: '[SCRUBBED]',
    });

    const event = createMockSentryEvent();
    const scrubbed = scrubber(event);

    // Field-based
    assert.equal(
      (scrubbed.request?.data as Record<string, unknown>)?.password,
      '[SCRUBBED]'
    );
    assert.equal(
      (scrubbed.extra?.metadata as Record<string, unknown>)?.apiToken,
      '[SCRUBBED]'
    );

    // Path-based
    assert.equal(scrubbed.request?.headers?.authorization, '[SCRUBBED]');

    // Pattern-based
    assert.ok(!scrubbed.message?.includes('@example.com'));
  });

  it('should handle preset field lists', () => {
    const scrubber = createSentryEventScrubber({
      fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
      replacement: '[PRESET-SCRUBBED]',
    });

    const event = createMockSentryEvent();
    const scrubbed = scrubber(event);

    // Heroku fields
    assert.equal(
      (scrubbed.extra?.metadata as Record<string, unknown>)?.apiToken,
      '[PRESET-SCRUBBED]'
    );

    // GDPR fields
    assert.equal(scrubbed.user?.email, '[PRESET-SCRUBBED]');

    // PCI fields (password is in PCI_FIELDS)
    assert.equal(
      (scrubbed.request?.data as Record<string, unknown>)?.password,
      '[PRESET-SCRUBBED]'
    );
  });

  it('should handle events with no sensitive data', () => {
    const scrubber = createSentryEventScrubber({
      fields: ['password'],
      replacement: '[SCRUBBED]',
    });

    const event: SentryEvent = {
      message: 'Simple error',
      level: 'error',
    };

    const scrubbed = scrubber(event);

    assert.equal(scrubbed.message, 'Simple error');
    assert.equal(scrubbed.level, 'error');
  });

  it('should handle circular references in events', () => {
    const scrubber = createSentryEventScrubber({
      fields: ['password'],
      replacement: '[SCRUBBED]',
    });

    const event: SentryEvent = {
      message: 'Error with circular ref',
      extra: {
        password: 'secret',
      },
    };

    // Create circular reference
    (event.extra as Record<string, unknown>).self = event.extra;

    const scrubbed = scrubber(event);

    assert.equal(scrubbed.extra?.password, '[SCRUBBED]');
    // Should not crash on circular reference
  });
});

// ============================================================================
// 2. initSentryWithBlanket - Configuration Tests
// ============================================================================

describe('initSentryWithBlanket - Configuration', () => {
  it('should create scrubber with provided configuration', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      environment: 'test',
      fields: ['password', 'apiToken'],
      paths: ['user.email'],
      patterns: [/\bSSN:\s*\d{3}-\d{2}-\d{4}\b/g],
      replacement: '[CUSTOM]',
    };

    // Should not throw and should call Sentry.init()
    assert.doesNotThrow(() => {
      initSentryWithBlanket(mockSentry, config);
    });

    // Verify Sentry.init() was called
    const calls = mockSentry.getCalls();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.dsn, 'https://test@sentry.io/123');
    assert.equal(calls[0]?.environment, 'test');
  });

  it('should use default values for missing scrubbing config', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
    };

    // Should not throw and use defaults
    assert.doesNotThrow(() => {
      initSentryWithBlanket(mockSentry, config);
    });

    // Verify Sentry.init() was called
    const calls = mockSentry.getCalls();
    assert.equal(calls.length, 1);
  });

  it('should accept empty scrubbing configuration', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: [],
      paths: [],
      patterns: [],
    };

    assert.doesNotThrow(() => {
      initSentryWithBlanket(mockSentry, config);
    });

    // Verify Sentry.init() was called
    const calls = mockSentry.getCalls();
    assert.equal(calls.length, 1);
  });
});

// ============================================================================
// 3. Callback Preservation Tests
// ============================================================================

describe('initSentryWithBlanket - Callback Preservation', () => {
  it('should preserve user beforeSend callback', () => {
    let userCallbackCalled = false;
    let eventReceivedInCallback: SentryEvent | null = null;

    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['password'],
      beforeSend: (event: SentryEvent) => {
        userCallbackCalled = true;
        eventReceivedInCallback = event;

        // User adds custom tag
        event.tags = { ...event.tags, custom: 'user-tag' };
        return event;
      },
    };

    initSentryWithBlanket(mockSentry, config);

    // Get the wrapped config that was passed to Sentry.init()
    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    // Mock event processing
    const mockEvent = createMockSentryEvent();

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);

      assert.ok(userCallbackCalled, 'User callback should be called');
      assert.ok(eventReceivedInCallback, 'Event should be passed to callback');

      // Password should be scrubbed before user callback
      const receivedEvent = eventReceivedInCallback as SentryEvent;
      assert.equal(
        (receivedEvent.request?.data as Record<string, unknown>)?.password,
        '[SCRUBBED]'
      );

      // User's custom tag should be present
      assert.equal(result?.tags?.custom, 'user-tag');
    }
  });

  it('should preserve user beforeSendTransaction callback', () => {
    let userCallbackCalled = false;

    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['password', 'apiKey'],
      beforeSendTransaction: (event: SentryEvent) => {
        userCallbackCalled = true;
        return event;
      },
    };

    initSentryWithBlanket(mockSentry, config);

    // Get the wrapped config that was passed to Sentry.init()
    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSendTransaction;

    const mockTransaction = createMockTransactionEvent();

    if (wrappedCallback) {
      wrappedCallback(mockTransaction);
      assert.ok(
        userCallbackCalled,
        'User transaction callback should be called'
      );
    }
  });

  it('should disable user callback when preserveUserCallback is false', () => {
    let userCallbackCalled = false;

    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['password'],
      preserveUserCallback: false,
      beforeSend: (event: SentryEvent) => {
        userCallbackCalled = true;
        return event;
      },
    };

    initSentryWithBlanket(mockSentry, config);

    // Get the wrapped config that was passed to Sentry.init()
    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    const mockEvent = createMockSentryEvent();

    if (wrappedCallback) {
      wrappedCallback(mockEvent);
      assert.ok(!userCallbackCalled, 'User callback should NOT be called');
    }
  });

  it('should allow user callback to filter events by returning null', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['password'],
      beforeSend: (event: SentryEvent) => {
        // User filters out test errors (case-insensitive)
        if (event.message?.toLowerCase().includes('test')) {
          return null;
        }
        return event;
      },
    };

    initSentryWithBlanket(mockSentry, config);

    // Get the wrapped config that was passed to Sentry.init()
    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    const mockEvent = createMockSentryEvent(); // Contains "Test" in message

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);
      assert.equal(result, null, 'Event should be filtered');
    }
  });
});

// ============================================================================
// 4. Event Scrubbing Tests
// ============================================================================

describe('initSentryWithBlanket - Event Scrubbing', () => {
  it('should scrub sensitive fields from error events', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['password', 'apiToken', 'authorization'],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent = createMockSentryEvent();
    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);

      assert.equal(
        (result?.request?.data as Record<string, unknown>)?.password,
        '[SCRUBBED]'
      );
      assert.equal(
        (result?.extra?.metadata as Record<string, unknown>)?.apiToken,
        '[SCRUBBED]'
      );
      assert.equal(result?.request?.headers?.authorization, '[SCRUBBED]');

      // Non-sensitive fields preserved
      assert.equal(result?.request?.method, 'POST');
      assert.equal(result?.user?.username, 'testuser');
    }
  });

  it('should scrub breadcrumbs', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['authorization'],
      patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent = createMockSentryEvent();
    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);

      // Breadcrumb message with email should be scrubbed
      const breadcrumb1 = result?.breadcrumbs?.[0];
      assert.ok(breadcrumb1?.message);
      assert.ok(!breadcrumb1.message.includes('bob@example.com'));

      // Breadcrumb data with authorization header should be scrubbed
      const breadcrumb2 = result?.breadcrumbs?.[1];
      assert.equal(
        (breadcrumb2?.data?.request_headers as Record<string, unknown>)
          ?.authorization,
        '[SCRUBBED]'
      );
    }
  });

  it('should scrub exception messages with patterns', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      patterns: [/\btoken\s+\w+/gi],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent = createMockSentryEvent();
    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);

      const exceptionValue = result?.exception?.values?.[0]?.value;
      assert.ok(exceptionValue);
      assert.ok(!exceptionValue.includes('token abc123'));
    }
  });

  it('should handle deeply nested event structures', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['secret'],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent: SentryEvent = {
      message: 'Deep nesting test',
      extra: {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  secret: 'deeply-nested-secret',
                },
              },
            },
          },
        },
      },
    };

    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);

      const level1 = (result?.extra as Record<string, unknown>)
        ?.level1 as Record<string, unknown>;
      const level2 = level1?.level2 as Record<string, unknown>;
      const level3 = level2?.level3 as Record<string, unknown>;
      const level4 = level3?.level4 as Record<string, unknown>;
      const level5 = level4?.level5 as Record<string, unknown>;

      assert.equal(level5?.secret, '[SCRUBBED]');
    }
  });
});

// ============================================================================
// 5. Transaction Scrubbing Tests
// ============================================================================

describe('initSentryWithBlanket - Transaction Scrubbing', () => {
  it('should scrub sensitive fields from transaction events', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['password', 'apiKey'],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockTransaction = createMockTransactionEvent();
    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSendTransaction;

    if (wrappedCallback) {
      const result = wrappedCallback(mockTransaction);

      // Span data should be scrubbed
      const span = result?.spans?.[0];
      assert.equal(
        (span?.data as Record<string, unknown>)?.password,
        '[SCRUBBED]'
      );
      assert.equal(
        (span?.data as Record<string, unknown>)?.apiKey,
        '[SCRUBBED]'
      );

      // Transaction info preserved
      assert.equal(result?.transaction, '/api/users/:id');
      assert.equal(result?.type, 'transaction');
    }
  });

  it('should preserve trace information in transactions', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['password'],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockTransaction = createMockTransactionEvent();
    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSendTransaction;

    if (wrappedCallback) {
      const result = wrappedCallback(mockTransaction);

      // Trace context should be preserved
      const trace = result?.contexts?.trace as Record<string, unknown>;
      assert.equal(trace?.trace_id, 'trace-123');
      assert.equal(trace?.span_id, 'span-456');
    }
  });
});

// ============================================================================
// 6. Edge Cases and Error Handling
// ============================================================================

describe('initSentryWithBlanket - Edge Cases', () => {
  it('should handle null/undefined event properties', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['password'],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent: SentryEvent = {
      level: 'error',
    };

    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      assert.doesNotThrow(() => {
        wrappedCallback(mockEvent);
      });
    }
  });

  it('should handle events with no scrubbing needed', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['nonexistent_field'],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent: SentryEvent = {
      message: 'Simple message',
      level: 'info',
    };

    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);

      assert.equal(result?.message, 'Simple message');
      assert.equal(result?.level, 'info');
    }
  });

  it('should handle events with arrays of objects', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: ['password'],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent: SentryEvent = {
      message: 'Array test',
      extra: {
        users: [
          { name: 'Alice', password: 'secret1' },
          { name: 'Bob', password: 'secret2' },
        ],
      },
    };

    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);

      const users = (result?.extra as Record<string, unknown>)?.users as Array<
        Record<string, unknown>
      >;
      assert.equal(users?.[0]?.password, '[SCRUBBED]');
      assert.equal(users?.[1]?.password, '[SCRUBBED]');
      assert.equal(users?.[0]?.name, 'Alice');
      assert.equal(users?.[1]?.name, 'Bob');
    }
  });

  it('should handle regex field patterns', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: [/api[-_]?key/i, /oauth[-_]?token/i],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent: SentryEvent = {
      message: 'Regex field test',
      extra: {
        apiKey: 'key1',
        api_key: 'key2',
        'api-key': 'key3',
        oauth_token: 'token1',
        oauthToken: 'token2',
      },
    };

    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);

      const extra = result?.extra as Record<string, unknown>;
      assert.equal(extra?.apiKey, '[SCRUBBED]');
      assert.equal(extra?.api_key, '[SCRUBBED]');
      assert.equal(extra?.['api-key'], '[SCRUBBED]');
      assert.equal(extra?.oauth_token, '[SCRUBBED]');
      assert.equal(extra?.oauthToken, '[SCRUBBED]');
    }
  });
});

// ============================================================================
// 7. Integration with Preset Field Lists
// ============================================================================

describe('initSentryWithBlanket - Preset Integration', () => {
  it('should work with HEROKU_FIELDS preset', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: HEROKU_FIELDS,
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent: SentryEvent = {
      message: 'Heroku fields test',
      extra: {
        heroku_oauth_token: 'token-123',
        sudo_oauth_token: 'sudo-456',
      },
    };

    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);

      const extra = result?.extra as Record<string, unknown>;
      assert.equal(extra?.heroku_oauth_token, '[SCRUBBED]');
      assert.equal(extra?.sudo_oauth_token, '[SCRUBBED]');
    }
  });

  it('should work with combined presets', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent: SentryEvent = {
      message: 'Combined presets test',
      user: {
        email: 'user@example.com',
        ip_address: '192.168.1.1',
      },
      extra: {
        password: 'secret',
        credit_card: '4111111111111111',
      },
    };

    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      const result = wrappedCallback(mockEvent);

      assert.equal(result?.user?.email, '[SCRUBBED]');
      assert.equal(result?.user?.ip_address, '[SCRUBBED]');

      const extra = result?.extra as Record<string, unknown>;
      assert.equal(extra?.password, '[SCRUBBED]');
      assert.equal(extra?.credit_card, '[SCRUBBED]');
    }
  });
});

// ============================================================================
// 8. Performance Characteristics
// ============================================================================

describe('initSentryWithBlanket - Performance', () => {
  it('should scrub events within exception handling latency target (<10ms p95)', () => {
    const mockSentry = createMockSentry();
    const config: SentryBlanketConfig = {
      dsn: 'https://test@sentry.io/123',
      fields: [...HEROKU_FIELDS, ...GDPR_FIELDS],
      patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g],
    };

    initSentryWithBlanket(mockSentry, config);

    const mockEvent = createMockSentryEvent();
    const wrappedConfig = mockSentry.getLastCall();
    const wrappedCallback = wrappedConfig?.beforeSend;

    if (wrappedCallback) {
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        wrappedCallback({ ...mockEvent });
        const end = performance.now();
        times.push(end - start);
      }

      // Calculate p95
      times.sort((a, b) => a - b);
      const p95Index = Math.floor(iterations * 0.95) ?? 0;
      const p95Time = times[p95Index] ?? 0;

      console.log(
        `Sentry event scrubbing p95: ${p95Time.toFixed(3)}ms (target: <10ms)`
      );

      assert.ok(
        p95Time < 10,
        `p95 latency ${p95Time.toFixed(3)}ms exceeds 10ms target`
      );
    }
  });
});
