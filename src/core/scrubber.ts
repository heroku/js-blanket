import { ScrubConfig, ScrubResult } from './types.js';

/**
 * Core scrubber class - handles deep object traversal with circular reference detection
 *
 * Patterns adopted from oauth-provider-adapters-for-mcp/src/logging/redaction.ts:
 * - Nested path resolution
 * - General array path handling
 * - Immutable object creation
 * - Type-safe generics
 *
 * Enhanced with:
 * - Circular reference detection
 * - Field-based matching (in addition to path-based)
 * - Regex pattern matching for content scrubbing
 */
export class Scrubber {
  private config: Required<ScrubConfig>;
  private circularRefs = new WeakSet();
  private pathSet: Set<string>;

  constructor(config: ScrubConfig) {
    this.config = {
      fields: config.fields || [],
      paths: config.paths || [],
      patterns: config.patterns || [],
      replacement: config.replacement || '[SCRUBBED]',
      recursive: config.recursive !== undefined ? config.recursive : true,
    };

    // Pre-compute path set for O(1) lookups
    this.pathSet = new Set(this.config.paths);
  }

  /**
   * Deep scrub an object, handling circular references
   */
  scrub<T>(obj: T): ScrubResult<T> {
    const scrubbedPaths: string[] = [];
    const cloned = this.deepClone(obj);

    // Reset circular refs tracker for each scrub operation
    this.circularRefs = new WeakSet();

    const scrubbed = this.scrubObject(cloned, '', scrubbedPaths);

    return {
      data: scrubbed,
      scrubbed: scrubbedPaths.length > 0,
      scrubbedPaths,
    };
  }

  private scrubObject(obj: any, path: string, paths: string[]): any {
    // Handle circular references
    if (obj && typeof obj === 'object') {
      if (this.circularRefs.has(obj)) {
        return '[Circular Reference]';
      }
      this.circularRefs.add(obj);
    }

    // Handle primitives
    if (obj === null || typeof obj !== 'object') {
      return this.scrubValue(obj, path, paths);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item, index) => {
        const indexStr = index.toString();
        const arrayPath = path ? `${path}[${index}]` : indexStr;

        // Check if this specific array index path should be scrubbed
        if (this.pathSet.has(indexStr) || this.pathSet.has(arrayPath)) {
          paths.push(arrayPath);
          return this.config.replacement;
        }

        // Recursively scrub array items
        return this.scrubObject(item, arrayPath, paths);
      });
    }

    // Handle objects - create new object (immutable approach)
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const keyPath = path ? `${path}.${key}` : key;

      // Check if this specific path should be scrubbed
      if (this.pathSet.has(key) || this.pathSet.has(keyPath)) {
        result[key] = this.config.replacement;
        paths.push(keyPath);
        continue;
      }

      // Check if key matches sensitive field pattern
      if (this.isSensitiveField(key)) {
        result[key] = this.config.replacement;
        paths.push(keyPath);
        continue;
      }

      // Recursively scrub value
      result[key] = this.config.recursive
        ? this.scrubObject(value, keyPath, paths)
        : this.scrubValue(value, keyPath, paths);
    }

    return result;
  }

  private scrubValue(value: any, path: string, paths: string[]): any {
    if (typeof value !== 'string') {
      return value;
    }

    let scrubbed = value;
    let didScrub = false;

    // Check against patterns (SSN, credit cards, etc.)
    for (const pattern of this.config.patterns) {
      if (pattern.test(scrubbed)) {
        scrubbed = scrubbed.replace(pattern, this.config.replacement);
        didScrub = true;
      }
    }

    if (didScrub) {
      paths.push(path);
    }

    return scrubbed;
  }

  /**
   * Check if a field name matches any configured sensitive field patterns
   */
  private isSensitiveField(key: string): boolean {
    return this.config.fields.some((field) => {
      if (field instanceof RegExp) {
        return field.test(key);
      }
      return key.toLowerCase().includes(field.toLowerCase());
    });
  }

  private deepClone<T>(obj: T): T {
    try {
      // Fast path for JSON-serializable objects
      return JSON.parse(JSON.stringify(obj));
    } catch {
      // Fallback for objects with circular references
      const seen = new WeakMap();

      function clone(value: any): any {
        if (value === null || typeof value !== 'object') {
          return value;
        }

        if (seen.has(value)) {
          return seen.get(value);
        }

        if (Array.isArray(value)) {
          const arr: any[] = [];
          seen.set(value, arr);
          value.forEach((item, i) => {
            arr[i] = clone(item);
          });
          return arr;
        }

        const obj: any = {};
        seen.set(value, obj);
        Object.keys(value).forEach((key) => {
          obj[key] = clone(value[key]);
        });
        return obj;
      }

      return clone(obj);
    }
  }
}
