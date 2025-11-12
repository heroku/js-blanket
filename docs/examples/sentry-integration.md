# Sentry Integration with JS Blanket

Integrate js-blanket with Sentry using the `beforeSend` and
`beforeSendTransaction` hooks to scrub PII before it reaches your error
monitoring. This works with both browser and Node.js Sentry SDKs.

## Table of Contents

- [Basic Setup](#basic-setup)
- [Scrubbing Event Data](#scrubbing-event-data)
- [Scrubbing Breadcrumbs](#scrubbing-breadcrumbs)
- [Scrubbing Transactions](#scrubbing-transactions)
- [Using Preset Field Lists](#using-preset-field-lists)
- [Advanced Configuration](#advanced-configuration)
- [Framework-Specific Examples](#framework-specific-examples)

## Basic Setup

### Installation

First, install both Sentry and js-blanket:

```bash
npm install @sentry/browser @heroku/js-blanket
```

### Simple Integration

Start with this pattern—it covers most use cases:

```javascript
import * as Sentry from '@sentry/browser';
import { Scrubber, HEROKU_FIELDS } from '@heroku/js-blanket';

// Create a scrubber instance
const scrubber = new Scrubber({
  fields: HEROKU_FIELDS,
  patterns: [
    /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, // Email addresses
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN patterns
  ],
});

// Initialize Sentry with PII scrubbing
Sentry.init({
  dsn: '___PUBLIC_DSN___',
  environment: 'production',
  release: 'my-app@1.0.0',

  // Scrub sensitive data before sending to Sentry
  beforeSend(event, hint) {
    return scrubber.scrub(event).data;
  },
});
```

## Scrubbing Event Data

Sentry's `beforeSend` hook runs right before an event ships. Scrub your data
here:

```javascript
import * as Sentry from '@sentry/browser';
import { Scrubber, GDPR_FIELDS, PCI_FIELDS } from '@heroku/js-blanket';

const scrubber = new Scrubber({
  fields: [...GDPR_FIELDS, ...PCI_FIELDS],
  paths: ['user.email', 'user.ip_address', 'request.headers.authorization'],
  replacement: '[REDACTED]',
});

Sentry.init({
  dsn: '___PUBLIC_DSN___',

  beforeSend(event, hint) {
    // Scrub the entire event object
    const scrubbedEvent = scrubber.scrub(event).data;

    // Log scrubbing activity in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Original event:', event);
      console.log('Scrubbed event:', scrubbedEvent);
    }

    return scrubbedEvent;
  },
});
```

## Scrubbing Breadcrumbs

Breadcrumbs capture user actions, console logs, and network requests—all
potential sources of PII leaks:

```javascript
import * as Sentry from '@sentry/browser';
import { Scrubber } from '@heroku/js-blanket';

const scrubber = new Scrubber({
  fields: ['password', 'token', 'apiKey', 'authorization'],
  patterns: [/Bearer\s+[\w-]+/gi], // Auth tokens
});

Sentry.init({
  dsn: '___PUBLIC_DSN___',

  beforeSend(event, hint) {
    // Scrub breadcrumbs if they exist
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(
        (breadcrumb) => scrubber.scrub(breadcrumb).data
      );
    }

    // Scrub the rest of the event
    return scrubber.scrub(event).data;
  },
});
```

## Scrubbing Transactions

For performance monitoring, scrub transaction data using
`beforeSendTransaction`:

```javascript
import * as Sentry from '@sentry/browser';
import { Scrubber, HEROKU_FIELDS } from '@heroku/js-blanket';

const scrubber = new Scrubber({
  fields: HEROKU_FIELDS,
  paths: ['request.headers', 'response.headers'],
});

Sentry.init({
  dsn: '___PUBLIC_DSN___',

  integrations: [Sentry.browserTracingIntegration()],

  tracesSampleRate: 1.0,

  // Scrub error events
  beforeSend(event, hint) {
    return scrubber.scrub(event).data;
  },

  // Scrub transaction events
  beforeSendTransaction(transaction, hint) {
    return scrubber.scrub(transaction).data;
  },
});
```

## Using Preset Field Lists

Three preset field lists cover common compliance requirements:

```javascript
import * as Sentry from '@sentry/browser';
import {
  Scrubber,
  HEROKU_FIELDS, // Heroku-specific sensitive fields
  GDPR_FIELDS, // GDPR compliance fields
  PCI_FIELDS, // PCI compliance fields
} from '@heroku/js-blanket';

// Combine multiple presets
const scrubber = new Scrubber({
  fields: [
    ...HEROKU_FIELDS,
    ...GDPR_FIELDS,
    ...PCI_FIELDS,
    // Add custom fields
    'internal_id',
    'session_token',
  ],
});

Sentry.init({
  dsn: '___PUBLIC_DSN___',
  beforeSend(event) {
    return scrubber.scrub(event).data;
  },
});
```

### Available Presets

- **HEROKU_FIELDS**: `heroku_oauth_token`, `sudo_oauth_token`,
  `www-sso-session`, etc.
- **GDPR_FIELDS**: `email`, `ip_address`, `phone_number`, `ssn`,
  `date_of_birth`, etc.
- **PCI_FIELDS**: `credit_card`, `cvv`, `card_number`, `expiration_date`, etc.

## Advanced Configuration

### Conditional Scrubbing

You might want full visibility in development but aggressive scrubbing in
production:

```javascript
import * as Sentry from '@sentry/browser';
import { Scrubber, HEROKU_FIELDS } from '@heroku/js-blanket';

const isProd = process.env.NODE_ENV === 'production';

const scrubber = isProd
  ? new Scrubber({
      fields: HEROKU_FIELDS,
      patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g],
    })
  : null;

Sentry.init({
  dsn: '___PUBLIC_DSN___',
  environment: process.env.NODE_ENV,

  beforeSend(event) {
    // Only scrub in production
    return scrubber ? scrubber.scrub(event).data : event;
  },
});
```

### Preserving User Callback

If you need to chain your own `beforeSend` logic with scrubbing:

```javascript
import * as Sentry from '@sentry/browser';
import { Scrubber, HEROKU_FIELDS } from '@heroku/js-blanket';

const scrubber = new Scrubber({ fields: HEROKU_FIELDS });

// Your custom error handler
function customErrorHandler(event, hint) {
  // Add custom tags
  event.tags = {
    ...event.tags,
    custom_tag: 'my-value',
  };

  // Filter out certain errors
  if (event.message?.includes('Ignore this')) {
    return null;
  }

  return event;
}

Sentry.init({
  dsn: '___PUBLIC_DSN___',

  beforeSend(event, hint) {
    // 1. Apply custom logic first
    const customizedEvent = customErrorHandler(event, hint);
    if (!customizedEvent) return null;

    // 2. Then scrub sensitive data
    return scrubber.scrub(customizedEvent).data;
  },
});
```

### Performance Optimization

Create the scrubber once at module load. Scrubbing operations are immutable, so
one instance works for all events:

```javascript
import * as Sentry from '@sentry/browser';
import { Scrubber, HEROKU_FIELDS } from '@heroku/js-blanket';

// Create scrubber once at module load
const scrubber = new Scrubber({
  fields: HEROKU_FIELDS,
  recursive: true,
});

Sentry.init({
  dsn: '___PUBLIC_DSN___',

  beforeSend(event) {
    // Reuse the same scrubber instance (immutable operations)
    return scrubber.scrub(event).data;
  },
});
```

## Framework-Specific Examples

### React

```javascript
// src/sentry-config.js
import * as Sentry from '@sentry/browser';
import { Scrubber, HEROKU_FIELDS, GDPR_FIELDS } from '@heroku/js-blanket';

const scrubber = new Scrubber({
  fields: [...HEROKU_FIELDS, ...GDPR_FIELDS],
});

export function initSentry() {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    beforeSend(event) {
      return scrubber.scrub(event).data;
    },

    beforeSendTransaction(transaction) {
      return scrubber.scrub(transaction).data;
    },
  });
}

// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initSentry } from './sentry-config';

// Initialize Sentry before rendering
initSentry();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

### Vue.js

```javascript
// src/plugins/sentry.js
import * as Sentry from '@sentry/browser';
import { Scrubber, HEROKU_FIELDS } from '@heroku/js-blanket';

const scrubber = new Scrubber({
  fields: HEROKU_FIELDS,
  patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g],
});

export default {
  install(app) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 1.0,

      beforeSend(event) {
        return scrubber.scrub(event).data;
      },
    });

    // Add to Vue global properties
    app.config.globalProperties.$sentry = Sentry;
  },
};

// src/main.js
import { createApp } from 'vue';
import App from './App.vue';
import sentryPlugin from './plugins/sentry';

const app = createApp(App);
app.use(sentryPlugin);
app.mount('#app');
```

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://browser.sentry-cdn.com/8.0.0/bundle.min.js"></script>
    <script type="module">
      import {
        Scrubber,
        HEROKU_FIELDS,
      } from 'https://unpkg.com/@heroku/js-blanket@latest/dist/esm/index.js';

      const scrubber = new Scrubber({
        fields: HEROKU_FIELDS,
      });

      Sentry.init({
        dsn: '___PUBLIC_DSN___',
        beforeSend(event) {
          return scrubber.scrub(event).data;
        },
      });
    </script>
  </head>
  <body>
    <h1>My App</h1>
    <button onclick="Sentry.captureException(new Error('Test error'))">
      Test Sentry
    </button>
  </body>
</html>
```

### Next.js

```javascript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs';
import { Scrubber, HEROKU_FIELDS, GDPR_FIELDS } from '@heroku/js-blanket';

const scrubber = new Scrubber({
  fields: [...HEROKU_FIELDS, ...GDPR_FIELDS],
});

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,

  beforeSend(event) {
    return scrubber.scrub(event).data;
  },

  beforeSendTransaction(transaction) {
    return scrubber.scrub(transaction).data;
  },
});

// sentry.server.config.js
import * as Sentry from '@sentry/nextjs';
import { Scrubber, HEROKU_FIELDS } from '@heroku/js-blanket';

const scrubber = new Scrubber({
  fields: HEROKU_FIELDS,
});

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,

  beforeSend(event) {
    return scrubber.scrub(event).data;
  },
});
```

## Best Practices

### 1. Initialize Early

Initialize Sentry before your application code runs. Otherwise, early errors
might ship without scrubbing:

```javascript
// ✅ Good: Initialize at app entry point
import { initSentry } from './sentry-config';
initSentry(); // First thing
import App from './App'; // Then app code

// ❌ Bad: Initialize after app code
import App from './App'; // App code first
import { initSentry } from './sentry-config';
initSentry(); // Too late - some errors might have been missed
```

### 2. Test Your Scrubbing

Don't assume it's working. Verify with a test error in development:

```javascript
import * as Sentry from '@sentry/browser';
import { Scrubber, HEROKU_FIELDS } from '@heroku/js-blanket';

const scrubber = new Scrubber({ fields: HEROKU_FIELDS });

Sentry.init({
  dsn: '___PUBLIC_DSN___',

  beforeSend(event) {
    const scrubbed = scrubber.scrub(event).data;

    // In development, log to verify scrubbing
    if (process.env.NODE_ENV === 'development') {
      console.group('🔒 Sentry Event Scrubbing');
      console.log('Original:', event);
      console.log('Scrubbed:', scrubbed);
      console.groupEnd();
    }

    return scrubbed;
  },
});

// Test with sensitive data
setTimeout(() => {
  Sentry.captureException(new Error('Test'), {
    extra: {
      heroku_oauth_token: 'secret123',
      user_email: 'test@example.com',
    },
  });
}, 1000);
```

### 3. Use Appropriate Replacement Text

Different replacement text per environment makes debugging easier:

```javascript
const scrubber = new Scrubber({
  fields: HEROKU_FIELDS,
  replacement:
    process.env.NODE_ENV === 'production' ? '[REDACTED]' : '[REDACTED-DEV]',
});
```

### 4. Monitor Scrubbing Performance

High-traffic apps should monitor scrubbing overhead. Target is under 10ms per
event:

```javascript
Sentry.init({
  dsn: '___PUBLIC_DSN___',

  beforeSend(event) {
    const start = performance.now();
    const scrubbed = scrubber.scrub(event).data;
    const duration = performance.now() - start;

    // Log slow scrubbing operations
    if (duration > 10) {
      console.warn(`Slow scrubbing detected: ${duration}ms`);
    }

    return scrubbed;
  },
});
```

## Troubleshooting

### Data Still Appearing in Sentry

If PII is still leaking through:

1. **Check field names**: Ensure your field names match exactly (case-sensitive)
2. **Test patterns**: Verify regex patterns match your actual data format
3. **Check timing**: Scrubber must initialize before Sentry.init()
4. **Enable logging**: Add console.log statements in beforeSend to debug

```javascript
const scrubber = new Scrubber({
  fields: ['password', 'token'],
});

Sentry.init({
  dsn: '___PUBLIC_DSN___',
  beforeSend(event) {
    console.log('Before scrub:', JSON.stringify(event, null, 2));
    const scrubbed = scrubber.scrub(event).data;
    console.log('After scrub:', JSON.stringify(scrubbed, null, 2));
    return scrubbed;
  },
});
```

### Performance Issues

If scrubbing adds noticeable latency:

1. **Disable recursive scrubbing** if you only need top-level scrubbing:

   ```javascript
   const scrubber = new Scrubber({
     fields: HEROKU_FIELDS,
     recursive: false, // Only scrub top-level
   });
   ```

2. **Simplify patterns**: Complex regex can be expensive on large payloads
3. **Cache scrubber instance**: Creating a new scrubber per event is wasteful

## Additional Resources

- [Sentry JavaScript SDK Documentation](https://docs.sentry.io/platforms/javascript/)
- [js-blanket Logging Integration Examples](./logging-integration.md)
- [js-blanket Core API Documentation](../../README.md)

## License

This example code is provided under the Apache-2.0 license, same as js-blanket.
