import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Scrubber } from './scrubber.js';

describe('Scrubber', () => {
  describe('Field-based scrubbing', () => {
    it('scrubs sensitive fields at any depth', () => {
      const scrubber = new Scrubber({
        fields: ['access_token'],
      });

      const input = {
        user: {
          profile: {
            settings: {
              auth: { access_token: 'secret123' },
            },
          },
        },
      };

      const { data } = scrubber.scrub(input);
      expect(data.user.profile.settings.auth.access_token).to.equal(
        '[SCRUBBED]'
      );
    });

    it('handles case-insensitive field matching', () => {
      const scrubber = new Scrubber({
        fields: ['password'],
      });

      const input = {
        Password: 'secret1',
        PASSWORD: 'secret2',
        password: 'secret3',
      };

      const { data } = scrubber.scrub(input);
      expect(data.Password).to.equal('[SCRUBBED]');
      expect(data.PASSWORD).to.equal('[SCRUBBED]');
      expect(data.password).to.equal('[SCRUBBED]');
    });

    it('supports regex field patterns', () => {
      const scrubber = new Scrubber({
        fields: [/api[-_]?key/i], // Matches api_key, api-key, apikey (case insensitive)
      });

      const input = {
        user_api_key: 'secret',
        API_KEY_V2: 'secret',
        myApiKeyHere: 'secret',
      };

      const { data } = scrubber.scrub(input);
      expect(data.user_api_key).to.equal('[SCRUBBED]');
      expect(data.API_KEY_V2).to.equal('[SCRUBBED]');
      expect(data.myApiKeyHere).to.equal('[SCRUBBED]');
    });
  });

  describe('Path-based scrubbing', () => {
    it('scrubs specific paths only', () => {
      const scrubber = new Scrubber({
        paths: ['user.profile.email'],
      });

      const input = {
        user: {
          profile: { email: 'bob@example.com', name: 'Bob' },
          settings: { email: 'notifications@example.com' },
        },
      };

      const { data } = scrubber.scrub(input);
      expect(data.user.profile.email).to.equal('[SCRUBBED]');
      expect(data.user.settings.email).to.equal('notifications@example.com');
    });

    it('scrubs array items by index', () => {
      const scrubber = new Scrubber({
        paths: ['users[0].password'],
      });

      const input = {
        users: [
          { name: 'bob', password: 'secret1' },
          { name: 'alice', password: 'secret2' },
        ],
      };

      const { data } = scrubber.scrub(input);
      expect(data.users?.[0]?.password).to.equal('[SCRUBBED]');
      expect(data.users?.[1]?.password).to.equal('secret2');
    });
  });

  describe('Pattern-based scrubbing', () => {
    it('scrubs SSN patterns in strings', () => {
      const scrubber = new Scrubber({
        patterns: [/\b\d{3}-\d{2}-\d{4}\b/g],
      });

      const input = { message: 'User SSN is 123-45-6789' };
      const { data } = scrubber.scrub(input);
      expect(data.message).to.contain('[SCRUBBED]');
      expect(data.message).not.to.contain('123-45-6789');
    });

    it('scrubs email patterns in strings', () => {
      const scrubber = new Scrubber({
        patterns: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
      });

      const input = { log: 'Auth failed for user@example.com' };
      const { data } = scrubber.scrub(input);
      expect(data.log).to.contain('[SCRUBBED]');
      expect(data.log).not.to.contain('user@example.com');
    });

    it('scrubs multiple patterns in same string', () => {
      const scrubber = new Scrubber({
        patterns: [
          /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
        ],
      });

      const input = {
        log: 'User bob@example.com has SSN 123-45-6789',
      };

      const { data } = scrubber.scrub(input);
      expect(data.log).not.to.contain('bob@example.com');
      expect(data.log).not.to.contain('123-45-6789');
    });
  });

  describe('Array handling', () => {
    it('scrubs fields across all array items', () => {
      const scrubber = new Scrubber({
        fields: ['password'],
      });

      const users = [
        { name: 'bob', password: 'secret' },
        { name: 'alice', password: 'hidden' },
      ];

      const { data } = scrubber.scrub(users);
      expect(data[0]?.password).to.equal('[SCRUBBED]');
      expect(data[1]?.password).to.equal('[SCRUBBED]');
      expect(data[0]?.name).to.equal('bob');
      expect(data[1]?.name).to.equal('alice');
    });

    it('handles nested arrays', () => {
      const scrubber = new Scrubber({
        fields: ['api_key'],
      });

      const input = {
        teams: [
          {
            members: [
              { name: 'bob', api_key: 'secret1' },
              { name: 'alice', api_key: 'secret2' },
            ],
          },
        ],
      };

      const { data } = scrubber.scrub(input);
      expect(data.teams?.[0]?.members?.[0]?.api_key).to.equal('[SCRUBBED]');
      expect(data.teams?.[0]?.members?.[1]?.api_key).to.equal('[SCRUBBED]');
    });
  });

  describe('Circular reference handling', () => {
    it('handles circular references without crashing', () => {
      const scrubber = new Scrubber({ fields: [] });
      const input: any = { name: 'test' };
      input.self = input;

      const { data } = scrubber.scrub(input);
      expect(data.self).to.equal('[Circular Reference]');
    });

    it('scrubs fields before detecting circular references', () => {
      const scrubber = new Scrubber({ fields: ['password'] });
      const input: any = { name: 'test', password: 'secret' };
      input.self = input;

      const { data } = scrubber.scrub(input);
      expect(data.password).to.equal('[SCRUBBED]');
      expect(data.self).to.equal('[Circular Reference]');
    });

    it('handles nested circular references', () => {
      const scrubber = new Scrubber({ fields: [] });
      const input: any = { name: 'test', nested: { level: 1 } };
      input.self = input;
      input.nested.parent = input;

      const { data } = scrubber.scrub(input);
      expect(data.self).to.equal('[Circular Reference]');
      expect(data.nested.parent).to.equal('[Circular Reference]');
    });
  });

  describe('Combined modes', () => {
    it('applies field + path + pattern scrubbing together', () => {
      const scrubber = new Scrubber({
        fields: ['api_key'],
        paths: ['user.email'],
        patterns: [/\b\d{3}-\d{2}-\d{4}\b/g],
      });

      const input = {
        user: {
          email: 'bob@example.com', // Path-based
          api_key: 'secret-key-123', // Field-based
        },
        log: 'SSN: 123-45-6789', // Pattern-based
        nested: {
          service: {
            api_key: 'another-secret', // Field-based (any depth)
          },
        },
      };

      const { data, scrubbedPaths } = scrubber.scrub(input);
      expect(data.user?.email).to.equal('[SCRUBBED]');
      expect(data.user?.api_key).to.equal('[SCRUBBED]');
      expect(data.log).not.to.contain('123-45-6789');
      expect(data.nested?.service?.api_key).to.equal('[SCRUBBED]');
      expect(scrubbedPaths.length).to.be.greaterThan(0);
    });
  });

  describe('Scrub result metadata', () => {
    it('tracks scrubbed paths', () => {
      const scrubber = new Scrubber({
        fields: ['password'],
        paths: ['user.email'],
      });

      const input = {
        user: { email: 'test@example.com', password: 'secret' },
      };

      const result = scrubber.scrub(input);
      expect(result.scrubbed).to.be.true;
      expect(result.scrubbedPaths).to.include.members([
        'user.email',
        'user.password',
      ]);
    });

    it('reports scrubbed=false when nothing was scrubbed', () => {
      const scrubber = new Scrubber({
        fields: ['password'],
      });

      const input = { name: 'Bob', age: 30 };
      const result = scrubber.scrub(input);
      expect(result.scrubbed).to.be.false;
      expect(result.scrubbedPaths).to.have.length(0);
    });
  });

  describe('Immutability', () => {
    it('does not mutate original object', () => {
      const scrubber = new Scrubber({
        fields: ['password'],
      });

      const input = { user: { password: 'secret', name: 'Bob' } };
      const original = JSON.stringify(input);

      scrubber.scrub(input);

      expect(JSON.stringify(input)).to.equal(original);
      expect(input.user.password).to.equal('secret');
    });
  });

  describe('Custom replacement text', () => {
    it('uses custom replacement string', () => {
      const scrubber = new Scrubber({
        fields: ['password'],
        replacement: '***REDACTED***',
      });

      const input = { password: 'secret' };
      const { data } = scrubber.scrub(input);
      expect(data.password).to.equal('***REDACTED***');
    });
  });

  describe('Edge cases', () => {
    it('handles null values', () => {
      const scrubber = new Scrubber({ fields: ['password'] });
      const input = { user: null };
      const { data } = scrubber.scrub(input);
      expect(data.user).to.be.null;
    });

    it('handles undefined values', () => {
      const scrubber = new Scrubber({ fields: ['password'] });
      const input = { user: undefined };
      const { data } = scrubber.scrub(input);
      expect(data.user).to.be.undefined;
    });

    it('handles empty objects', () => {
      const scrubber = new Scrubber({ fields: ['password'] });
      const input = {};
      const { data } = scrubber.scrub(input);
      expect(data).to.deep.equal({});
    });

    it('handles empty arrays', () => {
      const scrubber = new Scrubber({ fields: ['password'] });
      const input: any[] = [];
      const { data } = scrubber.scrub(input);
      expect(data).to.deep.equal([]);
    });

    it('handles primitive values', () => {
      const scrubber = new Scrubber({ fields: ['password'] });
      expect(scrubber.scrub('test').data).to.equal('test');
      expect(scrubber.scrub(123).data).to.equal(123);
      expect(scrubber.scrub(true).data).to.equal(true);
    });
  });
});
