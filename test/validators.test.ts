import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/validators.json' with { type: 'json' };
import * as v from '../src/validators.js';
import { ValidationError } from '../src/errors.js';

const fns: Record<string, (x: unknown) => string> = {
  pan: (x) => v.normalizePan(x),
  gstin: (x) => v.normalizeGstin(x),
  ifsc: (x) => v.normalizeIfsc(x),
  cin: (x) => v.normalizeCin(x),
  udyam: (x) => v.normalizeUdyam(x),
  vehicleNumber: (x) => v.normalizeVehicleNumber(x),
  bankAccount: (x) => v.normalizeAccountNumber(x),
  passport: (x) => v.normalizePassportFileNumber(x),
  drivingLicense: (x) => v.normalizeDrivingLicense(x),
  voterId: (x) => v.normalizeVoterId(x),
};

describe('validators vs shared fixtures', () => {
  for (const [name, spec] of Object.entries(fixtures.validators)) {
    describe(name, () => {
      const fn = fns[name]!;
      it.each(spec.valid)('accepts %j', (input) => {
        const out = fn(input);
        expect(new RegExp(spec.pattern).test(out)).toBe(true);
      });
      it.each(spec.invalid)('rejects %j locally with field', (input) => {
        try {
          fn(input);
          expect.unreachable();
        } catch (e) {
          expect(e).toBeInstanceOf(ValidationError);
          expect((e as ValidationError).field).toBe(spec.field);
          expect((e as ValidationError).local).toBe(true);
        }
      });
    });
  }
});

describe('other validators', () => {
  it('normalises case/whitespace', () => {
    expect(v.normalizePan(' abcde1234f ')).toBe('ABCDE1234F');
    expect(v.normalizeAccountNumber(' 123456789 ')).toBe('123456789');
  });
  it('dates', () => {
    expect(v.normalizeDate('1990-01-31', 'dob')).toBe('1990-01-31');
    for (const bad of ['1990-02-30', '90-01-01', '1990/01/01', '', 5]) {
      expect(() => v.normalizeDate(bad, 'dob')).toThrow(ValidationError);
    }
  });
  it('names and phone', () => {
    expect(v.optionalName(undefined)).toBeUndefined();
    expect(() => v.optionalName('x'.repeat(257))).toThrow(ValidationError);
    expect(v.normalizePhone('9876543210')).toBe('9876543210');
    expect(() => v.normalizePhone('12345')).toThrow(ValidationError);
  });
  it('non-string input', () => {
    expect(() => v.normalizePan(undefined)).toThrow(/required/);
  });
});
