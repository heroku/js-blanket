/**
 * Performance Benchmarks for Core Scrubber
 *
 * Targets from discovery document:
 * - Exception handling: <10ms p95 latency
 * - Logging: <1ms p95 latency
 * - Throughput: 1000+ events/sec
 * - Test with 10KB+ JSON payloads
 */

import { performance } from 'node:perf_hooks';
import { Scrubber } from './scrubber.js';
import { HEROKU_FIELDS, GDPR_FIELDS, PCI_FIELDS } from './presets.js';

// Common PII paths for benchmarking
const COMMON_PII_PATHS = [
  'user.password',
  'user.email',
  'request.headers.authorization',
  'request.headers.cookie',
  'request.body.password',
  'payment.creditCard',
  'payment.cvv',
];

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate a small object (typical log entry, ~100 bytes)
 */
function generateSmallObject(): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'User login successful',
    userId: 'user-12345',
    email: 'john.doe@example.com',
    ip: '192.168.1.1',
  };
}

/**
 * Generate a medium object (typical error event, ~1-2KB)
 */
function generateMediumObject(): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: 'Database connection failed',
    user: {
      id: 'user-12345',
      email: 'john.doe@example.com',
      name: 'John Doe',
      password: 'secret123',
      apiToken: 'sk_live_abc123xyz',
      creditCard: '4532-1234-5678-9010',
    },
    request: {
      method: 'POST',
      url: '/api/users',
      headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'x-api-key': 'pk_test_123456789',
        'user-agent': 'Mozilla/5.0',
      },
      body: {
        username: 'johndoe',
        password: 'secret123',
        email: 'john.doe@example.com',
      },
    },
    stackTrace: [
      'Error: Database connection failed',
      '    at DatabaseService.connect (/app/db.js:42:15)',
      '    at async Server.handleRequest (/app/server.js:128:9)',
    ],
    context: {
      environment: 'production',
      version: '1.2.3',
      region: 'us-east-1',
    },
  };
}

/**
 * Generate a large object (10KB+ JSON payload)
 */
function generateLargeObject(): Record<string, unknown> {
  const users: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 100; i++) {
    users.push({
      id: `user-${i}`,
      email: `user${i}@example.com`,
      name: `User ${i}`,
      password: `password${i}`,
      ssn: `${String(i).padStart(3, '0')}-${String(i).padStart(2, '0')}-${String(i).padStart(4, '0')}`,
      creditCard: `4532-${String(i).padStart(4, '0')}-${String(i).padStart(4, '0')}-${String(i).padStart(4, '0')}`,
      address: {
        street: `${i} Main St`,
        city: 'Springfield',
        state: 'IL',
        zip: `${String(i).padStart(5, '0')}`,
        country: 'USA',
      },
      metadata: {
        lastLogin: new Date().toISOString(),
        loginCount: i * 10,
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: true,
        },
      },
    });
  }

  return {
    timestamp: new Date().toISOString(),
    event: 'bulk_user_sync',
    users,
    metadata: {
      totalCount: users.length,
      syncId: 'sync-123456',
      duration: 1234,
    },
  };
}

/**
 * Verify object size
 */
function getObjectSize(obj: unknown): number {
  return JSON.stringify(obj).length;
}

// ============================================================================
// Benchmark Utilities
// ============================================================================

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  opsPerSecond: number;
  samples: number[];
}

/**
 * Run a benchmark with multiple iterations and calculate statistics
 */
