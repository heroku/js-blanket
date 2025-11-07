# Sentry Adapter - Integration Examples

This guide provides comprehensive examples for integrating `@heroku/js-blanket`
with Sentry in both Node.js and browser environments.

## Table of Contents

1. [Node.js Integration](#nodejs-integration)
2. [Browser Integration](#browser-integration)
3. [Advanced Configuration](#advanced-configuration)
4. [Preset Field Lists](#preset-field-lists)
5. [Pattern-Based Scrubbing](#pattern-based-scrubbing)
6. [Custom Callbacks](#custom-callbacks)
7. [Migration from Rollbar](#migration-from-rollbar)
8. [Performance Considerations](#performance-considerations)

---

## Node.js Integration

### Basic Setup

```typescript
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket } from '@heroku/js-blanket';
import { HEROKU_FIELDS } from '@heroku/js-blanket';

// One-step initialization with automatic PII scrubbing
initSentryWithBlanket(Sentry, {
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,

  // Scrubbing configuration
  fields: HEROKU_FIELDS,
  replacement: '[SCRUBBED]',
});

// Now all errors will be scrubbed automatically
Sentry.captureException(new Error('User password: secret123')); // PII scrubbed
```

### Express.js Integration

```typescript
import express from 'express';
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket, HEROKU_FIELDS } from '@heroku/js-blanket';

const app = express();

// One-step initialization with automatic PII scrubbing
initSentryWithBlanket(Sentry, {
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
  ],
  tracesSampleRate: 0.1,
  fields: [...HEROKU_FIELDS, 'sessionToken', 'csrf_token'],
});

// Sentry request handler must be first
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Your routes
app.post('/api/login', (req, res) => {
  // Errors here will have PII scrubbed
  throw new Error('Login failed for user@example.com'); // Email scrubbed
});

// Sentry error handler must be last
app.use(Sentry.Handlers.errorHandler());

app.listen(3000);
```

### Node.js with Performance Monitoring

```typescript
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket, HEROKU_FIELDS } from '@heroku/js-blanket';

// One-step initialization with performance monitoring and scrubbing
initSentryWithBlanket(Sentry, {
  dsn: process.env.SENTRY_DSN,
  environment: 'production',

  // Performance monitoring
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,

  // Scrubbing for both errors and transactions
  fields: HEROKU_FIELDS,
  paths: ['user.email', 'request.headers.authorization'],
  patterns: [
    /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, // Email
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  ],
});

// Transaction span data will be scrubbed
const transaction = Sentry.startTransaction({
  name: 'User API Request',
  op: 'http.server',
});

const span = transaction.startChild({
  op: 'db.query',
  description: 'SELECT * FROM users',
  data: {
    query: 'SELECT * FROM users WHERE email = ?',
    password: 'secret123', // Will be scrubbed
  },
});

span.finish();
transaction.finish();
```

---

## Browser Integration

### Basic Browser Setup

```typescript
import * as Sentry from '@sentry/browser';
import { initSentryWithBlanket, HEROKU_FIELDS } from '@heroku/js-blanket';

// Configure Sentry with automatic PII scrubbing
const config = {
  dsn: 'https://your-public-key@sentry.io/your-project',
  environment: import.meta.env.MODE || 'development',

  // Scrubbing configuration
  fields: [...HEROKU_FIELDS, 'auth_token', 'session_id'],
  replacement: '[REDACTED]',

  // Browser-specific options
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
};

initSentryWithBlanket(Sentry, config);

// Errors thrown in browser will be scrubbed
throw new Error('API token: abc123'); // Token scrubbed
```

### React Integration

```typescript
import React from 'react';
import * as Sentry from '@sentry/react';
import {
  initSentryWithBlanket,
  Scrubber,
  HEROKU_FIELDS,
  GDPR_FIELDS,
} from '@heroku/js-blanket';

// Configure Sentry with scrubbing
const config = {
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect: React.useEffect,
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Scrub GDPR and Heroku-specific fields
  fields: [...HEROKU_FIELDS, ...GDPR_FIELDS],
  paths: ['user.email', 'state.auth.token'],
};

initSentryWithBlanket(Sentry, config);

// Use Sentry error boundary in your app
export const App = () => (
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <YourApp />
  </Sentry.ErrorBoundary>
);
```

### Vue.js Integration

```typescript
import { createApp } from 'vue';
import * as Sentry from '@sentry/vue';
import { initSentryWithBlanket, HEROKU_FIELDS } from '@heroku/js-blanket';
import App from './App.vue';

const app = createApp(App);

// Configure Sentry with scrubbing
const config = {
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],

  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,

  // Scrubbing
  fields: HEROKU_FIELDS,
  paths: ['user.password', 'auth.apiKey'],

  // Vue-specific options
  app,
  trackComponents: true,
  hooks: ['activate', 'mount', 'update'],
};

initSentryWithBlanket(Sentry, config);

app.mount('#app');
```

### Browser with Breadcrumb Scrubbing

```typescript
import * as Sentry from '@sentry/browser';
import { initSentryWithBlanket } from '@heroku/js-blanket';

const config = {
  dsn: 'https://your-key@sentry.io/project',
  environment: 'production',

  // Scrub console logs and HTTP requests in breadcrumbs
  fields: ['password', 'apiKey', 'token'],
  patterns: [
    /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, // Email
    /Bearer\s+[\w-]+/gi, // Bearer tokens
  ],

  // Breadcrumb options
  maxBreadcrumbs: 50,

  // Enable console breadcrumbs (will be scrubbed)
  integrations: [
    Sentry.breadcrumbsIntegration({
      console: true,
      dom: true,
      fetch: true,
      history: true,
      xhr: true,
    }),
  ],
};

initSentryWithBlanket(Sentry, config);

// These console logs will be captured as breadcrumbs and scrubbed
console.log('User logged in: user@example.com'); // Email scrubbed
console.log('API token: abc123'); // Token scrubbed
```

---

## Advanced Configuration

### Field, Path, and Pattern Scrubbing

```typescript
import * as Sentry from '@sentry/node';
import {
  initSentryWithBlanket,
  Scrubber,
  HEROKU_FIELDS,
  GDPR_FIELDS,
  PCI_FIELDS,
} from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,
  environment: 'production',

  // Field-based scrubbing (exact match or regex)
  fields: [
    ...HEROKU_FIELDS,
    ...GDPR_FIELDS,
    ...PCI_FIELDS,
    'customSecret',
    /api[-_]?key/i, // Matches: apiKey, api_key, api-key
  ],

  // Path-based scrubbing (dot notation)
  paths: [
    'user.email',
    'user.profile.ssn',
    'request.headers.authorization',
    'request.headers.x-api-key',
    'extra.metadata.credentials',
  ],

  // Pattern-based scrubbing (content)
  patterns: [
    /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, // Email
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, // Credit card
    /Bearer\s+[\w-]+/gi, // Bearer tokens
    /sk_live_[\w-]+/gi, // Stripe live keys
  ],

  replacement: '[REDACTED]',
};

initSentryWithBlanket(Sentry, config);
```

### Regex Field Patterns

```typescript
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket } from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,

  // Use regex to match field name variations
  fields: [
    /password/i, // Matches: password, Password, PASSWORD
    /api[-_]?key/i, // Matches: apiKey, api_key, api-key, API-KEY
    /oauth[-_]?token/i, // Matches: oauthToken, oauth_token, OAuth-Token
    /secret/i, // Matches: secret, Secret, clientSecret
    /auth(orization)?/i, // Matches: auth, authorization, Authorization
  ],
};

initSentryWithBlanket(Sentry, config);
```

---

## Preset Field Lists

### Using HEROKU_FIELDS

```typescript
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket, HEROKU_FIELDS } from '@heroku/js-blanket';

// HEROKU_FIELDS includes: heroku_oauth_token, sudo_oauth_token, www-sso-session, etc.
const config = {
  dsn: process.env.SENTRY_DSN,
  fields: HEROKU_FIELDS,
};

initSentryWithBlanket(Sentry, config);
```

### Using GDPR_FIELDS

```typescript
import * as Sentry from '@sentry/node';
import {
  initSentryWithBlanket,
  Scrubber,
  GDPR_FIELDS,
} from '@heroku/js-blanket';

// GDPR_FIELDS includes: email, ip_address, phone_number, ssn, etc.
const config = {
  dsn: process.env.SENTRY_DSN,
  fields: GDPR_FIELDS,
};

initSentryWithBlanket(Sentry, config);
```

### Using PCI_FIELDS

```typescript
import * as Sentry from '@sentry/node';
import {
  initSentryWithBlanket,
  Scrubber,
  PCI_FIELDS,
} from '@heroku/js-blanket';

// PCI_FIELDS includes: credit_card, cvv, card_number, expiration_date, etc.
const config = {
  dsn: process.env.SENTRY_DSN,
  fields: PCI_FIELDS,
};

initSentryWithBlanket(Sentry, config);
```

### Combining Presets

```typescript
import * as Sentry from '@sentry/node';
import {
  initSentryWithBlanket,
  Scrubber,
  HEROKU_FIELDS,
  GDPR_FIELDS,
  PCI_FIELDS,
} from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,

  // Combine multiple presets + custom fields
  fields: [
    ...HEROKU_FIELDS,
    ...GDPR_FIELDS,
    ...PCI_FIELDS,
    'customToken',
    'internalSecret',
  ],
};

initSentryWithBlanket(Sentry, config);
```

---

## Pattern-Based Scrubbing

### Common PII Patterns

```typescript
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket } from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,

  patterns: [
    // Email addresses
    /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g,

    // US Social Security Numbers
    /\b\d{3}-\d{2}-\d{4}\b/g,

    // Credit card numbers (with or without separators)
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

    // Phone numbers (US format)
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,

    // IP addresses
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

    // Bearer tokens
    /Bearer\s+[\w-]+/gi,

    // API keys (common formats)
    /[a-zA-Z0-9]{32,}/g,

    // AWS keys
    /AKIA[0-9A-Z]{16}/g,

    // Stripe keys
    /sk_live_[\w-]+/gi,
  ],

  replacement: '[PII_REDACTED]',
};

initSentryWithBlanket(Sentry, config);
```

---

## Custom Callbacks

### Preserving User beforeSend Callback

```typescript
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket } from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,

  fields: ['password', 'apiToken'],

  // Your custom logic runs AFTER scrubbing
  beforeSend: (event, hint) => {
    // Add custom tags
    event.tags = {
      ...event.tags,
      custom_tag: 'value',
    };

    // Filter test errors
    if (event.environment === 'test') {
      return null; // Drop event
    }

    // Modify event
    event.level = 'warning';

    return event;
  },
};

initSentryWithBlanket(Sentry, config);
```

### Disabling User Callback Preservation

```typescript
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket } from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,
  fields: ['password'],

  // User callback will NOT be called
  preserveUserCallback: false,

  beforeSend: (event) => {
    // This will be replaced by scrubbing logic
    console.log('This will NOT run');
    return event;
  },
};

initSentryWithBlanket(Sentry, config);
```

### Transaction Callback

```typescript
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket } from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,
  fields: ['password', 'apiKey'],

  // Custom transaction processing (runs AFTER scrubbing)
  beforeSendTransaction: (transaction, hint) => {
    // Sample slow transactions
    if (transaction.start_timestamp && transaction.timestamp) {
      const duration = transaction.timestamp - transaction.start_timestamp;
      if (duration < 1.0) {
        return null; // Drop fast transactions
      }
    }

    return transaction;
  },
};

initSentryWithBlanket(Sentry, config);
```

---

## Migration from Rollbar

### Before (Rollbar)

```typescript
import Rollbar from 'rollbar';

const rollbar = new Rollbar({
  accessToken: process.env.ROLLBAR_TOKEN,
  environment: 'production',

  scrubFields: [
    'password',
    'api_token',
    'heroku_oauth_token',
    'sudo_oauth_token',
  ],

  transform: (payload) => {
    // Custom transformation
    if (payload.body?.telemetry) {
      // Scrub telemetry
    }
    return payload;
  },
});

rollbar.error('Error occurred', { user: { email: 'user@example.com' } });
```

### After (Sentry with js-blanket)

```typescript
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket, HEROKU_FIELDS } from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,
  environment: 'production',

  // More powerful scrubbing than Rollbar
  fields: [
    ...HEROKU_FIELDS, // Includes all Rollbar fields + more
    'api_token',
  ],

  // Path-based scrubbing (Rollbar doesn't have this)
  paths: ['user.email', 'body.telemetry.credentials'],

  // Pattern-based scrubbing (Rollbar doesn't have this)
  patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g],

  // Custom logic (like Rollbar transform)
  beforeSend: (event, hint) => {
    // Your custom transformation
    return event;
  },
};

initSentryWithBlanket(Sentry, config);

Sentry.captureException(new Error('Error occurred'), {
  extra: { user: { email: 'user@example.com' } }, // Email scrubbed
});
```

---

## Performance Considerations

### Benchmark Results

The Sentry adapter meets the performance targets outlined in the discovery
document:

- **Error events**: <10ms p95 latency (validated in tests)
- **Transaction events**: <10ms p95 latency
- **Throughput**: 54k+ events/sec on standard hardware

### Performance Tips

1. **Reuse scrubber instances**: The scrubber is created once at initialization

2. **Use specific field names**: More specific field names are faster than broad
   regex patterns

```typescript
// Faster
fields: ['password', 'apiToken', 'oauth_token'];

// Slower
fields: [/.*password.*/i, /.*token.*/i];
```

3. **Limit pattern complexity**: Simple patterns are faster than complex ones

```typescript
// Faster
patterns: [/\b\d{3}-\d{2}-\d{4}\b/g];

// Slower (backtracking)
patterns: [/\b(\d{3}[-\s]?)?(\d{2}[-\s]?)?(\d{4})\b/g];
```

4. **Sample high-volume apps**: Use Sentry's sampling for high-volume
   applications

```typescript
const config = {
  dsn: process.env.SENTRY_DSN,
  sampleRate: 0.1, // Sample 10% of errors
  tracesSampleRate: 0.01, // Sample 1% of transactions
  fields: HEROKU_FIELDS,
};
```

---

## Best Practices

1. **Start with presets**: Use `HEROKU_FIELDS`, `GDPR_FIELDS`, `PCI_FIELDS` as a
   base

2. **Add app-specific fields**: Extend presets with your custom sensitive fields

3. **Use patterns for content**: Scrub PII in messages/exceptions with regex
   patterns

4. **Test your configuration**: Use `createSentryEventScrubber` to test
   scrubbing

```typescript
import { createSentryEventScrubber } from '@heroku/js-blanket';

const scrubber = createSentryEventScrubber({
  fields: ['password'],
  patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g],
});

const testEvent = {
  message: 'Error for user@example.com',
  extra: { password: 'secret' },
};

const scrubbed = scrubber(testEvent);
console.log(scrubbed);
// { message: 'Error for [SCRUBBED]', extra: { password: '[SCRUBBED]' } }
```

5. **Monitor scrubbing effectiveness**: Review scrubbed events in Sentry to
   ensure comprehensive coverage

6. **Update field lists**: As your app evolves, keep your scrubbing config up to
   date
