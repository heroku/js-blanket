import { describe, it } from 'mocha';
import { expect } from 'chai';
import { CREDENTIAL_PATTERNS } from './patterns.js';
import { Scrubber } from './scrubber.js';

const scrubber = new Scrubber({ patterns: CREDENTIAL_PATTERNS });

function scrub(text: string): string {
  return scrubber.scrub(text).data;
}

describe('CREDENTIAL_PATTERNS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(CREDENTIAL_PATTERNS)).to.equal(true);
  });

  describe('Heroku API tokens', () => {
    it('scrubs an HRKU token', () => {
      expect(scrub('token HRKU-AAbc_12-xyz expired')).to.equal(
        'token [SCRUBBED] expired'
      );
    });

    it('scrubs a token right after an ANSI color code', () => {
      expect(scrub('\x1b[1mHRKU-AAbc123\x1b[22m')).to.equal(
        '\x1b[1m[SCRUBBED]\x1b[22m'
      );
    });
  });

  describe('Authorization header values', () => {
    it('keeps the scheme and scrubs the credential', () => {
      expect(scrub('Authorization: Basic dXNlcjpwYXNz')).to.equal(
        'Authorization: Basic [SCRUBBED]'
      );
      expect(scrub('authorization: bearer x1')).to.equal(
        'authorization: bearer [SCRUBBED]'
      );
    });

    it('scrubs a value without a scheme', () => {
      expect(scrub("headers: { authorization: 'abcdef' }")).to.equal(
        "headers: { authorization: '[SCRUBBED]' }"
      );
    });

    it('scrubs a JSON header value', () => {
      expect(scrub('{"authorization":"Bearer x1"}')).to.equal(
        '{"authorization":"Bearer [SCRUBBED]"}'
      );
    });

    it('scrubs a short value the standalone Bearer pattern would skip', () => {
      expect(scrub('Authorization: Bearer abc')).to.equal(
        'Authorization: Bearer [SCRUBBED]'
      );
    });
  });

  describe('Bearer and Basic values', () => {
    it('scrubs a Bearer credential', () => {
      expect(scrub('sent Bearer abc123def456 to the API')).to.equal(
        'sent Bearer [SCRUBBED] to the API'
      );
    });

    it('scrubs a Basic credential, padding included', () => {
      expect(scrub('Basic dXNlcjpwYXNzd29yZA==')).to.equal('Basic [SCRUBBED]');
    });

    it('leaves prose alone', () => {
      for (const text of [
        'Basic size dynos are not available in this region',
        'Upgrade from the Basic Professional plan',
        'the bearer instrument',
        'Bearer tokens expire after eight hours',
      ]) {
        expect(scrub(text)).to.equal(text);
      }
    });
  });

  describe('URL credentials', () => {
    it('scrubs the username and password', () => {
      expect(scrub('postgres://user:pass@host:5432/db')).to.equal(
        'postgres://[SCRUBBED]@host:5432/db'
      );
    });

    it('scrubs a password with an empty username', () => {
      expect(
        scrub('rediss://:p4ssw0rd@ec2-1-2-3-4.compute-1.amazonaws.com:6379')
      ).to.equal(
        'rediss://[SCRUBBED]@ec2-1-2-3-4.compute-1.amazonaws.com:6379'
      );
    });

    it('scrubs a password with an unencoded / or @', () => {
      expect(scrub('postgres://u:p@ss/word@h/db')).to.equal(
        'postgres://[SCRUBBED]@h/db'
      );
    });

    it('scrubs each URL on its own', () => {
      expect(
        scrub('from postgres://u:p@a/db to https://b.example.com')
      ).to.equal('from postgres://[SCRUBBED]@a/db to https://b.example.com');
    });

    it('leaves a URL without a password alone', () => {
      for (const text of [
        'https://user@github.com/heroku/cli.git',
        'https://devcenter.heroku.com/articles/heroku-cli',
        'https://api.heroku.com:443/apps',
        'contact support@heroku.com',
      ]) {
        expect(scrub(text)).to.equal(text);
      }
    });
  });

  it('stays fast on long input', () => {
    const inputs = [
      'a.'.repeat(100_000),
      'a-'.repeat(100_000),
      `Basic ${'a'.repeat(200_000)}`,
      `x://${':'.repeat(200_000)}`,
      'Bearer '.repeat(30_000),
      'authorization: '.repeat(15_000),
      `HRKU-${'-'.repeat(200_000)}`,
    ];
    for (const input of inputs) {
      const start = performance.now();
      scrub(input);
      expect(performance.now() - start).to.be.lessThan(500);
    }
  });
});
