# Logging Integration with JS Blanket

Quick reference for integrating `@heroku/js-blanket` with popular logging
libraries. For logger-specific configuration and troubleshooting, see each
logger's documentation.

## Table of Contents

- [Winston Integration](#winston-integration)
- [Pino Integration](#pino-integration)
- [Bunyan Integration](#bunyan-integration)
- [Custom Logger Integration](#custom-logger-integration)
- [Best Practices](#best-practices)

---

## Winston Integration

[Winston](https://github.com/winstonjs/winston)—Use a custom format to scrub
sensitive data:

```typescript
import winston from 'winston';
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

// Create the redactor once at module level
const redactor = createRedactor({
  fields: HEROKU_FIELDS,
  paths: ['request.headers.authorization'],
});

// Custom format that scrubs sensitive data
const scrubFormat = winston.format((info) => {
  return redactor.scrub(info).data;
});

// Create Winston logger with scrubbing
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    scrubFormat(), // Scrub sensitive data first
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' }),
  ],
});

// Usage
logger.info('User login', {
  user: 'john',
  email: 'john@example.com',
  password: 'secret123', // Scrubbed
  apiToken: 'token123', // Scrubbed
});
```

**Advanced patterns:** For metadata scrubbing, child loggers, or custom
serializers, see
[Winston's format documentation](https://github.com/winstonjs/winston#formats).

---

## Pino Integration

[Pino](https://github.com/pinojs/pino)—use `hooks.logMethod` for high
performance scrubbing:

```typescript
import pino from 'pino';
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

// Create the redactor once at module level
const redactor = createRedactor({
  fields: HEROKU_FIELDS,
});

// Create Pino logger with scrubbing
const logger = pino({
  level: 'info',
  hooks: {
    // Scrub all log objects before they're written
    logMethod(args, method) {
      if (args.length >= 2) {
        const [obj, msg, ...rest] = args;
        const scrubbed = redactor.scrub(obj);
        method.apply(this, [scrubbed.data, msg, ...rest]);
      } else {
        method.apply(this, args);
      }
    },
  },
});

// Usage
logger.info({
  user: 'john',
  password: 'secret123', // Scrubbed
  apiToken: 'token123', // Scrubbed
  msg: 'User login',
});
```

**Advanced patterns:** For child loggers, bindings, or custom serializers, see
[Pino's hooks documentation](https://github.com/pinojs/pino/blob/master/docs/api.md#hooks).

---

## Bunyan Integration

[Bunyan](https://github.com/trentm/node-bunyan)—use a custom stream to scrub
records before writing:

```typescript
import bunyan from 'bunyan';
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

// Create the redactor once at module level
const redactor = createRedactor({
  fields: HEROKU_FIELDS,
});

// Custom stream that scrubs logs before writing
class ScrubStream {
  write(rec: bunyan.LogRecord) {
    const scrubbed = redactor.scrub(rec);
    console.log(JSON.stringify(scrubbed.data));
  }
}

// Create Bunyan logger with scrubbing stream
const logger = bunyan.createLogger({
  name: 'myapp',
  streams: [
    {
      level: 'info',
      stream: new ScrubStream(),
    },
  ],
  serializers: bunyan.stdSerializers,
});

// Usage
logger.info(
  {
    user: 'john',
    password: 'secret123', // Scrubbed
    apiToken: 'token123', // Scrubbed
  },
  'User login'
);
```

**Advanced patterns:** For custom serializers or multiple streams, see
[Bunyan's serializers documentation](https://github.com/trentm/node-bunyan#serializers).

---

## Custom Logger Integration

For custom loggers, scrub data before writing:

```typescript
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

// Create the redactor once at module level
const redactor = createRedactor({
  fields: HEROKU_FIELDS,
});

class SimpleLogger {
  info(message: string, data?: Record<string, unknown>) {
    this.log('INFO', message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log('ERROR', message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log('WARN', message, data);
  }

  private log(level: string, message: string, data?: Record<string, unknown>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
    };

    const scrubbed = redactor.scrub(logEntry);
    console.log(JSON.stringify(scrubbed.data));
  }
}

// Usage
const logger = new SimpleLogger();
logger.info('User login', {
  user: 'john',
  password: 'secret123', // Scrubbed
  apiToken: 'token123', // Scrubbed
});
```

---

## Best Practices

### Create Redactor Once

Create the redactor at module load, not per log:

```typescript
// ✅ Good: Create once at module level
const redactor = createRedactor({ fields: HEROKU_FIELDS });

function logUserAction(data: Record<string, unknown>) {
  const { data: scrubbed } = redactor.scrub(data);
  logger.info(scrubbed);
}

// ❌ Bad: Creating on every log
function logUserAction(data: Record<string, unknown>) {
  const redactor = createRedactor({ fields: HEROKU_FIELDS }); // Wasteful!
  const { data: scrubbed } = redactor.scrub(data);
  logger.info(scrubbed);
}
```

### Use Presets

Use preset field lists for common scenarios:

```typescript
import { HEROKU_FIELDS, GDPR_FIELDS, PCI_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({
  fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
});
```

### Combine Scrubbing Modes

Layer different strategies for comprehensive coverage:

```typescript
const redactor = createRedactor({
  fields: HEROKU_FIELDS, // Scrub by field name
  paths: ['request.headers.authorization'], // Scrub specific paths
  patterns: [/\b\d{3}-\d{2}-\d{4}\b/g], // Scrub SSN patterns in text
});
```

---

## Additional Resources

- [Sentry Integration Examples](./sentry-integration.md)
- [Core Scrubber API](../../README.md#core-scrubber)
- [Preset Field Lists](../../README.md#preset-field-lists)
