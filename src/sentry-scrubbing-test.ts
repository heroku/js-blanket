/**
 * SENTRY SERVER-SIDE SCRUBBING TEST
 *
 * This script sends test events to Sentry with various PII fields to verify:
 * 1. What Sentry scrubs by default (server-side)
 * 2. What Sentry does NOT scrub (requiring client-side scrubbing)
 *
 * Run: pnpm tsx src/sentry-scrubbing-test.ts
 */

import * as Sentry from '@sentry/node';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SENTRY_DSN = process.env.SENTRY_DSN;

if (!SENTRY_DSN) {
  console.error('❌ SENTRY_DSN environment variable not set');
  console.error('   Please add SENTRY_DSN to your .env file');
  process.exit(1);
}

console.log('🚀 Starting Sentry Server-Side Scrubbing Test');
console.log('='.repeat(60));
console.log();

// Initialize Sentry WITHOUT client-side scrubbing
// We want to see what Sentry scrubs on their servers
Sentry.init({
  dsn: SENTRY_DSN,
  environment: 'test',
  // NO beforeSend hook - we want to see raw server-side scrubbing
});

async function sendTestEvents() {
  // ==========================================================================
  // TEST 1: Default Sentry Fields (should be scrubbed by Sentry)
  // ==========================================================================
  console.log('📋 TEST 1: Sending event with DEFAULT Sentry scrubbing fields');
  console.log('-'.repeat(60));

  Sentry.captureException(new Error('Test Error 1: Default Fields'), {
    extra: {
      test_name: 'default_fields',
      // Fields that Sentry SHOULD scrub by default
      password: 'my-secret-password-123',
      secret: 'my-secret-value-456',
      api_key: 'sk_live_abc123xyz',
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      auth: 'Bearer abc123',
      apikey: 'key_789',
      credentials: 'username:password',
    },
    tags: {
      test_category: 'default_fields',
    },
  });

  console.log(
    '✅ Sent: password, secret, api_key, access_token, auth, apikey, credentials'
  );
  console.log('   Expected: ALL should be scrubbed by Sentry server-side');
  console.log();

  // Wait a bit between events
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // ==========================================================================
  // TEST 2: Heroku-Specific Fields (likely NOT scrubbed by Sentry)
  // ==========================================================================
  console.log('📋 TEST 2: Sending event with HEROKU-SPECIFIC fields');
  console.log('-'.repeat(60));

  Sentry.captureException(new Error('Test Error 2: Heroku Fields'), {
    extra: {
      test_name: 'heroku_fields',
      // Fields that Sentry likely DOES NOT scrub by default
      heroku_oauth_token: 'heroku-token-abc123',
      sudo_oauth_token: 'sudo-token-xyz789',
      heroku_session_nonce: 'nonce-123456',
      heroku_user_session: 'session-abc-def-ghi',
      postgres_session_nonce: 'pg-nonce-789',
      super_user_session_secret: 'super-secret-456',
      user_session_secret: 'user-secret-123',
      logplexUrl: 'https://logplex.heroku.com/logs/abc123',
      authenticity_token: 'csrf-token-xyz',
    },
    tags: {
      test_category: 'heroku_fields',
    },
  });

  console.log(
    '✅ Sent: heroku_oauth_token, sudo_oauth_token, heroku_session_nonce, etc.'
  );
  console.log('   Expected: Likely NOT scrubbed by Sentry server-side');
  console.log();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // ==========================================================================
  // TEST 3: PII in Different Locations (breadcrumbs, user, request)
  // ==========================================================================
  console.log('📋 TEST 3: Sending event with PII in DIFFERENT LOCATIONS');
  console.log('-'.repeat(60));

  // Set user context with PII
  Sentry.setUser({
    id: 'user_123',
    email: 'john.doe@example.com',
    username: 'johndoe',
    ip_address: '192.168.1.100',
  });

  // Add breadcrumb with PII
  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'User logged in with email john.doe@example.com',
    level: 'info',
    data: {
      user_id: 'user_123',
      email: 'john.doe@example.com',
      session_token: 'session-abc-123',
    },
  });

  Sentry.captureException(new Error('Test Error 3: PII Locations'), {
    contexts: {
      user_data: {
        email: 'jane.smith@example.com',
        phone: '+1-555-123-4567',
        ssn: '123-45-6789',
        address: '123 Main St, San Francisco, CA 94102',
      },
    },
    extra: {
      test_name: 'pii_locations',
      request_data: {
        headers: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          Cookie: 'session=abc123; auth_token=xyz789',
          'X-API-Key': 'sk_live_secret_key_123',
        },
        body: {
          email: 'test@example.com',
          password: 'secret-password-123',
          credit_card: '4111-1111-1111-1111',
        },
      },
    },
    tags: {
      test_category: 'pii_locations',
    },
  });

  console.log('✅ Sent: PII in user context, breadcrumbs, contexts, extra');
  console.log(
    '   Expected: Some scrubbed (password, credit_card), some NOT (email, phone, ssn)'
  );
  console.log();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // ==========================================================================
  // TEST 4: Pattern-Based PII (emails, SSNs, IPs in strings)
  // ==========================================================================
  console.log('📋 TEST 4: Sending event with PATTERN-BASED PII');
  console.log('-'.repeat(60));

  Sentry.captureException(
    new Error(
      'Test Error 4: User email bob@example.com attempted action with SSN 123-45-6789'
    ),
    {
      extra: {
        test_name: 'pattern_pii',
        error_message:
          'Authentication failed for user alice@example.com from IP 192.168.1.50',
        log_entry:
          'User with SSN 987-65-4321 logged in from 10.0.0.100 using JWT token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        user_activity:
          'Card number 4111111111111111 was used by cardholder@example.com',
      },
      tags: {
        test_category: 'pattern_pii',
      },
    }
  );

  console.log(
    '✅ Sent: Emails, SSNs, IPs, JWT tokens, credit cards embedded in strings'
  );
  console.log('   Expected: Credit cards scrubbed, others likely NOT scrubbed');
  console.log();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // ==========================================================================
  // TEST 5: Nested PII (deep object structures)
  // ==========================================================================
  console.log('📋 TEST 5: Sending event with NESTED PII');
  console.log('-'.repeat(60));

  Sentry.captureException(new Error('Test Error 5: Nested PII'), {
    extra: {
      test_name: 'nested_pii',
      user: {
        profile: {
          personal: {
            email: 'nested@example.com',
            password: 'nested-password-123',
            credentials: {
              api_key: 'nested-api-key-abc',
              secret: 'nested-secret-xyz',
              heroku_oauth_token: 'nested-heroku-token-123',
            },
          },
        },
      },
      metadata: {
        level1: {
          level2: {
            level3: {
              password: 'deep-password',
              secret_token: 'deep-secret',
            },
          },
        },
      },
    },
    tags: {
      test_category: 'nested_pii',
    },
  });

  console.log(
    '✅ Sent: Deeply nested password, secret, api_key, heroku_oauth_token'
  );
  console.log(
    '   Expected: password/secret scrubbed, heroku_oauth_token likely NOT'
  );
  console.log();
}

// Run the tests
sendTestEvents()
  .then(() => {
    console.log('='.repeat(60));
    console.log('✅ All test events sent to Sentry!');
    console.log();
    console.log('📊 NEXT STEPS:');
    console.log('   1. Wait 1-2 minutes for events to appear in Sentry');
    console.log('   2. Open your Sentry dashboard');
    console.log('   3. Check each test event to see what was scrubbed');
    console.log('   4. Compare with expected results above');
    console.log();
    console.log('🔍 What to look for:');
    console.log(
      '   • Default fields (password, secret, api_key) should be [Filtered]'
    );
    console.log('   • Heroku fields likely visible (needs custom rules)');
    console.log('   • Emails, IPs, SSNs in strings likely visible');
    console.log('   • Credit card numbers should be scrubbed');
    console.log();
    console.log(
      '📝 Document your findings in SENTRY-PII-SCRUBBING-RESEARCH.md'
    );

    // Give Sentry time to flush
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  })
  .catch((error) => {
    console.error('❌ Error sending test events:', error);
    process.exit(1);
  });
