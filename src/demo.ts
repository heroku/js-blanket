/**
 * SPIKE DEMONSTRATION
 *
 * This file demonstrates the key concepts from the JS Blanket discovery:
 * 1. Core Scrubber with field/path/pattern matching
 * 2. Circular reference handling
 * 3. Deep object traversal
 * 4. Generic logging adapter (replaces redaction.ts)
 * 5. Multiple scrubbing modes working together
 */

import {
  Scrubber,
  createRedactor,
  initSentryWithBlanket,
  createSentryEventScrubber,
  HEROKU_FIELDS,
  PII_PATTERNS,
} from './index.js';
import type { SentryEvent } from './index.js';

console.log('='.repeat(60));
console.log('NODE BLANKET - SPIKE DEMONSTRATION');
console.log('='.repeat(60));
console.log();

// ============================================================================
// DEMO 1: Field-Based Scrubbing (scrubs at ANY depth)
// ============================================================================
console.log('📋 DEMO 1: Field-Based Scrubbing');
console.log('-'.repeat(60));

const demo1 = new Scrubber({
  fields: ['password', 'api_key'],
});

const nestedData = {
  user: {
    profile: {
      settings: {
        auth: {
          password: 'super-secret-123',
          api_key: 'sk_live_abc123xyz',
        },
      },
    },
  },
};

const result1 = demo1.scrub(nestedData);
console.log('Input:', JSON.stringify(nestedData, null, 2));
console.log('\nOutput:', JSON.stringify(result1.data, null, 2));
console.log('\nScrubbed paths:', result1.scrubbedPaths);
console.log();

// ============================================================================
// DEMO 2: Path-Based Scrubbing (precise targeting)
// ============================================================================
console.log('📋 DEMO 2: Path-Based Scrubbing');
console.log('-'.repeat(60));

const demo2 = new Scrubber({
  paths: ['user.profile.email'], // Only scrub this specific path
});

const pathData = {
  user: {
    profile: { email: 'bob@example.com', name: 'Bob' },
    settings: { email: 'notifications@example.com' }, // NOT scrubbed
  },
};

const result2 = demo2.scrub(pathData);
console.log('Input:', JSON.stringify(pathData, null, 2));
console.log('\nOutput:', JSON.stringify(result2.data, null, 2));
console.log('\nNote: settings.email was NOT scrubbed (not in path list)');
console.log();

// ============================================================================
// DEMO 3: Pattern-Based Scrubbing (content matching)
// ============================================================================
console.log('📋 DEMO 3: Pattern-Based Scrubbing (SSN, Email)');
console.log('-'.repeat(60));

const demo3 = new Scrubber({
  patterns: [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  ],
});

const contentData = {
  message: 'User SSN is 123-45-6789',
  errorLog: 'Auth failed for user@example.com',
  safeData: 'This is fine',
};

const result3 = demo3.scrub(contentData);
console.log('Input:', JSON.stringify(contentData, null, 2));
console.log('\nOutput:', JSON.stringify(result3.data, null, 2));
console.log();

// ============================================================================
// DEMO 4: Circular Reference Handling
// ============================================================================
console.log('📋 DEMO 4: Circular Reference Handling');
console.log('-'.repeat(60));

const demo4 = new Scrubber({ fields: ['password'] });

const circularData: any = {
  name: 'test',
  password: 'secret',
  nested: { level: 1 },
};
circularData.self = circularData; // Create circular reference
circularData.nested.parent = circularData;

console.log('Input: Object with circular references (self, nested.parent)');
const result4 = demo4.scrub(circularData);
console.log('\nOutput:', JSON.stringify(result4.data, null, 2));
console.log('\nNote: Circular references handled gracefully!');
console.log();

// ============================================================================
// DEMO 5: Array Scrubbing
// ============================================================================
console.log('📋 DEMO 5: Array Scrubbing');
console.log('-'.repeat(60));

const demo5 = new Scrubber({ fields: ['password'] });

const arrayData = {
  users: [
    { name: 'bob', password: 'secret1' },
    { name: 'alice', password: 'secret2' },
    { name: 'charlie', password: 'secret3' },
  ],
};

const result5 = demo5.scrub(arrayData);
console.log('Input:', JSON.stringify(arrayData, null, 2));
console.log('\nOutput:', JSON.stringify(result5.data, null, 2));
console.log();

// ============================================================================
// DEMO 6: Combined Mode (Field + Path + Pattern)
// ============================================================================
console.log('📋 DEMO 6: Combined Mode (All scrubbing modes together)');
console.log('-'.repeat(60));

const demo6 = new Scrubber({
  fields: ['api_key'], // Scrub any field named api_key
  paths: ['user.email'], // Scrub specific path
  patterns: [/\b\d{3}-\d{2}-\d{4}\b/g], // Scrub SSN patterns
});

