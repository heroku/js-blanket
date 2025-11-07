# JS Blanket - Spike/Demo Instructions

Quick guide to demonstrate the spike to the principal developer.

## Quick Start

```bash
# Run the interactive demo (visual demonstration)
pnpm spike

# Run the test suite (validation)
pnpm test
```

## What This Demonstrates

This spike proves the core concepts from the
[JS Blanket Discovery Document](./docs.local/js-blanket-discovery.md):

### ✅ Core Architecture

- **Generic scrubber engine** - Works for exception handlers AND logging AND
  custom use cases
- **Three scrubbing modes** - Field-based, path-based, and pattern-based (can be
  combined)
- **Production-ready features** - Circular reference handling, immutability,
  type safety
- **Thin adapter pattern** - 20-50 line wrappers around the core (see
  `generic.ts`)

### ✅ Test Coverage

- **27 passing tests** covering all scrubbing modes
- **96.76% code coverage** (299/309 statements)
- **All edge cases handled** - null, undefined, empty objects, primitives,
  circular refs

### ✅ Key Capabilities

1. **Field-Based Scrubbing** (scrubs at ANY depth)
   - `{ fields: ['password', 'api_key'] }`
   - Finds and scrubs these fields anywhere in the object tree

2. **Path-Based Scrubbing** (precise targeting)
   - `{ paths: ['user.profile.email'] }`
   - Only scrubs the specific path, not all email fields

3. **Pattern-Based Scrubbing** (content matching)
   - `{ patterns: [/\d{3}-\d{2}-\d{4}/g] }` (SSN pattern)
   - Scrubs PII embedded in string content

4. **Circular Reference Handling**
   - Detects and handles circular references without crashing
   - Returns `[Circular Reference]` instead of infinite loop

5. **Array Scrubbing**
   - Automatically scrubs sensitive fields across all array items
   - Works with deeply nested arrays

6. **Combined Modes**
   - All three modes work together seamlessly
   - Field + Path + Pattern scrubbing in one configuration

7. **Generic Logging Helper**
   - Framework-agnostic helper for custom integrations
   - Can replace `oauth-provider-adapters` `redaction.ts`

## File Structure

```
src/
├── core/
│   ├── types.ts           # TypeScript interfaces
│   ├── scrubber.ts        # Core engine (~200 lines)
│   ├── scrubber.test.ts   # 27 comprehensive tests
│   ├── presets.ts         # Field definitions (Heroku, GDPR, PCI)
│   └── patterns.ts        # Regex patterns (SSN, email, JWT)
├── adapters/
│   ├── exception-handlers/
│   │   └── sentry.ts      # Sentry adapter (~40 lines - thin adapter!)
│   └── logging/
│       └── generic.ts     # Generic helper (10 lines - thin adapter!)
├── index.ts               # Public API (18 lines)
└── demo.ts          # Interactive demonstration (315 lines)
```

## Demo Flow

### 1. Run the Spike Demo

```bash
pnpm spike
```

This shows 7 live demonstrations:

1. Field-based scrubbing (any depth)
2. Path-based scrubbing (precise)
3. Pattern-based scrubbing (content)
4. Circular reference handling
5. Array scrubbing
6. Combined modes
7. Generic logging helper usage

### 2. Run the Tests

```bash
pnpm test
```

Shows:

- ✅ All 27 tests passing
- 📊 96.76% code coverage
- ⚡ Fast execution (11ms)

### 3. Review the Code

**Most important files to review:**

1. `src/core/scrubber.ts` - Core implementation (~200 lines)
2. `src/core/scrubber.test.ts` - Comprehensive test coverage
3. `src/adapters/logging/generic.ts` - Example thin adapter (10 lines!)
4. `SPIKE-README.md` - Full documentation

## Questions to Discuss

1. **Architecture**: Does the Scrubber + thin adapter pattern make sense?
   - Core is ~200 lines, adapters are 10-50 lines each
   - Provider-agnostic, reusable for exception handlers AND logging

2. **Dual Mode**: Is field-based + path-based configuration too complex?
   - Field-based: simple, covers 90% of cases (`fields: ['password']`)
   - Path-based: precise when needed (`paths: ['user.email']`)
   - Both modes can be combined

3. **Scope**: Should we expand to logging redaction?
   - Discovery doc proposes covering BOTH exception handling AND logging
   - Same core engine, different thin adapters
   - Replaces 4 scattered implementations with 1 unified library

4. **Performance**: Is <10ms per event (p95) acceptable?
   - Current implementation is fast (tests run in 11ms for 27 cases)
   - Performance benchmarks planned for Phase 1

5. **Migration**: Direct integration for DefaultLogger?
   - Discovery proposes updating DefaultLogger to use `createRedactor()`
   - Delete old `redaction.ts` (100 lines removed)
   - Gains enhanced capabilities (circular refs, field matching, patterns)

## Next Steps (If Approved)

See [Discovery Document](./docs.local/js-blanket-discovery.md) for full 7-week
implementation plan:

- **Week 1**: Complete core engine + performance benchmarks
- **Week 2**: Exception handler adapters (Sentry, Rollbar)
- **Week 3**: Logging adapters (Winston, Pino, generic)
- **Week 4**: Documentation + examples
- **Week 5-7**: Production rollout

## Technical Highlights

### Immutability

All operations create new objects - original data is never mutated.

### Type Safety

Full TypeScript support with generics:

```typescript
scrub<T>(obj: T): ScrubResult<T>
```

### Performance

- O(1) path lookups (Set-based)
- Single-pass traversal
- Efficient deep cloning

### Patterns Adopted

From `oauth-provider-adapters` `redaction.ts`:

- ✅ Nested path resolution
- ✅ General array path handling
- ✅ Immutable object creation
- ✅ Type-safe generics

### Enhanced Beyond redaction.ts

- ✅ Circular reference detection
- ✅ Field-based matching (in addition to path-based)
- ✅ Regex pattern matching for content
- ✅ Scrubbed path tracking

---

**Status**: 🚀 Ready for principal developer review

**Full Context**: See
[JS Blanket Discovery Document](./docs.local/js-blanket-discovery.md)
