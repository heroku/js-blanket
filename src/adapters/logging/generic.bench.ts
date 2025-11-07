/**
 * Performance Benchmarks for Generic Logging Adapter
 *
 * Target from discovery document:
 * - Logging: <1ms p95 latency per log statement
 *
 * This benchmark focuses on typical logging scenarios to ensure
 * the adapter adds minimal overhead to logging operations.
 */

import { performance } from 'node:perf_hooks';
import { createRedactor } from './generic.js';
import { HEROKU_FIELDS, GDPR_FIELDS, PCI_FIELDS } from '../../core/presets.js';

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate a typical log entry (~200 bytes)
 */
function generateTypicalLogEntry(index: number): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `User action ${index}`,
    userId: `user-${index}`,
    email: `user${index}@example.com`,
    sessionId: `session-${index}`,
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  };
}

/**
 * Generate a complex log entry with nested data (~1KB)
 */
function generateComplexLogEntry(index: number): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'API request completed',
    request: {
      method: 'POST',
      url: '/api/users',
      headers: {
        'user-agent': 'Mozilla/5.0',
        authorization: `Bearer token-${index}`,
        'x-api-key': `key-${index}`,
      },
      body: {
        username: `user${index}`,
        email: `user${index}@example.com`,
        password: `password${index}`,
      },
    },
    response: {
      status: 200,
      duration: 42,
    },
    user: {
      id: `user-${index}`,
      email: `user${index}@example.com`,
      role: 'admin',
    },
    metadata: {
      region: 'us-east-1',
      environment: 'production',
    },
  };
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
  logsPerSecond: number;
}

/**
 * Run a benchmark with multiple iterations and calculate statistics
 */
function runBenchmark(
  name: string,
  fn: () => void,
  iterations: number = 5000
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
  const logsPerSecond = 1000 / avgMs;

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
    logsPerSecond,
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
  console.log(`  Avg: ${result.avgMs.toFixed(4)}ms`);
  console.log(`  Median: ${result.medianMs.toFixed(4)}ms`);
  console.log(
    `  p95: ${result.p95Ms.toFixed(4)}ms ${target?.p95Ms ? `(target: <${target.p95Ms}ms)` : ''}`
  );
  console.log(`  p99: ${result.p99Ms.toFixed(4)}ms`);
  console.log(`  Min: ${result.minMs.toFixed(4)}ms`);
  console.log(`  Max: ${result.maxMs.toFixed(4)}ms`);
  console.log(`  Logs/sec: ${result.logsPerSecond.toFixed(0)}`);
}

// ============================================================================
// Benchmark Scenarios
// ============================================================================

function benchmarkSimpleLogging() {
  const redactor = createRedactor({
    fields: ['password', 'apiToken'],
  });

  let index = 0;
  return runBenchmark('Simple logging (minimal config)', () => {
    const entry = generateTypicalLogEntry(index++);
    redactor.scrub(entry);
  });
}

function benchmarkHerokuFieldsLogging() {
  const redactor = createRedactor({
    fields: HEROKU_FIELDS,
  });

  let index = 0;
  return runBenchmark('Logging with HEROKU_FIELDS preset', () => {
    const entry = generateTypicalLogEntry(index++);
    redactor.scrub(entry);
  });
}

function benchmarkAllPresetsLogging() {
  const redactor = createRedactor({
    fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
  });

  let index = 0;
  return runBenchmark('Logging with all presets', () => {
    const entry = generateTypicalLogEntry(index++);
    redactor.scrub(entry);
  });
}

function benchmarkComplexLogging() {
  const redactor = createRedactor({
    fields: [...HEROKU_FIELDS, ...GDPR_FIELDS],
    paths: ['request.headers.authorization', 'request.body.password'],
  });

  let index = 0;
  return runBenchmark('Complex logging (nested objects, paths)', () => {
    const entry = generateComplexLogEntry(index++);
    redactor.scrub(entry);
  });
}

function benchmarkHighVolumeStream() {
  const redactor = createRedactor({
    fields: HEROKU_FIELDS,
  });

  const iterations = 10000;
  const entries: Array<Record<string, unknown>> = [];

  // Pre-generate entries
  for (let i = 0; i < iterations; i++) {
    entries.push(generateTypicalLogEntry(i));
  }

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    redactor.scrub(entries[i]);
  }

  const end = performance.now();
  const totalSeconds = (end - start) / 1000;
  const logsPerSecond = iterations / totalSeconds;

  return {
    name: 'High-volume logging stream (10k entries)',
    iterations,
    totalMs: end - start,
    logsPerSecond,
  };
}

