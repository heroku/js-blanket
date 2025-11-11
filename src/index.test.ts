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

  it('provides PII_PATTERNS preset with common PII regex patterns', () => {
    expect(PII_PATTERNS).to.be.an('array');
    expect(PII_PATTERNS.length).to.be.greaterThan(0);
  });
});
