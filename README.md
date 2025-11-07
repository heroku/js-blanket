# @heroku/js-blanket

> Framework-agnostic sensitive data scrubbing for error monitoring services and
> logging libraries

[![npm version](https://img.shields.io/npm/v/@heroku/js-blanket.svg)](https://www.npmjs.com/package/@heroku/js-blanket)
[![License](https://img.shields.io/npm/l/@heroku/js-blanket.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

## The Problem

Sensitive data leaks into production error monitoring and logs across teams:

- **Inconsistent protection**: Each service (Dashboard, CLI, Status-UI)
  implements its own scrubbing
- **Incomplete coverage**: Current implementations miss nested data,
  breadcrumbs, and pattern-based PII
- **Migration risk**: Moving from Rollbar to Sentry exposes gaps in PII
  protection
- **Maintenance burden**: Updating field lists requires changes across multiple
  repos

## The Solution

**One NPM package. One canonical field list. One core scrubbing engine.**

`@heroku/js-blanket` is a high-performance, framework-agnostic library that
scrubs PII from structured data before it reaches error monitoring services
(Sentry, Rollbar) or production logs (Winston, Pino, Bunyan).

### Key Features

- ✅ **Framework-agnostic**: Works with any error monitoring service or logging
  library
- ✅ **Three scrubbing modes**: Field-based, path-based, and pattern-based
- ✅ **Immutable**: Never modifies original objects
- ✅ **Type-safe**: Full TypeScript support with generic type preservation
- ✅ **Circular-safe**: Handles circular references without crashing
- ✅ **High-performance**: <1ms p95 for logging, <10ms p95 for exception
  handling
- ✅ **Preset field lists**: Battle-tested lists for Heroku, GDPR, and PCI
  compliance
- ✅ **Comprehensive testing**: 100% statement coverage, 82+ tests

## Quick Start

### Installation

```bash
npm install @heroku/js-blanket
# or
pnpm add @heroku/js-blanket
# or
yarn add @heroku/js-blanket
```

### Basic Usage

#### Sentry Integration (Node.js)

```typescript
import * as Sentry from '@sentry/node';
import {
  initSentryWithBlanket,
  Scrubber,
  HEROKU_FIELDS,
} from '@heroku/js-blanket';

// Configure Sentry with automatic PII scrubbing
const config = {
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  fields: HEROKU_FIELDS, // Scrub Heroku-specific tokens
};

initSentryWithBlanket(config, Scrubber);
Sentry.init(config);

// All errors are now automatically scrubbed
Sentry.captureException(
  new Error('Login failed'),
  { extra: { password: 'secret123' } } // ← Scrubbed to [SCRUBBED]
);
```

#### Logging Integration (Winston)

```typescript
import winston from 'winston';
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({
  fields: HEROKU_FIELDS,
  patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g], // Email pattern
});

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format((info) => redactor.scrub(info).data)()
  ),
  transports: [new winston.transports.Console()],
});

logger.info('User login', {
  user: 'john',
  password: 'secret', // ← Scrubbed to [SCRUBBED]
  email: 'john@example.com', // ← Scrubbed to [SCRUBBED]
});
```

## Core Concepts

### Three Scrubbing Modes

#### 1. Field-Based Scrubbing

Scrubs values by field name (exact match or regex):

```typescript
import { Scrubber } from '@heroku/js-blanket';

const scrubber = new Scrubber({
  fields: ['password', 'apiToken', /api[-_]?key/i],
  replacement: '[SCRUBBED]',
});

const data = {
  user: 'john',
  password: 'secret123',
  apiKey: 'key-abc',
  nested: {
    api_token: 'token-xyz',
  },
};

const result = scrubber.scrub(data);
/*
{
  user: 'john',
  password: '[SCRUBBED]',
  apiKey: '[SCRUBBED]',
  nested: { api_token: '[SCRUBBED]' }
}
*/
```

#### 2. Path-Based Scrubbing

Scrubs values at specific paths (dot notation):

```typescript
const scrubber = new Scrubber({
  paths: ['user.email', 'request.headers.authorization'],
  replacement: '[REDACTED]',
});

const data = {
  user: {
    name: 'John',
    email: 'john@example.com', // ← Scrubbed
  },
  request: {
    method: 'POST',
    headers: {
      authorization: 'Bearer token', // ← Scrubbed
    },
  },
};

const result = scrubber.scrub(data);
```

#### 3. Pattern-Based Scrubbing

Scrubs content matching regex patterns:

```typescript
const scrubber = new Scrubber({
  patterns: [
    /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, // Email
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /Bearer\s+[\w-]+/gi, // Bearer tokens
  ],
  replacement: '[PII]',
});

const data = {
  message: 'User user@example.com logged in with SSN 123-45-6789',
  log: 'Authorization: Bearer abc123def456',
};

const result = scrubber.scrub(data);
/*
{
  message: 'User [PII] logged in with SSN [PII]',
  log: 'Authorization: [PII]'
}
*/
```

### Preset Field Lists

Battle-tested field lists for common compliance requirements:

```typescript
import { HEROKU_FIELDS, GDPR_FIELDS, PCI_FIELDS } from '@heroku/js-blanket';

// HEROKU_FIELDS: heroku_oauth_token, sudo_oauth_token, www-sso-session, etc.
// GDPR_FIELDS: email, ip_address, phone_number, ssn, date_of_birth, etc.
// PCI_FIELDS: credit_card, cvv, card_number, expiration_date, etc.

const scrubber = new Scrubber({
  fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
});
```

## Adapters

### Sentry Adapter

Automatically scrubs Sentry error events, transaction events, and breadcrumbs.

**Features:**

- Scrubs `beforeSend` and `beforeSendTransaction` hooks
- Preserves user callbacks (runs scrubbing first, then user logic)
- Compatible with `@sentry/node` and `@sentry/browser` (>=10.0.0)
- Scrubs breadcrumbs (console logs, HTTP requests, navigation)

**Quick Start:**

```typescript
import * as Sentry from '@sentry/node';
import {
  initSentryWithBlanket,
  Scrubber,
  HEROKU_FIELDS,
} from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  fields: HEROKU_FIELDS,
  patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g],
};

initSentryWithBlanket(config, Scrubber);
Sentry.init(config);
```

**Full documentation:**
[docs/examples/sentry-integration.md](docs/examples/sentry-integration.md)

### Generic Logging Adapter

Universal adapter for any logging library (Winston, Pino, Bunyan, custom
loggers).

**Features:**

- Works with all major Node.js logging libraries
- Simple `createRedactor()` function
- Integrates with `oauth-provider-adapters-for-mcp` (drop-in replacement for
  `redaction.ts`)
- <0.02ms p95 latency (194k+ logs/sec)

**Quick Start:**

```typescript
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({
  fields: HEROKU_FIELDS,
  paths: ['user.email'],
  patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g],
});

// Use with any logger
const scrubbedData = redactor.scrub(logData).data;
logger.info(scrubbedData);
```

**Full documentation:**
[docs/examples/logging-integration.md](docs/examples/logging-integration.md)

## Advanced Usage

### Combining All Scrubbing Modes

```typescript
import {
  Scrubber,
  HEROKU_FIELDS,
  GDPR_FIELDS,
  PCI_FIELDS,
} from '@heroku/js-blanket';

const scrubber = new Scrubber({
  // Field-based: exact names + regex patterns
  fields: [
    ...HEROKU_FIELDS,
    ...GDPR_FIELDS,
    ...PCI_FIELDS,
    'customSecret',
    /api[-_]?key/i,
  ],

  // Path-based: dot notation
  paths: [
    'user.email',
    'user.profile.ssn',
    'request.headers.authorization',
    'extra.metadata.credentials',
  ],

  // Pattern-based: content scrubbing
  patterns: [
    /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, // Email
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, // Credit card
    /Bearer\s+[\w-]+/gi, // Bearer tokens
  ],

  replacement: '[SCRUBBED]',
  recursive: true,
});

const result = scrubber.scrub(sensitiveData);
```

### Custom Callbacks with Sentry

```typescript
import * as Sentry from '@sentry/node';
import { initSentryWithBlanket, Scrubber } from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,
  fields: ['password', 'apiToken'],

  // Your custom logic runs AFTER scrubbing
  beforeSend: (event, hint) => {
    // Add custom tags
    event.tags = { ...event.tags, environment: 'production' };

    // Filter test errors
    if (event.environment === 'test') {
      return null; // Drop event
    }

    return event;
  },
};

initSentryWithBlanket(config, Scrubber);
Sentry.init(config);
```

### TypeScript Type Safety

The scrubber preserves TypeScript types through generic constraints:

```typescript
interface User {
  name: string;
  email: string;
  password: string;
}

const scrubber = new Scrubber({
  fields: ['password'],
});

const user: User = {
  name: 'John',
  email: 'john@example.com',
  password: 'secret123',
};

const result = scrubber.scrub(user);
// result.data is still typed as User
// TypeScript knows result.data.name is a string
console.log(result.data.name); // ✅ Type-safe
```

## Performance

`@heroku/js-blanket` is designed for production use with strict performance
requirements:

### Benchmark Results

| Use Case            | p95 Latency | Target | Status |
| ------------------- | ----------- | ------ | ------ |
| **Logging**         | 0.003ms     | <1ms   | ✅     |
| **Exception**       | 0.034ms     | <10ms  | ✅     |
| **Large Payloads**  | 1.2ms       | <10ms  | ✅     |
| **Throughput**      | 194k+/sec   | 50k+   | ✅     |
| **Complex Objects** | 0.187ms     | <1ms   | ⚠️     |

### Performance Tips

1. **Reuse scrubber instances**: Create once, use many times

```typescript
// ✅ Good: Reuse instance
const scrubber = new Scrubber({ fields: HEROKU_FIELDS });
logs.forEach((log) => scrubber.scrub(log));

// ❌ Bad: Create new instance each time
logs.forEach((log) => new Scrubber({ fields: HEROKU_FIELDS }).scrub(log));
```

2. **Use specific field names over broad regex**

```typescript
// ✅ Faster
fields: ['password', 'apiToken', 'oauth_token'];

// ❌ Slower
fields: [/.*password.*/i, /.*token.*/i];
```

3. **Limit pattern complexity**

```typescript
// ✅ Simple pattern
patterns: [/\b\d{3}-\d{2}-\d{4}\b/g];

// ❌ Complex pattern (backtracking)
patterns: [/\b(\d{3}[-\s]?)?(\d{2}[-\s]?)?(\d{4})\b/g];
```

## Migration Guides

### From `oauth-provider-adapters-for-mcp`

```typescript
// Before (oauth-provider-adapters-for-mcp)
import { redactSensitivePaths } from './logging/redaction';

const paths = ['user.email', 'credentials.secret'];
const redacted = redactSensitivePaths(data, paths);

// After (js-blanket)
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({
  paths: ['user.email', 'credentials.secret'],
  fields: HEROKU_FIELDS, // ✨ Enhanced: field-based matching
  patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g], // ✨ Enhanced: pattern-based
});

const redacted = redactor.scrub(data).data;
```

### From Rollbar

```typescript
// Before (Rollbar)
import Rollbar from 'rollbar';

const rollbar = new Rollbar({
  accessToken: process.env.ROLLBAR_TOKEN,
  scrubFields: ['password', 'api_token'],
  transform: (payload) => {
    // Custom transformation
    return payload;
  },
});

// After (Sentry + js-blanket)
import * as Sentry from '@sentry/node';
import {
  initSentryWithBlanket,
  Scrubber,
  HEROKU_FIELDS,
} from '@heroku/js-blanket';

const config = {
  dsn: process.env.SENTRY_DSN,
  fields: [...HEROKU_FIELDS, 'api_token'],
  paths: ['user.email'], // ✨ More powerful than Rollbar
  patterns: [/\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g], // ✨ Pattern-based scrubbing
  beforeSend: (event) => {
    // Your custom transformation
    return event;
  },
};

initSentryWithBlanket(config, Scrubber);
Sentry.init(config);
```

## API Reference

### Core Scrubber

#### `new Scrubber(config: ScrubConfig)`

Creates a new scrubber instance.

**Configuration:**

```typescript
interface ScrubConfig {
  fields?: (string | RegExp)[]; // Field names to scrub
  paths?: string[]; // Dot-notation paths to scrub
  patterns?: RegExp[]; // Content patterns to scrub
  replacement?: string; // Replacement string (default: '[SCRUBBED]')
  recursive?: boolean; // Deep traversal (default: true)
}
```

**Methods:**

- `scrub<T>(data: T): ScrubResult<T>` - Scrubs sensitive data immutably

**Return Type:**

```typescript
interface ScrubResult<T> {
  data: T; // Scrubbed data (new object)
  scrubbed: boolean; // Whether any data was scrubbed
}
```

### Sentry Adapter

#### `initSentryWithBlanket(config: SentryBlanketConfig, ScrubberClass: typeof Scrubber): void`

Configures Sentry with automatic PII scrubbing.

**Configuration:**

```typescript
interface SentryBlanketConfig extends Sentry.Options {
  // Scrubbing configuration
  fields?: (string | RegExp)[];
  paths?: string[];
  patterns?: RegExp[];
  replacement?: string;

  // Behavior options
  preserveUserCallback?: boolean; // Default: true
}
```

#### `createSentryEventScrubber(config, ScrubberClass): (event: SentryEvent) => SentryEvent`

Creates a standalone Sentry event scrubber (useful for testing).

### Logging Adapter

#### `createRedactor(config: ScrubConfig): Scrubber`

Creates a scrubber instance for logging (alias for `new Scrubber(config)`).

### Preset Field Lists

#### `HEROKU_FIELDS: string[]`

Heroku-specific sensitive fields:

- `heroku_oauth_token`
- `sudo_oauth_token`
- `www-sso-session`
- `api_token`
- And more...

#### `GDPR_FIELDS: string[]`

GDPR compliance fields:

- `email`
- `ip_address`
- `phone_number`
- `ssn`
- `date_of_birth`
- And more...

#### `PCI_FIELDS: string[]`

PCI DSS compliance fields:

- `credit_card`
- `cvv`
- `card_number`
- `expiration_date`
- `security_code`
- And more...

## Testing

The library has comprehensive test coverage:

- **Core Scrubber**: 32 tests, 100% statement coverage
- **Sentry Adapter**: 27 tests, 100% statement coverage
- **Logging Adapter**: 27 tests, 100% statement coverage
- **Type Safety**: 23 type validation tests
- **Total**: 82+ tests across 8 test suites

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test

# Run performance benchmarks
pnpm run bench
pnpm run bench:logging
```

## Requirements

- **Node.js**: >=20.0.0
- **TypeScript**: >=5.9 (if using TypeScript)
- **Sentry SDK** (optional): >=10.0.0 (`@sentry/node` or `@sentry/browser`)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for
guidelines.

## License

Apache-2.0 © Heroku

## Support

- **Documentation**: [docs/examples/](docs/examples/)
- **Issues**:
  [GitHub Issues](https://github.com/heroku/node-sentry-blanket/issues)
- **Slack**: #heroku-engineering

## Related Projects

- [`sentry-blanket`](https://github.com/heroku/sentry-blanket) - Ruby gem for
  Sentry scrubbing
- [`oauth-provider-adapters-for-mcp`](https://github.com/heroku/oauth-provider-adapters-for-mcp) -
  OAuth provider adapters (uses js-blanket for logging)

---

**Made with ❤️ by Heroku Engineering**
