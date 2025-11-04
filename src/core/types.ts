/**
 * Configuration for the Scrubber
 */
export interface ScrubConfig {
  // Field-based scrubbing: matches field names at any depth
  fields?: (string | RegExp)[];

  // Path-based scrubbing: matches specific dot-notation paths
  // Examples: 'user.email', 'items.0.secret', 'request.headers.Authorization'
  paths?: string[];

  // Pattern-based scrubbing: regex patterns for content (SSN, credit cards, etc.)
  patterns?: RegExp[];

  replacement?: string;
  recursive?: boolean;
}

/**
 * Result of a scrub operation
 */
export interface ScrubResult<T> {
  data: T;
  scrubbed: boolean;
  scrubbedPaths: string[];
}
