/**
 * Type Safety Tests for Core Scrubber
 *
 * These tests validate that TypeScript types are preserved correctly through scrubbing operations.
 * They use compile-time type assertions to ensure type safety without runtime overhead.
 *
 * Run with: pnpm test (type-checked during pretest)
 */

import { expect } from 'chai';
import { Scrubber } from './scrubber.js';
import type { ScrubConfig, ScrubResult } from './types.js';

/**
 * Compile-time type assertion helper
 * If T is not assignable to Expected, TypeScript will error at compile time
 */
type AssertType<T, Expected> = T extends Expected
  ? Expected extends T
    ? true
    : never
  : never;

describe('Type Safety', () => {
  describe('Generic Type Preservation', () => {
    it('preserves simple object types', () => {
      interface User {
        name: string;
        email: string;
        password: string;
      }

      const scrubber = new Scrubber({ fields: ['password'] });
      const user: User = {
        name: 'John',
        email: 'john@example.com',
        password: 'secret',
      };

      const result = scrubber.scrub(user);

      // Compile-time assertion: result.data should be User type
      const typeCheck: AssertType<typeof result.data, User> = true;
      expect(typeCheck).to.be.true;

      // Runtime validation
      expect(result.data).to.have.property('name');
      expect(result.data).to.have.property('email');
      expect(result.data).to.have.property('password');
    });

    it('preserves nested object types', () => {
      interface Address {
        street: string;
        city: string;
        zip: string;
      }

      interface UserProfile {
        user: {
          name: string;
          email: string;
        };
        address: Address;
        metadata: {
          lastLogin: string;
          loginCount: number;
        };
      }

      const scrubber = new Scrubber({ fields: ['email'] });
      const profile: UserProfile = {
        user: { name: 'John', email: 'john@example.com' },
        address: { street: '123 Main St', city: 'Springfield', zip: '12345' },
        metadata: { lastLogin: '2024-01-01', loginCount: 42 },
      };

      const result = scrubber.scrub(profile);

      // Compile-time assertion
      const typeCheck: AssertType<typeof result.data, UserProfile> = true;
      expect(typeCheck).to.be.true;
    });

    it('preserves array types', () => {
      interface Item {
        id: number;
        name: string;
        secret: string;
      }

      const scrubber = new Scrubber({ fields: ['secret'] });
      const items: Item[] = [
        { id: 1, name: 'Item 1', secret: 'secret1' },
        { id: 2, name: 'Item 2', secret: 'secret2' },
      ];

      const result = scrubber.scrub(items);

      // Compile-time assertion
      const typeCheck: AssertType<typeof result.data, Item[]> = true;
      expect(typeCheck).to.be.true;

      // Runtime validation
      expect(result.data).to.be.an('array');
      expect(result.data).to.have.lengthOf(2);
    });

    it('preserves union types', () => {
      type StringOrNumber = string | number;
      type ComplexUnion =
        | { type: 'user'; name: string; email: string }
        | { type: 'admin'; name: string; permissions: string[] };

      const scrubber = new Scrubber({ fields: ['email'] });
      const data: ComplexUnion = {
        type: 'user',
        name: 'John',
        email: 'john@example.com',
      };

      const result = scrubber.scrub(data);

      // Compile-time assertion
      const typeCheck: AssertType<typeof result.data, ComplexUnion> = true;
      expect(typeCheck).to.be.true;
    });

    it('preserves readonly types', () => {
      interface ReadonlyUser {
        readonly id: number;
        readonly name: string;
        password: string;
      }

      const scrubber = new Scrubber({ fields: ['password'] });
      const user: ReadonlyUser = {
        id: 1,
        name: 'John',
        password: 'secret',
      };

      const result = scrubber.scrub(user);

      // Compile-time assertion
      const typeCheck: AssertType<typeof result.data, ReadonlyUser> = true;
      expect(typeCheck).to.be.true;

      // Immutability: original should not be modified
      expect(user.password).to.equal('secret');
      expect(result.data.password).to.equal('[SCRUBBED]');
    });

    it('preserves optional property types', () => {
      interface PartialUser {
        name: string;
        email?: string;
        phone?: string;
        password: string;
      }

      const scrubber = new Scrubber({ fields: ['password'] });
      const user: PartialUser = {
        name: 'John',
        email: 'john@example.com',
        // phone is omitted
        password: 'secret',
      };

      const result = scrubber.scrub(user);

      // Compile-time assertion
      const typeCheck: AssertType<typeof result.data, PartialUser> = true;
      expect(typeCheck).to.be.true;
    });
  });

  describe('ScrubResult Type', () => {
    it('has correct result structure', () => {
      const scrubber = new Scrubber({ fields: ['password'] });
      const data = { user: 'john', password: 'secret' };
      const result = scrubber.scrub(data);

      // Type assertion: result should be ScrubResult
      const typeCheck: AssertType<
        typeof result,
        ScrubResult<typeof data>
      > = true;
      expect(typeCheck).to.be.true;

      // Runtime validation
      expect(result).to.have.property('data');
      expect(result).to.have.property('scrubbed');
      expect(result).to.have.property('scrubbedPaths');
      expect(result.scrubbed).to.be.a('boolean');
      expect(result.scrubbedPaths).to.be.an('array');
    });

    it('preserves input type in result.data', () => {
      interface Input {
        a: string;
        b: number;
        c: boolean;
      }

      const scrubber = new Scrubber({ fields: ['a'] });
      const input: Input = { a: 'test', b: 42, c: true };
      const result: ScrubResult<Input> = scrubber.scrub(input);

      // Compile-time assertion
      const typeCheck: AssertType<typeof result.data, Input> = true;
      expect(typeCheck).to.be.true;
    });
  });

  describe('ScrubConfig Type', () => {
    it('accepts valid configurations', () => {
      const config1: ScrubConfig = {
        fields: ['password', 'apiToken'],
      };

      const config2: ScrubConfig = {
        fields: ['password', /api[-_]?key/i],
        paths: ['user.email'],
        patterns: [/\d{3}-\d{2}-\d{4}/g],
        replacement: '[REDACTED]',
      };

      const config3: ScrubConfig = {
        fields: [],
        paths: [],
        patterns: [],
        recursive: false,
      };

      // All should be valid ScrubConfig types
      expect(config1).to.be.an('object');
      expect(config2).to.be.an('object');
      expect(config3).to.be.an('object');
    });

    it('allows partial configurations', () => {
      const partial1: ScrubConfig = {};
      const partial2: ScrubConfig = { fields: ['password'] };
      const partial3: ScrubConfig = { replacement: '[X]' };

      expect(partial1).to.be.an('object');
      expect(partial2).to.be.an('object');
      expect(partial3).to.be.an('object');
    });
  });

  describe('Complex Type Scenarios', () => {
    it('handles deeply nested generic types', () => {
      interface DeepNested<T> {
        level1: {
          level2: {
            level3: {
              level4: {
                value: T;
                secret: string;
              };
            };
          };
        };
      }

      const scrubber = new Scrubber({ fields: ['secret'] });
      const data: DeepNested<number> = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 42,
                secret: 'hidden',
              },
            },
          },
        },
      };

      const result = scrubber.scrub(data);

      // Compile-time assertion
      const typeCheck: AssertType<
        typeof result.data,
        DeepNested<number>
      > = true;
      expect(typeCheck).to.be.true;
    });

    it('handles arrays of complex types', () => {
      interface Event {
        id: string;
        timestamp: Date;
        user: {
          id: string;
          email: string;
        };
        metadata: Record<string, unknown>;
      }

      const scrubber = new Scrubber({ fields: ['email'] });
      const events: Event[] = [
        {
          id: '1',
          timestamp: new Date(),
          user: { id: 'u1', email: 'user1@example.com' },
          metadata: { key: 'value' },
        },
        {
          id: '2',
          timestamp: new Date(),
          user: { id: 'u2', email: 'user2@example.com' },
          metadata: { key: 'value' },
        },
      ];

      const result = scrubber.scrub(events);

      // Compile-time assertion
      const typeCheck: AssertType<typeof result.data, Event[]> = true;
      expect(typeCheck).to.be.true;
    });

    it('handles Record types', () => {
      type UserMap = Record<string, { name: string; password: string }>;

      const scrubber = new Scrubber({ fields: ['password'] });
      const users: UserMap = {
        user1: { name: 'John', password: 'secret1' },
        user2: { name: 'Jane', password: 'secret2' },
      };

      const result = scrubber.scrub(users);

      // Compile-time assertion
      const typeCheck: AssertType<typeof result.data, UserMap> = true;
      expect(typeCheck).to.be.true;
    });

    it('handles mixed primitive and object types', () => {
      interface MixedData {
        string: string;
        number: number;
        boolean: boolean;
        null: null;
        undefined: undefined;
        date: Date;
        regex: RegExp;
        object: { key: string };
        array: number[];
      }

      const scrubber = new Scrubber({ fields: ['key'] });
      const data: MixedData = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
        date: new Date(),
        regex: /test/,
        object: { key: 'value' },
        array: [1, 2, 3],
      };

      const result = scrubber.scrub(data);

      // Compile-time assertion
      const typeCheck: AssertType<typeof result.data, MixedData> = true;
      expect(typeCheck).to.be.true;
    });

    it('handles tuple types', () => {
      type UserTuple = [string, number, boolean, { password: string }];

      const scrubber = new Scrubber({ fields: ['password'] });
      const tuple: UserTuple = ['John', 30, true, { password: 'secret' }];

      const result = scrubber.scrub(tuple);

      // Note: TypeScript treats tuples as arrays at runtime, so the type is preserved
      // but the specific tuple structure is maintained
      expect(result.data).to.be.an('array');
      expect(result.data).to.have.lengthOf(4);
    });

    it('preserves type safety with unknown types', () => {
      const scrubber = new Scrubber({ fields: ['password'] });
      const data: unknown = { user: 'john', password: 'secret' };

      const result = scrubber.scrub(data);

      // Compile-time assertion: unknown in, unknown out
      const typeCheck: AssertType<typeof result.data, unknown> = true;
      expect(typeCheck).to.be.true;
    });
  });

  describe('Type Inference', () => {
    it('infers types from literal objects', () => {
      const scrubber = new Scrubber({ fields: ['password'] });

      // Type should be inferred from the literal
      const result = scrubber.scrub({
        name: 'John',
        email: 'john@example.com',
        password: 'secret',
      });

      // TypeScript infers the exact shape
      expect(result.data).to.have.property('name');
      expect(result.data).to.have.property('email');
      expect(result.data).to.have.property('password');
    });

    it('works with const assertions', () => {
      const scrubber = new Scrubber({ fields: ['password'] });

      const data = {
        name: 'John',
        role: 'admin',
        password: 'secret',
      } as const;

      // Type should preserve readonly properties from const assertion
      const result = scrubber.scrub(data);

      expect(result.data.name).to.equal('John');
      expect(result.data.role).to.equal('admin');
    });
  });

  describe('Edge Case Types', () => {
    it('handles empty objects', () => {
      const scrubber = new Scrubber({ fields: ['password'] });
      const empty = {};

      const result = scrubber.scrub(empty);

      const typeCheck: AssertType<typeof result.data, typeof empty> = true;
      expect(typeCheck).to.be.true;
      expect(result.data).to.deep.equal({});
    });

    it('handles primitives directly', () => {
      const scrubber = new Scrubber({ fields: ['password'] });

      const string = 'test';
      const number = 42;
      const boolean = true;
      const nullVal = null;

      expect(scrubber.scrub(string).data).to.equal(string);
      expect(scrubber.scrub(number).data).to.equal(number);
      expect(scrubber.scrub(boolean).data).to.equal(boolean);
      expect(scrubber.scrub(nullVal).data).to.equal(nullVal);
    });

    it('handles circular references with type preservation', () => {
      interface Circular {
        name: string;
        password: string;
        self?: Circular;
      }

      const scrubber = new Scrubber({ fields: ['password'] });
      const obj: Circular = {
        name: 'test',
        password: 'secret',
      };
      obj.self = obj; // Circular reference

      const result = scrubber.scrub(obj);

      // Type is preserved even with circular reference
      const typeCheck: AssertType<typeof result.data, Circular> = true;
      expect(typeCheck).to.be.true;
      expect(result.data.name).to.equal('test');
    });
  });

  describe('Strict TypeScript Compliance', () => {
    it('respects noUncheckedIndexedAccess', () => {
      const scrubber = new Scrubber({ fields: ['password'] });
      const data: Record<string, string> = {
        user: 'john',
        password: 'secret',
      };

      const result = scrubber.scrub(data);

      // With noUncheckedIndexedAccess, indexed access returns string | undefined
      const value = result.data['nonexistent'];
      expect(value).to.be.undefined;
    });

    it('respects strictNullChecks', () => {
      interface NullableData {
        value: string | null;
        optional?: string;
      }

      const scrubber = new Scrubber({ fields: ['value'] });
      const data: NullableData = {
        value: null,
      };

      const result = scrubber.scrub(data);

      // Compile-time assertion
      const typeCheck: AssertType<typeof result.data, NullableData> = true;
      expect(typeCheck).to.be.true;
    });
  });
});