const combinedData = {
  user: {
    email: 'bob@example.com', // ← Path-based scrubbing
    api_key: 'secret-key-123', // ← Field-based scrubbing
  },
  log: 'SSN verification: 123-45-6789', // ← Pattern-based scrubbing
  nested: {
    service: {
      api_key: 'another-secret', // ← Field-based scrubbing (any depth)
    },
  },
};

const result6 = demo6.scrub(combinedData);
console.log('Input:', JSON.stringify(combinedData, null, 2));
console.log('\nOutput:', JSON.stringify(result6.data, null, 2));
console.log('\nScrubbed paths:', result6.scrubbedPaths);
console.log();

// ============================================================================
// DEMO 7: Generic Logging Helper (replaces redaction.ts)
// ============================================================================
console.log('📋 DEMO 7: Generic Logging Helper (for DefaultLogger)');
console.log('-'.repeat(60));

const redactor = createRedactor({
  fields: HEROKU_FIELDS, // All Heroku fields
  paths: ['request.headers.Authorization'], // Plus specific paths
  patterns: PII_PATTERNS, // Plus content patterns
});

const logData = {
  request: {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token123',
      'Content-Type': 'application/json',
    },
  },
  user: {
    id: 'user_123',
    password: 'secret', // Field-based (HEROKU_FIELDS)
    email: 'user@example.com', // Pattern-based (PII_PATTERNS)
  },
};

const result7 = redactor.scrub(logData);
console.log('Input:', JSON.stringify(logData, null, 2));
console.log('\nOutput:', JSON.stringify(result7.data, null, 2));
console.log();

// ============================================================================
// DEMO 8: Sentry Exception Handler Adapter (Thin Adapter Pattern)
// ============================================================================
console.log('📋 DEMO 8: Sentry Exception Handler Adapter');
console.log('-'.repeat(60));

// Initialize Sentry with automatic scrubbing
console.log('\n🔧 Initializing Sentry with blanket scrubbing:');
initSentryWithBlanket(
  {
    dsn: 'https://example@sentry.io/12345',
    environment: 'production',
    fields: HEROKU_FIELDS,
    patterns: PII_PATTERNS,
  },
  Scrubber
);
console.log();

// Simulate a Sentry error event
console.log('🚨 Simulating Sentry error event with PII:');
const sentryEvent: SentryEvent = {
  message: 'Authentication failed',
  exception: {
    values: [
      {
        type: 'AuthenticationError',
        value: 'Invalid credentials for user@example.com',
      },
    ],
  },
  request: {
    url: 'https://api.example.com/login',
    method: 'POST',
    headers: {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      'Content-Type': 'application/json',
      'X-API-Key': 'sk_live_abc123xyz',
    },
    data: {
      email: 'user@example.com',
      password: 'secret123',
    },
  },
  user: {
    id: 'user_123',
    email: 'user@example.com',
    username: 'johndoe',
  },
  extra: {
    sessionId: 'sess_xyz789',
    metadata: {
      api_key: 'internal-key-456',
      client_secret: 'secret-abc',
    },
  },
};

console.log('Input:', JSON.stringify(sentryEvent, null, 2));

// Use the event scrubber to demonstrate what would be sent to Sentry
const eventScrubber = createSentryEventScrubber(
  {
    fields: HEROKU_FIELDS,
    patterns: PII_PATTERNS,
  },
  Scrubber
);

const scrubbedEvent = eventScrubber(sentryEvent);
console.log(
  '\nOutput (sent to Sentry):',
  JSON.stringify(scrubbedEvent, null, 2)
);
console.log();
console.log('✅ Notice:');
console.log('   • Password: scrubbed');
console.log('   • API keys: scrubbed');
console.log('   • Email addresses: scrubbed (pattern match)');
console.log('   • JWT token: scrubbed (pattern match)');
console.log('   • Safe data preserved: user ID, method, URL structure');
console.log();
console.log('📦 Adapter size: ~40 lines (wraps core Scrubber)');
console.log('🎯 Pattern: Functional composition with beforeSend hook');
console.log();

// ============================================================================
// SUMMARY
// ============================================================================
console.log('='.repeat(60));
console.log('✅ SPIKE DEMONSTRATION COMPLETE');
console.log('='.repeat(60));
console.log();
console.log('Key Capabilities Demonstrated:');
console.log('  ✓ Field-based scrubbing (scrubs at ANY depth)');
console.log('  ✓ Path-based scrubbing (precise targeting)');
console.log('  ✓ Pattern-based scrubbing (content matching)');
console.log('  ✓ Circular reference handling (no crashes)');
console.log('  ✓ Array scrubbing (all items processed)');
console.log('  ✓ Combined mode (all modes work together)');
console.log('  ✓ Generic logging helper (replaces redaction.ts)');
console.log('  ✓ Sentry exception handler (thin adapter pattern)');
console.log();
console.log('Architecture:');
console.log('  • Core Scrubber (~200 lines) - generic, reusable');
console.log('  • Thin adapters (10-40 lines each) - provider-specific');
console.log('  • Immutable operations (creates new objects)');
console.log('  • Type-safe with TypeScript generics');
console.log();
