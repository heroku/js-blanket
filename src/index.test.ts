// Integration test to verify the public API works correctly

import { expect } from 'chai';
import {
  Scrubber,
  createRedactor,
  HEROKU_FIELDS,
  PII_PATTERNS,
} from './index.js';

describe('js-blanket', () => {
  it('creates and uses Scrubber instances for field-based scrubbing', () => {
    expect(Scrubber).to.be.a('function');
    const scrubber = new Scrubber({ fields: ['password'] });
    expect(scrubber).to.be.instanceOf(Scrubber);
  });

  it('creates redactor instances that scrub sensitive data', () => {
    expect(createRedactor).to.be.a('function');
    const redactor = createRedactor({ fields: ['password'] });
    const result = redactor.scrub({ password: 'secret' });
    expect(result.data.password).to.equal('[SCRUBBED]');
  });

  it('provides HEROKU_FIELDS preset with standard Heroku sensitive fields', () => {
    expect(HEROKU_FIELDS).to.be.an('array');
    expect(HEROKU_FIELDS).to.include('password');
    // Check for api_key pattern (can be string or regex)
    const hasApiKey = HEROKU_FIELDS.some(
      (field) =>
        field === 'api_key' ||
        (field instanceof RegExp && field.test('api_key'))
    );
    expect(hasApiKey).to.be.true;
  });

  it('scrubs the Heroku two-factor-code and addon-SSO headers via HEROKU_FIELDS', () => {
    const scrubber = new Scrubber({ fields: HEROKU_FIELDS });
    const result = scrubber.scrub({
      'heroku-two-factor-code': '123456',
      'x-addon-sso': 'sso-token',
    });
    expect(result.data['heroku-two-factor-code']).to.equal('[SCRUBBED]');
    expect(result.data['x-addon-sso']).to.equal('[SCRUBBED]');
  });

  it('scrubs private keys, credential-bearing URLs, and the webhook signature header via HEROKU_FIELDS', () => {
    const scrubber = new Scrubber({ fields: HEROKU_FIELDS });
    const result = scrubber.scrub({
      private_key: '-----BEGIN PRIVATE KEY-----',
      database_url: 'postgres://user:pass@host:5432/db',
      resource_url: 'postgres://user:pass@host:5432/db',
      database_password: 'super-secret',
      connection_string: 'redis://user:pass@host:6379',
      'heroku-webhook-hmac-sha256': 'c2lnbmF0dXJl',
    });
    expect(result.data.private_key).to.equal('[SCRUBBED]');
    expect(result.data.database_url).to.equal('[SCRUBBED]');
    expect(result.data.resource_url).to.equal('[SCRUBBED]');
    expect(result.data.database_password).to.equal('[SCRUBBED]');
    expect(result.data.connection_string).to.equal('[SCRUBBED]');
    expect(result.data['heroku-webhook-hmac-sha256']).to.equal('[SCRUBBED]');
  });

  it('provides PII_PATTERNS preset with common PII regex patterns', () => {
    expect(PII_PATTERNS).to.be.an('array');
    expect(PII_PATTERNS.length).to.be.greaterThan(0);
  });
});
