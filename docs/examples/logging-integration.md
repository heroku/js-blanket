# Generic Logging Adapter - Integration Examples

Examples for integrating `@heroku/js-blanket` with Winston, Pino, Bunyan, and
custom loggers.

## Table of Contents

- [Winston Integration](#winston-integration)
- [Pino Integration](#pino-integration)
- [Bunyan Integration](#bunyan-integration)
- [Custom Logger Integration](#custom-logger-integration)
- [oauth-provider-adapters Migration](#oauth-provider-adapters-migration)

---

## Winston Integration

[Winston](https://github.com/winstonjs/winston) handles multiple transports and
has powerful formatting. The scrubber slots in as a custom format.

### Basic Integration

```typescript
import winston from 'winston';
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

// Create the redactor
const redactor = createRedactor({
  fields: HEROKU_FIELDS,
  paths: ['request.headers.authorization'],
});

// Custom format that scrubs sensitive data
const scrubFormat = winston.format((info) => {
  const scrubbed = redactor.scrub(info);
  return scrubbed.data;
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
  password: 'secret123', // Will be scrubbed
  apiToken: 'token123', // Will be scrubbed
});
```

### Advanced Winston Integration with Metadata

```typescript
import winston from 'winston';
import { createRedactor, HEROKU_FIELDS, GDPR_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({
  fields: [...HEROKU_FIELDS, ...GDPR_FIELDS],
});

// Helper function to scrub metadata
function scrubMetadata(info: winston.Logform.TransformableInfo) {
  // Extract non-symbol properties (Winston uses Symbols for internal data)
  const data: Record<string, unknown> = {};
  for (const key in info) {
    if (typeof key === 'string' && !key.startsWith('Symbol(')) {
      data[key] = info[key];
    }
  }

  const scrubbed = redactor.scrub(data);

  // Replace info properties with scrubbed versions
  Object.assign(info, scrubbed.data);
  return info;
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format((info) => scrubMetadata(info))(),
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Usage with rich metadata
logger.info('API request completed', {
  request: {
    method: 'POST',
    url: '/api/users',
    headers: {
      authorization: 'Bearer secret', // Scrubbed
      'user-agent': 'Mozilla/5.0',
    },
  },
  user: {
    id: 'user-123',
    email: 'user@example.com', // Scrubbed (GDPR_FIELDS)
  },
  duration: 145,
});
```

### Winston with Child Loggers

```typescript
import winston from 'winston';
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({ fields: HEROKU_FIELDS });

const scrubFormat = winston.format((info) => {
  const scrubbed = redactor.scrub(info);
  return scrubbed.data;
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    scrubFormat(),
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Create child logger with default metadata
const requestLogger = logger.child({ requestId: 'req-123' });

// All logs from child logger are scrubbed
requestLogger.info('User authenticated', {
  userId: 'user-456',
  password: 'secret', // Scrubbed
});
```

---

## Pino Integration

[Pino](https://github.com/pinojs/pino) prioritizes performance. Use the
`hooks.logMethod` pattern to scrub without adding much overhead.

### Basic Integration

```typescript
import pino from 'pino';
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({
  fields: HEROKU_FIELDS,
});

// Custom serializer that scrubs sensitive data
const scrubSerializer = (obj: unknown) => {
  const scrubbed = redactor.scrub(obj);
  return scrubbed.data;
};

// Create Pino logger with scrubbing
const logger = pino({
  level: 'info',
  serializers: {
    // Scrub the entire log object
    log: scrubSerializer,
    // Or scrub specific fields
    user: scrubSerializer,
    request: scrubSerializer,
  },
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
  password: 'secret123', // Will be scrubbed
  apiToken: 'token123', // Will be scrubbed
  msg: 'User login',
});
```

### Advanced Pino Integration with Redaction

```typescript
import pino from 'pino';
import { createRedactor, HEROKU_FIELDS, GDPR_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({
  fields: [...HEROKU_FIELDS, ...GDPR_FIELDS],
  paths: ['request.headers.authorization', 'request.body.password'],
});

// Create Pino logger with comprehensive scrubbing
const logger = pino({
  level: 'info',
  hooks: {
    logMethod(args, method) {
      if (args.length >= 1) {
        const [first, ...rest] = args;

        // Handle both obj-msg and msg-only formats
        if (typeof first === 'object' && first !== null) {
          const scrubbed = redactor.scrub(first);
          method.apply(this, [scrubbed.data, ...rest]);
        } else {
          method.apply(this, args);
        }
      } else {
        method.apply(this, args);
      }
    },
  },
});

// Usage with nested data
logger.info({
  request: {
    method: 'POST',
    url: '/api/login',
    headers: {
      authorization: 'Bearer token123', // Scrubbed by path
      'content-type': 'application/json',
    },
    body: {
      username: 'john',
      password: 'secret123', // Scrubbed by path
    },
  },
  user: {
    id: 'user-123',
    email: 'john@example.com', // Scrubbed by GDPR_FIELDS
  },
  msg: 'Login attempt',
});
```

### Pino with Child Loggers and Bindings

```typescript
import pino from 'pino';
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({ fields: HEROKU_FIELDS });

const logger = pino({
  hooks: {
    logMethod(args, method) {
      if (args.length >= 1 && typeof args[0] === 'object') {
        const scrubbed = redactor.scrub(args[0]);
        method.apply(this, [scrubbed.data, ...args.slice(1)]);
      } else {
        method.apply(this, args);
      }
    },
  },
});

// Create child logger with bindings
const childLogger = logger.child({
  requestId: 'req-456',
  userId: 'user-789',
});

// Bindings are also scrubbed
childLogger.info({
  password: 'secret', // Scrubbed
  action: 'update-profile',
});
```

---

## Bunyan Integration

[Bunyan](https://github.com/trentm/node-bunyan) outputs structured JSON logs.
Use a custom stream to scrub records before they're written.

### Basic Integration

```typescript
import bunyan from 'bunyan';
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

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
  serializers: bunyan.stdSerializers, // Include standard serializers
});

// Usage
logger.info(
  {
    user: 'john',
    password: 'secret123', // Will be scrubbed
    apiToken: 'token123', // Will be scrubbed
  },
  'User login'
);
```

### Advanced Bunyan Integration

```typescript
import bunyan from 'bunyan';
import {
  createRedactor,
  HEROKU_FIELDS,
  GDPR_FIELDS,
  PCI_FIELDS,
} from '@heroku/js-blanket';

const redactor = createRedactor({
  fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
});

// Custom serializers that scrub sensitive data
const scrubSerializers = {
  ...bunyan.stdSerializers,
  // Scrub request data
  req: (req: Record<string, unknown>) => {
    const serialized = bunyan.stdSerializers.req(req);
    const scrubbed = redactor.scrub(serialized);
    return scrubbed.data;
  },
  // Scrub response data
  res: (res: Record<string, unknown>) => {
    const serialized = bunyan.stdSerializers.res(res);
    const scrubbed = redactor.scrub(serialized);
    return scrubbed.data;
  },
  // Scrub error data
  err: (err: Error) => {
    const serialized = bunyan.stdSerializers.err(err);
    const scrubbed = redactor.scrub(serialized);
    return scrubbed.data;
  },
  // Custom user serializer
  user: (user: Record<string, unknown>) => {
    const scrubbed = redactor.scrub(user);
    return scrubbed.data;
  },
};

class ScrubStream {
  write(rec: bunyan.LogRecord) {
    const scrubbed = redactor.scrub(rec);
    process.stdout.write(JSON.stringify(scrubbed.data) + '\n');
  }
}

const logger = bunyan.createLogger({
  name: 'myapp',
  streams: [
    {
      level: 'info',
      stream: new ScrubStream(),
    },
  ],
  serializers: scrubSerializers,
});

// Usage with serializers
logger.info(
  {
    req: {
      method: 'POST',
      url: '/api/users',
      headers: { authorization: 'Bearer token' },
    },
    user: { id: 'user-123', email: 'user@example.com', password: 'secret' },
  },
  'API request'
);
```

---

## Custom Logger Integration

### Simple Custom Logger

```typescript
import { createRedactor, HEROKU_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({
  fields: HEROKU_FIELDS,
});

class SimpleLogger {
  private redactor = redactor;

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
    const timestamp = new Date().toISOString();

    const logEntry = {
      timestamp,
      level,
      message,
      ...data,
    };

    const scrubbed = this.redactor.scrub(logEntry);
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

### Advanced Custom Logger with Formatting

```typescript
import { createRedactor, HEROKU_FIELDS, GDPR_FIELDS } from '@heroku/js-blanket';

interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'pretty';
  scrubConfig: Parameters<typeof createRedactor>[0];
}

class AdvancedLogger {
  private config: LoggerConfig;
  private redactor: ReturnType<typeof createRedactor>;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.redactor = createRedactor(config.scrubConfig);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog('debug')) {
      this.log('DEBUG', message, meta);
    }
  }

  info(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog('info')) {
      this.log('INFO', message, meta);
    }
  }

  warn(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog('warn')) {
      this.log('WARN', message, meta);
    }
  }

  error(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog('error')) {
      this.log('ERROR', message, meta);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.config.level);
  }

  private log(level: string, message: string, meta?: Record<string, unknown>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };

    const scrubbed = this.redactor.scrub(logEntry);

    if (this.config.format === 'json') {
      console.log(JSON.stringify(scrubbed.data));
    } else {
      this.prettyPrint(scrubbed.data);
    }
  }

  private prettyPrint(data: Record<string, unknown>) {
    const { timestamp, level, message, ...rest } = data;
    console.log(`[${timestamp}] ${level}: ${message}`);
    if (Object.keys(rest).length > 0) {
      console.log('  ', JSON.stringify(rest, null, 2));
    }
  }
}

// Usage
const logger = new AdvancedLogger({
  level: 'info',
  format: 'pretty',
  scrubConfig: {
    fields: [...HEROKU_FIELDS, ...GDPR_FIELDS],
    paths: ['request.headers.authorization'],
  },
});

logger.info('User authenticated', {
  user: {
    id: 'user-123',
    email: 'john@example.com', // Scrubbed by GDPR_FIELDS
    password: 'secret', // Scrubbed by HEROKU_FIELDS
  },
  request: {
    method: 'POST',
    headers: {
      authorization: 'Bearer token', // Scrubbed by path
    },
  },
});
```

---

## Best Practices

### 1. Create Redactor Once

Create the redactor at module load, not per-log.

```typescript
// ✅ Good: Create redactor once at module level
const redactor = createRedactor({ fields: HEROKU_FIELDS });

function logUserAction(data: Record<string, unknown>) {
  const { data: scrubbed } = redactor.scrub(data);
  logger.info(scrubbed);
}

// ❌ Bad: Creating redactor on every log
function logUserAction(data: Record<string, unknown>) {
  const redactor = createRedactor({ fields: HEROKU_FIELDS }); // Wasteful!
  const { data: scrubbed } = redactor.scrub(data);
  logger.info(scrubbed);
}
```

### 2. Use Presets

The presets are curated lists. Use them unless you have specific requirements:

```typescript
// ✅ Good: Use presets for common scenarios
import { HEROKU_FIELDS, GDPR_FIELDS, PCI_FIELDS } from '@heroku/js-blanket';

const redactor = createRedactor({
  fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
});

// ❌ Tedious: Manually listing all fields
const redactor = createRedactor({
  fields: ['password', 'apiToken', 'email', 'phone', 'cvv', ...],
});
```

### 3. Combine Scrubbing Modes

Layer different strategies for defense in depth:

```typescript
// ✅ Good: Use multiple modes for comprehensive scrubbing
const redactor = createRedactor({
  fields: HEROKU_FIELDS, // Scrub by field name
  paths: ['request.headers.authorization'], // Scrub specific paths
  patterns: [/\b\d{3}-\d{2}-\d{4}\b/g], // Scrub SSN patterns in text
});
```

### 4. Monitor Scrubbing Activity

Track what's being redacted, especially during initial deployment:

```typescript
// ✅ Good: Track what was scrubbed for debugging
const result = redactor.scrub(data);

if (result.scrubbed) {
  console.log('Scrubbed paths:', result.scrubbedPaths);
}

logger.info(result.data);
```

---

## Performance Considerations

- **Overhead**: <0.02ms p95 for typical log entries (measured on standard
  payloads)
- **Throughput**: 194k+ logs/sec average (single-threaded)
- **Memory**: Scrubbing is immutable—creates new objects rather than mutating
- **Caching**: Redactor instances cache path lookups for O(1) field matching

## Additional Resources

- [API Documentation](../api/README.md)
- [Core Scrubber Guide](../core/scrubber.md)
- [Presets Reference](../core/presets.md)
- [Performance Benchmarks](../benchmarks.md)