function runBenchmark(
  name: string,
  fn: () => void,
  iterations: number = 1000
): BenchmarkResult {
  const samples: number[] = [];

  // Warm-up
  for (let i = 0; i < 100; i++) {
    fn();
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    samples.push(end - start);
  }

  // Calculate statistics
  samples.sort((a, b) => a - b);
  const totalMs = samples.reduce((sum, val) => sum + val, 0);
  const avgMs = totalMs / iterations;
  const medianMs = samples[Math.floor(iterations / 2)] ?? 0;
  const p95Ms = samples[Math.floor(iterations * 0.95)] ?? 0;
  const p99Ms = samples[Math.floor(iterations * 0.99)] ?? 0;
  const minMs = samples[0] ?? 0;
  const maxMs = samples[iterations - 1] ?? 0;
  const opsPerSecond = 1000 / avgMs;

  return {
    name,
    iterations,
    totalMs,
    avgMs,
    medianMs,
    p95Ms,
    p99Ms,
    minMs,
    maxMs,
    opsPerSecond,
    samples,
  };
}

/**
 * Print benchmark results
 */
function printResult(result: BenchmarkResult, target?: { p95Ms?: number }) {
  const passOrFail =
    target?.p95Ms !== undefined
      ? result.p95Ms <= target.p95Ms
        ? '✅ PASS'
        : '❌ FAIL'
      : '';

  console.log(`\n${result.name} ${passOrFail}`);
  console.log(`  Iterations: ${result.iterations}`);
  console.log(`  Avg: ${result.avgMs.toFixed(3)}ms`);
  console.log(`  Median: ${result.medianMs.toFixed(3)}ms`);
  console.log(
    `  p95: ${result.p95Ms.toFixed(3)}ms ${target?.p95Ms ? `(target: <${target.p95Ms}ms)` : ''}`
  );
  console.log(`  p99: ${result.p99Ms.toFixed(3)}ms`);
  console.log(`  Min: ${result.minMs.toFixed(3)}ms`);
  console.log(`  Max: ${result.maxMs.toFixed(3)}ms`);
  console.log(`  Ops/sec: ${result.opsPerSecond.toFixed(0)}`);
}

// ============================================================================
// Benchmark Scenarios
// ============================================================================

function benchmarkSmallObjectFieldBased() {
  const scrubber = new Scrubber({ fields: ['password', 'apiToken'] });
  const data = generateSmallObject();
  return runBenchmark('Small Object - Field-Based (typical log entry)', () => {
    scrubber.scrub(data);
  });
}

function benchmarkMediumObjectFieldBased() {
  const scrubber = new Scrubber({
    fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
  });
  const data = generateMediumObject();
  return runBenchmark(
    'Medium Object - Field-Based (typical error event)',
    () => {
      scrubber.scrub(data);
    }
  );
}

function benchmarkLargeObjectFieldBased() {
  const scrubber = new Scrubber({
    fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
  });
  const data = generateLargeObject();
  return runBenchmark(
    'Large Object - Field-Based (10KB+ payload)',
    () => {
      scrubber.scrub(data);
    },
    500 // Fewer iterations for large objects
  );
}

function benchmarkMediumObjectPathBased() {
  const scrubber = new Scrubber({ paths: COMMON_PII_PATHS });
  const data = generateMediumObject();
  return runBenchmark('Medium Object - Path-Based', () => {
    scrubber.scrub(data);
  });
}

function benchmarkMediumObjectPatternBased() {
  const scrubber = new Scrubber({
    patterns: [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\d{4}-\d{4}-\d{4}-\d{4}/g, // Credit card
      /Bearer\s+[A-Za-z0-9._-]+/g, // Bearer token
    ],
  });
  const data = generateMediumObject();
  return runBenchmark('Medium Object - Pattern-Based (regex)', () => {
    scrubber.scrub(data);
  });
}

function benchmarkCombinedScrubbing() {
  const scrubber = new Scrubber({
    fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
    paths: COMMON_PII_PATHS,
    patterns: [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\d{4}-\d{4}-\d{4}-\d{4}/g, // Credit card
    ],
  });
  const data = generateMediumObject();
  return runBenchmark('Medium Object - Combined (all modes)', () => {
    scrubber.scrub(data);
  });
}