function benchmarkWinstonIntegration() {
  // Simulate Winston integration overhead
  const redactor = createRedactor({ fields: HEROKU_FIELDS });

  let index = 0;
  return runBenchmark('Winston integration pattern', () => {
    // Simulate Winston's log format
    const logEntry = {
      level: 'info',
      message: 'User action',
      metadata: generateTypicalLogEntry(index++),
      timestamp: new Date().toISOString(),
    };
    redactor.scrub(logEntry);
  });
}

function benchmarkPinoIntegration() {
  // Simulate Pino integration overhead
  const redactor = createRedactor({ fields: HEROKU_FIELDS });

  let index = 0;
  return runBenchmark('Pino integration pattern', () => {
    // Simulate Pino's flat log format
    const logEntry = {
      level: 30,
      time: Date.now(),
      msg: 'User action',
      ...generateTypicalLogEntry(index++),
    };
    redactor.scrub(logEntry);
  });
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

function main() {
  console.log('='.repeat(70));
  console.log('Performance Benchmarks - Generic Logging Adapter');
  console.log('='.repeat(70));

  console.log('\n🎯 Performance Target:');
  console.log('  Logging: <1ms p95 latency per log statement');

  // Run benchmarks
  const results: BenchmarkResult[] = [];

  console.log('\n' + '='.repeat(70));
  console.log('SIMPLE LOGGING SCENARIOS');
  console.log('='.repeat(70));

  let result = benchmarkSimpleLogging();
  results.push(result);
  printResult(result, { p95Ms: 1 });

  result = benchmarkHerokuFieldsLogging();
  results.push(result);
  printResult(result, { p95Ms: 1 });

  result = benchmarkAllPresetsLogging();
  results.push(result);
  printResult(result, { p95Ms: 1 });

  console.log('\n' + '='.repeat(70));
  console.log('COMPLEX LOGGING SCENARIOS');
  console.log('='.repeat(70));

  result = benchmarkComplexLogging();
  results.push(result);
  printResult(result, { p95Ms: 1 });

  console.log('\n' + '='.repeat(70));
  console.log('LOGGING LIBRARY INTEGRATION');
  console.log('='.repeat(70));

  result = benchmarkWinstonIntegration();
  results.push(result);
  printResult(result, { p95Ms: 1 });

  result = benchmarkPinoIntegration();
  results.push(result);
  printResult(result, { p95Ms: 1 });

  console.log('\n' + '='.repeat(70));
  console.log('HIGH-VOLUME SCENARIOS');
  console.log('='.repeat(70));

  const volumeResult = benchmarkHighVolumeStream();
  console.log(`\n${volumeResult.name} ✅`);
  console.log(`  Iterations: ${volumeResult.iterations}`);
  console.log(`  Total Time: ${volumeResult.totalMs.toFixed(2)}ms`);
  console.log(`  Logs/sec: ${volumeResult.logsPerSecond.toFixed(0)}`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const allPass = results.every((r) => r.p95Ms <= 1);
  const maxP95 = Math.max(...results.map((r) => r.p95Ms));
  const minLogsPerSec = Math.min(...results.map((r) => r.logsPerSecond));
  const avgLogsPerSec =
    results.reduce((sum, r) => sum + r.logsPerSecond, 0) / results.length;

  console.log(
    `\n  All scenarios < 1ms p95: ${allPass ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(`  Worst case p95: ${maxP95.toFixed(4)}ms`);
  console.log(`  Minimum throughput: ${minLogsPerSec.toFixed(0)} logs/sec`);
  console.log(`  Average throughput: ${avgLogsPerSec.toFixed(0)} logs/sec`);
  console.log(
    `  High-volume throughput: ${volumeResult.logsPerSecond.toFixed(0)} logs/sec`
  );

  console.log(
    `\n  Overall: ${allPass ? '✅ ALL TARGETS MET' : '❌ SOME TARGETS MISSED'}\n`
  );

  // Exit with appropriate code
  process.exit(allPass ? 0 : 1);
}

main();
