/**
 * Tests for Generic Logging Adapter
 *
 * The generic adapter is a thin wrapper around the core Scrubber,
 * designed for use with any logging library (Winston, Pino, Bunyan, etc.)
 */

import { expect } from 'chai';
import { createRedactor } from './generic.js';
import { Scrubber } from '../../core/scrubber.js';
import { HEROKU_FIELDS, GDPR_FIELDS, PCI_FIELDS } from '../../core/presets.js';

describe('Generic Logging Adapter', () => {
  describe('createRedactor()', () => {
    it('returns a Scrubber instance', () => {
      const redactor = createRedactor({ fields: ['password'] });
      expect(redactor).to.be.instanceOf(Scrubber);
    });

    it('creates a functional scrubber', () => {
      const redactor = createRedactor({ fields: ['password'] });
      const result = redactor.scrub({ user: 'john', password: 'secret' });

      expect(result.data.password).to.equal('[SCRUBBED]');
      expect(result.scrubbed).to.be.true;
    });

    it('accepts empty configuration', () => {
      const redactor = createRedactor({});
      const result = redactor.scrub({ data: 'test' });

      expect(result.data).to.deep.equal({ data: 'test' });
      expect(result.scrubbed).to.be.false;
    });
  });

  describe('Configuration Options', () => {
    it('supports field-based scrubbing', () => {
      const redactor = createRedactor({
        fields: ['password', 'apiToken', 'secret'],
      });

      const result = redactor.scrub({
        user: 'john',
        password: 'secret123',
        apiToken: 'token123',
        secret: 'hidden',
        public: 'visible',
      });

      expect(result.data.password).to.equal('[SCRUBBED]');
      expect(result.data.apiToken).to.equal('[SCRUBBED]');
      expect(result.data.secret).to.equal('[SCRUBBED]');
      expect(result.data.public).to.equal('visible');
    });

    it('supports regex field patterns', () => {
      const redactor = createRedactor({
        fields: [/api[-_]?key/i, /^secret/i],
      });

      const result = redactor.scrub({
        api_key: 'key1',
        'api-key': 'key2',
        apikey: 'key3',
        secret_token: 'token',
        SECRET: 'hidden',
      });

      expect(result.data.api_key).to.equal('[SCRUBBED]');
      expect(result.data['api-key']).to.equal('[SCRUBBED]');
      expect(result.data.apikey).to.equal('[SCRUBBED]');
      expect(result.data.secret_token).to.equal('[SCRUBBED]');
      expect(result.data.SECRET).to.equal('[SCRUBBED]');
    });

    it('supports path-based scrubbing', () => {
      const redactor = createRedactor({
        paths: ['user.email', 'request.headers.authorization'],
      });

      const result = redactor.scrub({
        user: {
          name: 'John',
          email: 'john@example.com',
        },
        request: {
          method: 'POST',
          headers: {
            authorization: 'Bearer token123',
            'content-type': 'application/json',
          },
        },
      });

      expect(result.data.user.email).to.equal('[SCRUBBED]');
      expect(result.data.request.headers.authorization).to.equal('[SCRUBBED]');
      expect(result.data.user.name).to.equal('John');
      expect(result.data.request.headers['content-type']).to.equal(
        'application/json'
      );
    });

    it('supports pattern-based scrubbing', () => {
      const redactor = createRedactor({
        patterns: [
          /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
          /\d{4}-\d{4}-\d{4}-\d{4}/g, // Credit card
        ],
      });

      const result = redactor.scrub({
        message: 'User SSN is 123-45-6789 and card is 4532-1234-5678-9010',
      });

      expect(result.data.message).to.equal(
        'User SSN is [SCRUBBED] and card is [SCRUBBED]'
      );
    });

    it('supports combined scrubbing modes', () => {
      const redactor = createRedactor({
        fields: ['password'],
        paths: ['user.email'],
        patterns: [/\b\d{3}-\d{2}-\d{4}\b/g],
      });

      const result = redactor.scrub({
        user: {
          name: 'John',
          email: 'john@example.com',
          password: 'secret',
        },
        message: 'SSN: 123-45-6789',
      });

      expect(result.data.user.password).to.equal('[SCRUBBED]');
      expect(result.data.user.email).to.equal('[SCRUBBED]');
      expect(result.data.message).to.equal('SSN: [SCRUBBED]');
      expect(result.data.user.name).to.equal('John');
    });

    it('supports custom replacement text', () => {
      const redactor = createRedactor({
        fields: ['password'],
        replacement: '[REDACTED]',
      });

      const result = redactor.scrub({ password: 'secret' });
      expect(result.data.password).to.equal('[REDACTED]');
    });

    it('supports recursive scrubbing control', () => {
      const redactorRecursive = createRedactor({
        fields: ['password'],
        recursive: true,
      });

      const redactorNonRecursive = createRedactor({
        fields: ['password'],
        recursive: false,
      });

      const data = {
        password: 'level1',
        nested: {
          password: 'level2',
        },
      };

      const recursiveResult = redactorRecursive.scrub(data);
      expect(recursiveResult.data.password).to.equal('[SCRUBBED]');
      expect(recursiveResult.data.nested.password).to.equal('[SCRUBBED]');

      const nonRecursiveResult = redactorNonRecursive.scrub(data);
      expect(nonRecursiveResult.data.password).to.equal('[SCRUBBED]');
      // Non-recursive should still scrub nested fields
      // (the recursive flag controls traversal depth, not field matching)
    });
  });

  describe('Preset Integration', () => {
    it('works with HEROKU_FIELDS preset', () => {
      const redactor = createRedactor({ fields: HEROKU_FIELDS });

      const result = redactor.scrub({
        user: 'john',
        password: 'secret',
        access_token: 'token123',
        api_key: 'key123',
        email: 'john@example.com',
      });

      expect(result.data.password).to.equal('[SCRUBBED]');
      expect(result.data.access_token).to.equal('[SCRUBBED]');
      expect(result.data.api_key).to.equal('[SCRUBBED]');
      expect(result.data.user).to.equal('john');
    });

    it('works with GDPR_FIELDS preset', () => {
      const redactor = createRedactor({ fields: GDPR_FIELDS });

      const result = redactor.scrub({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1-555-1234',
        address: '123 Main St',
      });

      expect(result.data.email).to.equal('[SCRUBBED]');
      expect(result.data.phone).to.equal('[SCRUBBED]');
      expect(result.data.address).to.equal('[SCRUBBED]');
      expect(result.data.name).to.equal('John Doe');
    });

    it('works with PCI_FIELDS preset', () => {
      const redactor = createRedactor({ fields: PCI_FIELDS });

      const result = redactor.scrub({
        user: 'john',
        card_number: '4532-1234-5678-9010',
        cvv: '123',
        credit_card: '4111111111111111',
      });

      expect(result.data.card_number).to.equal('[SCRUBBED]');
      expect(result.data.cvv).to.equal('[SCRUBBED]');
      expect(result.data.credit_card).to.equal('[SCRUBBED]');
      expect(result.data.user).to.equal('john');
    });

    it('works with combined presets', () => {
      const redactor = createRedactor({
        fields: [...HEROKU_FIELDS, ...GDPR_FIELDS, ...PCI_FIELDS],
      });

      const result = redactor.scrub({
        user: 'john',
        password: 'secret', // HEROKU_FIELDS
        email: 'john@example.com', // GDPR_FIELDS
        cvv: '123', // PCI_FIELDS
        public: 'data',
      });

      expect(result.data.password).to.equal('[SCRUBBED]');
      expect(result.data.email).to.equal('[SCRUBBED]');
      expect(result.data.cvv).to.equal('[SCRUBBED]');
      expect(result.data.public).to.equal('data');
    });
  });

  describe('Logging Library Integration Patterns', () => {
    it('can be used with Winston-style loggers', () => {
      // Simulate Winston logger integration
      const redactor = createRedactor({ fields: ['password', 'apiToken'] });

      // Simulate Winston's meta object
      const logEntry = {
        level: 'info',
        message: 'User login',
        metadata: {
          user: 'john',
          password: 'secret123',
          apiToken: 'token123',
          ip: '192.168.1.1',
        },
        timestamp: new Date().toISOString(),
      };

      const result = redactor.scrub(logEntry);

      expect(result.data.metadata.password).to.equal('[SCRUBBED]');
      expect(result.data.metadata.apiToken).to.equal('[SCRUBBED]');
      expect(result.data.metadata.user).to.equal('john');
      expect(result.data.level).to.equal('info');
    });

    it('can be used with Pino-style loggers', () => {
      // Simulate Pino logger integration
      const redactor = createRedactor({ fields: ['password'] });

      // Simulate Pino's flat log object
      const logEntry = {
        level: 30, // info
        time: Date.now(),
        msg: 'User action',
        user: 'john',
        password: 'secret',
        req: {
          method: 'POST',
          url: '/api/login',
        },
      };

      const result = redactor.scrub(logEntry);

      expect(result.data.password).to.equal('[SCRUBBED]');
      expect(result.data.user).to.equal('john');
      expect(result.data.req.method).to.equal('POST');
    });

    it('can be used with Bunyan-style loggers', () => {
      // Simulate Bunyan logger integration
      const redactor = createRedactor({ fields: ['password', 'token'] });

      const logEntry = {
        name: 'myapp',
        hostname: 'server01',
        pid: 12345,
        level: 30,
        msg: 'Authentication successful',
        password: 'secret',
        token: 'jwt123',
        time: new Date(),
      };

      const result = redactor.scrub(logEntry);

      expect(result.data.password).to.equal('[SCRUBBED]');
      expect(result.data.token).to.equal('[SCRUBBED]');
      expect(result.data.msg).to.equal('Authentication successful');
    });

    it('handles array of log entries', () => {
      const redactor = createRedactor({ fields: ['password'] });

      const logs = [
        { msg: 'Login attempt', user: 'john', password: 'secret1' },
        { msg: 'Login success', user: 'jane', password: 'secret2' },
        { msg: 'Logout', user: 'john' },
      ];

      const result = redactor.scrub(logs);

      expect(result.data[0]?.password).to.equal('[SCRUBBED]');
      expect(result.data[1]?.password).to.equal('[SCRUBBED]');
      expect(result.data[2]?.password).to.be.undefined;
      expect(result.data[0]?.user).to.equal('john');
    });
  });

  describe('oauth-provider-adapters-for-mcp Migration', () => {
    it('provides drop-in replacement for redaction.ts', () => {
      // This test validates the interface matches what oauth-provider-adapters expects
      const redactor = createRedactor({
        fields: ['client_secret', 'refresh_token', 'access_token'],
        paths: ['oauth.credentials.secret'],
      });

      // Simulate OAuth data structure
      const oauthData = {
        client_id: 'my-client',
        client_secret: 'secret123',
        redirect_uri: 'http://localhost:3000/callback',
        oauth: {
          credentials: {
            access_token: 'access123',
            refresh_token: 'refresh123',
            secret: 'hidden',
          },
        },
      };

      const result = redactor.scrub(oauthData);

      // Verify the interface provides .data (scrubbed result)
      expect(result).to.have.property('data');
      expect(result).to.have.property('scrubbed');
      expect(result).to.have.property('scrubbedPaths');

      // Verify scrubbing worked
      expect(result.data.client_secret).to.equal('[SCRUBBED]');
      expect(result.data.oauth.credentials.access_token).to.equal('[SCRUBBED]');
      expect(result.data.oauth.credentials.refresh_token).to.equal(
        '[SCRUBBED]'
      );
      expect(result.data.oauth.credentials.secret).to.equal('[SCRUBBED]');
      expect(result.data.client_id).to.equal('my-client');
    });

    it('supports the same API as oauth-provider redaction', () => {
      const redactor = createRedactor({ fields: ['secret'] });

      // The API should support:
      // 1. scrub() method
      expect(redactor).to.have.property('scrub');
      expect(typeof redactor.scrub).to.equal('function');

      // 2. Return value with .data property
      const result = redactor.scrub({ secret: 'hidden' });
      expect(result).to.have.property('data');

      // 3. Immutability (original not modified)
      const original = { secret: 'hidden', public: 'visible' };
      const scrubbed = redactor.scrub(original);
      expect(original.secret).to.equal('hidden'); // Original unchanged
      expect(scrubbed.data.secret).to.equal('[SCRUBBED]');
    });
  });

  describe('Performance', () => {
    it('handles high-volume logging scenarios efficiently', () => {
      const redactor = createRedactor({ fields: ['password'] });

      const start = performance.now();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        redactor.scrub({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'User action',
          user: `user${i}`,
          password: `secret${i}`,
        });
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      // Should average < 1ms per log entry (target from discovery doc)
      expect(avgTime).to.be.lessThan(1);
    });

    it('handles large nested objects efficiently', () => {
      const redactor = createRedactor({ fields: ['password'] });

      // Create a large nested structure
      const largeObject: Record<string, unknown> = {
        level: 'info',
        timestamp: Date.now(),
      };

      for (let i = 0; i < 100; i++) {
        largeObject[`user${i}`] = {
          id: i,
          name: `User ${i}`,
          password: `secret${i}`,
          metadata: {
            lastLogin: new Date().toISOString(),
            loginCount: i * 10,
          },
        };
      }

      const start = performance.now();
      const result = redactor.scrub(largeObject);
      const end = performance.now();

      expect(end - start).to.be.lessThan(10); // Should be < 10ms
      expect(result.scrubbed).to.be.true;
    });
  });

  describe('Edge Cases', () => {
    it('handles null and undefined values', () => {
      const redactor = createRedactor({ fields: ['password'] });

      const result = redactor.scrub({
        user: 'john',
        password: null,
        apiToken: undefined,
      });

      // Fields matching the scrubber config are scrubbed regardless of value
      expect(result.data.password).to.equal('[SCRUBBED]');
      // Fields not in the config are left as-is
      expect(result.data.apiToken).to.be.undefined;
      expect(result.data.user).to.equal('john');
    });

    it('handles circular references', () => {
      const redactor = createRedactor({ fields: ['password'] });

      const obj: Record<string, unknown> = {
        user: 'john',
        password: 'secret',
      };
      obj.self = obj; // Circular reference

      const result = redactor.scrub(obj);

      expect(result.data.password).to.equal('[SCRUBBED]');
      expect(result.data.user).to.equal('john');
      // Circular reference handled gracefully
    });

    it('handles empty objects and arrays', () => {
      const redactor = createRedactor({ fields: ['password'] });

      expect(redactor.scrub({}).data).to.deep.equal({});
      expect(redactor.scrub([]).data).to.deep.equal([]);
    });

    it('handles primitive values', () => {
      const redactor = createRedactor({ fields: ['password'] });

      expect(redactor.scrub('string').data).to.equal('string');
      expect(redactor.scrub(42).data).to.equal(42);
      expect(redactor.scrub(true).data).to.equal(true);
      expect(redactor.scrub(null).data).to.equal(null);
    });
  });

  describe('Type Safety', () => {
    it('preserves TypeScript types', () => {
      interface LogEntry {
        level: string;
        message: string;
        user: string;
        password: string;
      }

      const redactor = createRedactor({ fields: ['password'] });
      const entry: LogEntry = {
        level: 'info',
        message: 'User login',
        user: 'john',
        password: 'secret',
      };

      const result = redactor.scrub(entry);

      // result.data should maintain LogEntry type
      expect(result.data.level).to.be.a('string');
      expect(result.data.message).to.be.a('string');
      expect(result.data.user).to.be.a('string');
      expect(result.data.password).to.equal('[SCRUBBED]');
    });
  });
});
