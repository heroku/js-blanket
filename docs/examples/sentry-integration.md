# Sentry Integration with JS Blanket

Quick reference for integrating js-blanket with Sentry's `beforeSend` and
`beforeSendTransaction` hooks. For Sentry-specific configuration and
troubleshooting, see
[Sentry's official documentation](https://docs.sentry.io/platforms/javascript/).

## Installation

Install js-blanket and the appropriate Sentry SDK for your platform:

```bash
npm install @heroku/js-blanket
```

For Sentry installation, see
[Sentry's platform-specific installation guides](https://docs.sentry.io/platforms/)
(available for Ember, React, Node.js, Next.js, and more).

## Basic Integration

Create a scrubber and use it in `beforeSend`—this covers most use cases:

```javascript
import * as Sentry from '@sentry/browser'; // or @sentry/node, @sentry/react, etc.
import { Scrubber, HEROKU_FIELDS } from '@heroku/js-blanket';

// Create scrubber once at module load
const scrubber = new Scrubber({
  fields: HEROKU_FIELDS, // Scrubs field names like password, oauth_token, etc.
});

// Initialize Sentry with PII scrubbing
Sentry.init({
  ...,

  beforeSend(event, hint) {
    return scrubber.scrub(event).data;
  },
});
```

**What this does:** Scrubs any field matching names in `HEROKU_FIELDS` (like
`password`, `oauth_token`, `api_key`, etc.) throughout the event object.

## Scrubbing Event Data: Fields, Paths, and Patterns

Combine field-based, path-based, and pattern-based scrubbing for comprehensive
coverage:

```javascript
import * as Sentry from '@sentry/browser'; // or @sentry/node, @sentry/react, etc.
import { Scrubber, GDPR_FIELDS, PCI_FIELDS } from '@heroku/js-blanket';

const scrubber = new Scrubber({
  fields: [...GDPR_FIELDS, ...PCI_FIELDS], // Field name matching
  paths: ['user.email', 'request.headers.authorization'], // Specific paths
  patterns: [
    /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, // Email addresses in string content
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN patterns in string content
  ],
  replacement: '[REDACTED]',
});

Sentry.init({
  ...,

  beforeSend(event, hint) {
    return scrubber.scrub(event).data;
  },
});
```

**Field vs Pattern scrubbing:**

- **Fields:** Match by field name (`{ email: "user@example.com" }` →
  `{ email: "[REDACTED]" }`)
- **Patterns:** Match content in strings (`"Contact user@example.com"` →
  `"Contact [REDACTED]"`)
- Use patterns when PII might appear in log messages, error messages, or other
  string content

## Scrubbing Breadcrumbs

Breadcrumbs capture user actions and network requests. Scrub them separately if
they contain sensitive data:

```javascript
import * as Sentry from '@sentry/browser'; // or @sentry/node, @sentry/react, etc.
import { Scrubber, HEROKU_FIELDS } from '@heroku/js-blanket';

const scrubber = new Scrubber({
  fields: [...HEROKU_FIELDS],
  patterns: [/Bearer\s+[\w-]+/gi], // Auth tokens
});

Sentry.init({
  ...,

  beforeSend(event, hint) {
    // Scrub breadcrumbs if present
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

### Notes

- **Initialize early**: Set up Sentry before your app code runs to catch early
  errors
- **Create scrubber once**: Reuse the same instance (operations are immutable)

## Additional Resources

- [Logging Examples](./logging-integration.md)
- [Core Scrubber API](../../README.md#core-scrubber)
- [Preset Field Lists](../../README.md#preset-field-lists)
-
