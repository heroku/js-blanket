// Ensure logs are silenced during test runs
if (!process.env.MCP_OAUTH_LOG_LEVEL && !process.env.LOG_LEVEL) {
  process.env.MCP_OAUTH_LOG_LEVEL = 'silent';
  process.env.LOG_LEVEL = 'silent';
}

// Suppress structured logger output objects while preserving Mocha output
const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);

function shouldSuppress(args) {
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    const msg = args[0];
    const hasStructuredShape =
      Object.prototype.hasOwnProperty.call(msg, 'message') &&
      Object.prototype.hasOwnProperty.call(msg, 'level');
    return hasStructuredShape;
  }
  return false;
}

console.log = (...args) => {
  if (shouldSuppress(args)) return;
  originalLog(...args);
};

console.error = (...args) => {
  if (shouldSuppress(args)) return;
  originalError(...args);
};
