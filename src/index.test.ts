// Integration test to verify the public API works correctly

import { expect } from 'chai';
import {
  Scrubber,
  createRedactor,
  HEROKU_FIELDS,
  PII_PATTERNS,
} from './index.js';

describe('node-blanket', () => {
  it('exports Scrubber class', () => {
    expect(Scrubber).to.be.a('function');
    const scrubber = new Scrubber({ fields: ['password'] });
    expect(scrubber).to.be.instanceOf(Scrubber);
  });

  it('exports createRedactor function', () => {
    expect(createRedactor).to.be.a('function');
    const redactor = createRedactor({ fields: ['password'] });
    const result = redactor.scrub({ password: 'secret' });
    expect(result.data.password).to.equal('[SCRUBBED]');
  });

  it('exports HEROKU_FIELDS preset', () => {
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

  it('exports PII_PATTERNS preset', () => {
    expect(PII_PATTERNS).to.be.an('array');
    expect(PII_PATTERNS.length).to.be.greaterThan(0);
  });
});
