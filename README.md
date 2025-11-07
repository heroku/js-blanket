# Heroku JS Blanket

A framework-agnostic sensitive data scrubbing library for logging, exception
handling, and monitoring services for NodeJS and JavaScript projects. JS Blanket
has you coverd.

This project provides a core scrubbing engine with preset field lists for common
PII patterns, and ready-to-use adapters for popular error monitoring and logging
platforms.

## Features

- **Deep Object Traversal**: Handles nested objects, arrays, and circular
  references safely
- **Multiple Scrubbing Modes**: Field-based, path-based, and pattern-based
  scrubbing
- **Immutable Operations**: Never modifies input data - always returns new
  objects
- **Preset Field Lists**: Battle-tested PII patterns (HEROKU_FIELDS,
  GDPR_FIELDS, PCI_FIELDS)

## Quick Start

### Installation

```bash
# npm
npm install @heroku/node-sentry-blanket

# pnpm
pnpm add @heroku/node-sentry-blanket

# yarn
yarn add @heroku/node-sentry-blanket
```

### Usage Examples

Framework-specific examples
[here](https://github.com/heroku/js-blanket/tree/main/docs/examples).

## Core Scrubber API

The `Scrubber` class provides flexible PII scrubbing with three modes:

### Field-Based Scrubbing

Scrubs values based on field names (exact match or regex):

```typescript
import { Scrubber } from '@heroku/node-sentry-blanket';

const scrubber = new Scrubber({
  fields: ['password', 'apiToken', /.*_token$/i],
  replacement: '[REDACTED]',
});

const data = {
  user: 'john',
  password: 'secret123',
  oauth_token: 'abc-def-ghi',
};

const result = scrubber.scrub(data);
// Result: { user: 'john', password: '[REDACTED]', oauth_token: '[REDACTED]' }
```

### Path-Based Scrubbing

Scrubs values at specific paths using dot notation:

```typescript
const scrubber = new Scrubber({
  paths: ['user.email', 'user.profile.ssn'],
});

const data = {
  user: {
    name: 'John',
    email: 'john@example.com',
    profile: { ssn: '123-45-6789' },
  },
};

const result = scrubber.scrub(data);
// Result: { user: { name: 'John', email: '[SCRUBBED]', profile: { ssn: '[SCRUBBED]' } } }
```

### Pattern-Based Scrubbing

Scrubs content matching regex patterns:

```typescript
const scrubber = new Scrubber({
  patterns: [
    /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, // Email addresses
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN patterns
    /\b\d{13,19}\b/g, // Credit card numbers
  ],
});

const data = {
  message: 'Contact john@example.com or call 123-45-6789',
};

const result = scrubber.scrub(data);
// Result: { message: 'Contact [SCRUBBED] or call [SCRUBBED]' }
```

## Preset Field Lists

Use battle-tested preset field lists for common PII patterns:

```typescript
import {
  HEROKU_FIELDS,
  GDPR_FIELDS,
  PCI_FIELDS,
} from '@heroku/node-sentry-blanket';

// Heroku-specific sensitive fields
const scrubber = new Scrubber({
  fields: HEROKU_FIELDS, // heroku_oauth_token, sudo_oauth_token, www-sso-session, etc.
});

// GDPR compliance fields
const gdprScrubber = new Scrubber({
  fields: GDPR_FIELDS, // email, ip_address, phone_number, ssn, date_of_birth, etc.
});

// PCI compliance fields
const pciScrubber = new Scrubber({
  fields: PCI_FIELDS, // credit_card, cvv, card_number, expiration_date, etc.
});

// Combine multiple presets
const scrubber = new Scrubber({
  fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
});
```

## Code Quality and Testing

This project uses pnpm for package management and includes comprehensive code
quality tools to maintain high standards.

### Available Scripts

A list of useful scripts when developing against the codebase:

```bash
# All code quality checks and tests
pnpm check

# Run the full test suite with coverage reporting
pnpm test

# Check code quality with ESLint
pnpm lint

# Automatically fix linting issues and format code with Prettier
pnpm format

# Run TypeScript type checking
pnpm type-check

# Run the continuous integration checks (linting, type checking, and tests)
pnpm ci
```

## Development Workflow

For the best development experience:

1. **Before starting work**: Ensure dependencies are installed with
   `pnpm install`.
2. **During development**: Run `pnpm type-check` periodically to catch type
   errors early.
3. **Before committing**: Run `pnpm check` to ensure all quality standards are
   met.
4. **Fix issues quickly**: Use `pnpm format` to auto-fix formatting and linting
   issues.

### Testing Requirements

Tests are located in `src/**/*.test.ts` and run against the compiled JavaScript
in `dist/`. The test suite includes:

- Unit tests for all public APIs
- Integration tests with Sentry SDK
- Type safety validation tests
- Coverage reporting with c8 (HTML and text-summary)

Tests automatically run in silent mode (`LOG_LEVEL=silent`) to keep output
clean.

### Build Outputs

The library produces dual builds for maximum compatibility:

- **CommonJS** (`dist/cjs/`): Use for Node.js and older bundlers
- **ES Modules** (`dist/esm/`): Use for modern bundlers and tree-shaking support

Both outputs include TypeScript declaration files (`.d.ts`) for type
information.

## License

Apache-2.0. See `LICENSE` for details.

## Contributing

We welcome issues and PRs. Please follow conventional commits, keep changes
under 200 lines per commit, and ensure tests and type checks pass. See
`CONTRIBUTING.md` for details.

## Documentation

For more detailed examples and use cases:

- [Sentry Integration Examples](docs/examples/sentry-integration.md)
- [Logging Integration Examples](docs/examples/logging-integration.md)
- [Migration Guides](docs/MIGRATION.md)
- [Project Status](docs/PROJECT-STATUS.md)
