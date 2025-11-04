// Simple test to verify the package is working in a way that registers as full code coverage from C8

import { expect } from 'chai';
import { VERSION } from './index.js';

describe('node-blanket', () => {
  it('should have a VERSION', () => {
    expect(VERSION).to.be.a('string');
  });
});
