import { describe, it } from 'mocha';
import { expect } from 'chai';
import { CREDENTIAL_PATTERNS, PII_PATTERNS } from './patterns.js';
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

  describe('PEM private keys', () => {
    const body = 'MIIEpAIBAAKCAQEA1x+/9z\nQk7wR2s0pX=\n';

    it('keeps the BEGIN line and scrubs the body and END line', () => {
      for (const label of [
        'RSA PRIVATE KEY',
        'PRIVATE KEY',
        'ENCRYPTED PRIVATE KEY',
        'EC PRIVATE KEY',
        'OPENSSH PRIVATE KEY',
        'PGP PRIVATE KEY BLOCK',
      ]) {
        expect(
          scrub(
            `invalid key: -----BEGIN ${label}-----\n${body}-----END ${label}-----\nretry`
          )
        ).to.equal(`invalid key: -----BEGIN ${label}-----[SCRUBBED]\nretry`);
      }
    });

    it('scrubs an encrypted key with Proc-Type and DEK-Info headers', () => {
      expect(
        scrub(
          '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,0A1B2C3D\n\n' +
            body +
            '-----END RSA PRIVATE KEY-----'
        )
      ).to.equal('-----BEGIN RSA PRIVATE KEY-----[SCRUBBED]');
    });

    it('scrubs a key cut off before its END line', () => {
      expect(scrub(`-----BEGIN PRIVATE KEY-----\n${body}`)).to.equal(
        '-----BEGIN PRIVATE KEY-----[SCRUBBED]'
      );
    });

    it('scrubs a JSON-escaped key and keeps the next field', () => {
      const json = JSON.stringify({
        key: `-----BEGIN PRIVATE KEY-----\n${body}-----END PRIVATE KEY-----\n`,
        name: 'x',
      });
      expect(scrub(json)).to.equal(
        '{"key":"-----BEGIN PRIVATE KEY-----[SCRUBBED]\\n","name":"x"}'
      );
    });

    it('scrubs a key split across lines by util.inspect', () => {
      // What Node's util.inspect prints for an object holding a PEM key.
      const inspected = [
        '{',
        "  key: '-----BEGIN PRIVATE KEY-----\\n' +",
        "    'MIIEpAIBAAKCAQEA1x+/9z\\n' +",
        "    'MIIEpAIBAAKCAQEA1x+/9z\\n' +",
        "    '-----END PRIVATE KEY-----\\n',",
        "  name: 'x'",
        '}',
      ].join('\n');
      expect(scrub(inspected)).to.equal(
        [
          '{',
          "  key: '-----BEGIN PRIVATE KEY-----[SCRUBBED]\\n',",
          "  name: 'x'",
          '}',
        ].join('\n')
      );
    });

    it('leaves certificates and public keys alone', () => {
      for (const text of [
        `-----BEGIN CERTIFICATE-----\n${body}-----END CERTIFICATE-----`,
        `-----BEGIN PUBLIC KEY-----\n${body}-----END PUBLIC KEY-----`,
      ]) {
        expect(scrub(text)).to.equal(text);
      }
    });
  });

  describe('long credentials', () => {
    const long = 'A1'.repeat(8000);

    it('scrubs a credential up to 16,384 characters in full', () => {
      expect(scrub(`Authorization: Bearer ${long}`)).to.equal(
        'Authorization: Bearer [SCRUBBED]'
      );
      expect(
        scrub(`{"authorization":"Digest response=\\"${long}\\""}`)
      ).to.equal('{"authorization":"Digest [SCRUBBED]"}');
      expect(scrub(`Authorization: Foo sig="${long}"`)).to.equal(
        'Authorization: [SCRUBBED]'
      );
      expect(scrub(`sent Bearer ${long} to the API`)).to.equal(
        'sent Bearer [SCRUBBED] to the API'
      );
      expect(scrub(`Basic ${long}==`)).to.equal('Basic [SCRUBBED]');
      expect(scrub(`HRKU-${long}`)).to.equal('[SCRUBBED]');
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

    it('scrubs every parameter of a Digest, OAuth or Token value', () => {
      expect(
        scrub('Authorization: Digest username="u", response="deadbeef0123"')
      ).to.equal('Authorization: Digest [SCRUBBED]');
      expect(scrub('Authorization: OAuth oauth_token="tok123456"')).to.equal(
        'Authorization: OAuth [SCRUBBED]'
      );
      expect(scrub('Authorization: Token token="abc123secret"')).to.equal(
        'Authorization: Token [SCRUBBED]'
      );
    });

    it('scrubs a Digest parameter containing & inside quotes', () => {
      expect(
        scrub('Authorization: Digest uri="/a?x=1&y=2", response="deadbeef0123"')
      ).to.equal('Authorization: Digest [SCRUBBED]');
    });

    it('scrubs the scheme word along with the value for an unknown scheme', () => {
      expect(
        scrub(
          'Authorization: AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20261113/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=fe5f80f77d5f'
        )
      ).to.equal('Authorization: [SCRUBBED]');
    });

    it('stops a quoted value at its closing quote', () => {
      expect(
        scrub(
          '{"authorization":"Digest username=\\"u\\", response=\\"deadbeef\\"","host":"h"}'
        )
      ).to.equal('{"authorization":"Digest [SCRUBBED]","host":"h"}');
      expect(
        scrub(
          `{ authorization: 'Digest username="u", response="deadbeef"', host: 'h' }`
        )
      ).to.equal(`{ authorization: 'Digest [SCRUBBED]', host: 'h' }`);
    });

    it('keeps the punctuation that closes the value', () => {
      expect(scrub('failed (Authorization: Bearer abc123)')).to.equal(
        'failed (Authorization: Bearer [SCRUBBED])'
      );
      expect(scrub('[Authorization: Bearer abc123]')).to.equal(
        '[Authorization: Bearer [SCRUBBED]]'
      );
      expect(scrub('<Authorization: Basic dXNlcjpwYXNz>')).to.equal(
        '<Authorization: Basic [SCRUBBED]>'
      );
      expect(scrub('failed (Authorization: Digest response="x1")')).to.equal(
        'failed (Authorization: Digest [SCRUBBED])'
      );
    });

    it('keeps the rest of a query string', () => {
      expect(scrub('authorization=abc12345&user=bob')).to.equal(
        'authorization=[SCRUBBED]&user=bob'
      );
    });

    it('scrubs an HRKU token in a header without doubling the replacement', () => {
      expect(
        scrub(
          'connect to postgres://u:p4ss@host/db failed (Authorization: Bearer HRKU-abc123)'
        )
      ).to.equal(
        'connect to postgres://[SCRUBBED]@host/db failed (Authorization: Bearer [SCRUBBED])'
      );
    });

    it('leaves a value already replaced by an earlier pattern alone', () => {
      const combined = new Scrubber({
        patterns: [...PII_PATTERNS, ...CREDENTIAL_PATTERNS],
      });
      expect(
        combined.scrub('(Authorization: Bearer eyJhbGc.eyJzdWI.c2lnbmF0dXJl)')
          .data
      ).to.equal('(Authorization: Bearer [SCRUBBED])');
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

    it('stays inside one JSON string or quoted value', () => {
      expect(scrub('{"db":"postgres://u:p@h/db","email":"x@y.com"}')).to.equal(
        '{"db":"postgres://[SCRUBBED]@h/db","email":"x@y.com"}'
      );
      expect(scrub("{ db: 'postgres://u:p@h/db', email: 'x@y.com' }")).to.equal(
        "{ db: 'postgres://[SCRUBBED]@h/db', email: 'x@y.com' }"
      );
      expect(scrub('see <postgres://u:p@h/db> or x@y.com')).to.equal(
        'see <postgres://[SCRUBBED]@h/db> or x@y.com'
      );
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
      `authorization: Digest ${'"a'.repeat(100_000)}`,
      `authorization: "${'\\'.repeat(200_000)}`,
      `authorization: '${"\\'".repeat(100_000)}`,
      `x://u:${'"@'.repeat(100_000)}`,
      'x://a:'.repeat(170_000),
      `HRKU-${'-'.repeat(200_000)}`,
      `-----BEGIN PRIVATE KEY-----${'-'.repeat(200_000)}`,
      ('-----BEGIN PRIVATE KEY-----' + 'a '.repeat(10_000)).repeat(50),
      '-----BEGIN PRIVATE KEY-----'.repeat(40_000),
    ];
    for (const input of inputs) {
      const start = performance.now();
      scrub(input);
      expect(performance.now() - start).to.be.lessThan(500);
    }
  });
});