function benchmarkThroughput() {
  const scrubber = new Scrubber({
    fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
  });
  const data = generateMediumObject();

  const iterations = 10000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    scrubber.scrub(data);
  }

  const end = performance.now();
  const totalSeconds = (end - start) / 1000;
  const eventsPerSecond = iterations / totalSeconds;

  return {
    name: 'Throughput Test',
    iterations,
    totalMs: end - start,
    eventsPerSecond,
  };
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

function main() {
  console.log('='.repeat(70));
  console.log('Performance Benchmarks - Core Scrubber');
  console.log('='.repeat(70));

  // Verify test data sizes
  console.log('\n📊 Test Data Sizes:');
  console.log(`  Small: ${getObjectSize(generateSmallObject())} bytes`);
  console.log(`  Medium: ${getObjectSize(generateMediumObject())} bytes`);
  console.log(`  Large: ${getObjectSize(generateLargeObject())} bytes`);

  console.log('\n🎯 Performance Targets:');
  console.log('  Logging (small objects): <1ms p95');
  console.log('  Exception handling (medium objects): <10ms p95');
  console.log('  Throughput: >1000 events/sec');

  // Run benchmarks
  const results: BenchmarkResult[] = [];

  console.log('\n' + '='.repeat(70));
  console.log('LOGGING SCENARIOS (Target: <1ms p95)');
  console.log('='.repeat(70));

  let result = benchmarkSmallObjectFieldBased();
  results.push(result);
  printResult(result, { p95Ms: 1 });

  console.log('\n' + '='.repeat(70));
  console.log('EXCEPTION HANDLING SCENARIOS (Target: <10ms p95)');
  console.log('='.repeat(70));

  result = benchmarkMediumObjectFieldBased();
  results.push(result);
  printResult(result, { p95Ms: 10 });

  result = benchmarkMediumObjectPathBased();
  results.push(result);
  printResult(result, { p95Ms: 10 });

  result = benchmarkMediumObjectPatternBased();
  results.push(result);
  printResult(result, { p95Ms: 10 });

  result = benchmarkCombinedScrubbing();
  results.push(result);
  printResult(result, { p95Ms: 10 });

  console.log('\n' + '='.repeat(70));
  console.log('LARGE PAYLOAD SCENARIOS (10KB+)');
  console.log('='.repeat(70));

  result = benchmarkLargeObjectFieldBased();
  results.push(result);
  printResult(result);

  console.log('\n' + '='.repeat(70));
  console.log('THROUGHPUT TEST (Target: >1000 events/sec)');
  console.log('='.repeat(70));

  const throughputResult = benchmarkThroughput();
  const throughputPass = throughputResult.eventsPerSecond >= 1000;
  console.log(
    `\n${throughputResult.name} ${throughputPass ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(`  Iterations: ${throughputResult.iterations}`);
  console.log(`  Total Time: ${throughputResult.totalMs.toFixed(2)}ms`);
  console.log(
    `  Events/sec: ${throughputResult.eventsPerSecond.toFixed(0)} (target: >1000)`
  );

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const loggingResults = results.filter((r) => r.name.includes('Small Object'));
  const exceptionResults = results.filter((r) =>
    r.name.includes('Medium Object')
  );

  const loggingPass = loggingResults.every((r) => r.p95Ms <= 1);
  const exceptionPass = exceptionResults.every((r) => r.p95Ms <= 10);

  console.log(`\n  Logging (<1ms p95): ${loggingPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(
    `  Exception Handling (<10ms p95): ${exceptionPass ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(
    `  Throughput (>1000 events/sec): ${throughputPass ? '✅ PASS' : '❌ FAIL'}`
  );

  const allPass = loggingPass && exceptionPass && throughputPass;
  console.log(
    `\n  Overall: ${allPass ? '✅ ALL TARGETS MET' : '❌ SOME TARGETS MISSED'}\n`
  );

  // Exit with appropriate code
  process.exit(allPass ? 0 : 1);
}

main();
