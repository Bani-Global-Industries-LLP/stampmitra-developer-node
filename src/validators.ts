import { ValidationError } from './errors.js';

/**
 * Client-side validators. Patterns mirror the API's server-side validators, so input that
 * fails here would also be rejected (400) by the API; failing locally avoids a network call.
 */
export const PATTERNS = {
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  cin: /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,
  udyam: /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/,
  vehicleNumber: /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/,
  accountNumber: /^[0-9]{9,18}$/,
  passportFileNumber: /^[A-Z]{2}[0-9]{13}$/,
  drivingLicense: /^[A-Z]{2}[0-9]{2}[0-9]{11}$/,
  voterId: /^[A-Z]{3}[0-9]{7}$/,
  phone: /^(?:\+?91|0)?[6-9][0-9]{9}$/,
} as const;

const MAX_NAME = 256;

function fail(field: string, message: string): never {
  throw new ValidationError(message, { field, status: 400, code: 'BAD_REQUEST', local: true });
}

function str(field: string, value: unknown): string {
  if (typeof value !== 'string') fail(field, `${field} is required and must be a string`);
  return value;
}

function normalized(
  field: string,
  value: unknown,
  pattern: RegExp,
  example: string,
  opts: { stripSeparators?: boolean } = {},
): string {
  let v = str(field, value).trim().toUpperCase();
  if (opts.stripSeparators) v = v.replace(/[\s-]+/g, '');
  if (!pattern.test(v)) fail(field, `${field} must match the format ${example}`);
  return v;
}

export const normalizePan = (v: unknown, field = 'pan') =>
  normalized(field, v, PATTERNS.pan, 'ABCDE1234F');
export const normalizeGstin = (v: unknown, field = 'gstin') =>
  normalized(field, v, PATTERNS.gstin, '07AAAAA1111A1Z1');
export const normalizeIfsc = (v: unknown, field = 'ifsc') =>
  normalized(field, v, PATTERNS.ifsc, 'ICIC0001234');
export const normalizeCin = (v: unknown, field = 'cin') =>
  normalized(field, v, PATTERNS.cin, 'U74999DL2015PTC284009');
export const normalizeUdyam = (v: unknown, field = 'udyamNumber') =>
  normalized(field, v, PATTERNS.udyam, 'UDYAM-MH-12-1234567');
export const normalizeVehicleNumber = (v: unknown, field = 'vehicleNumber') =>
  normalized(field, v, PATTERNS.vehicleNumber, 'MH12AB1234');
export const normalizePassportFileNumber = (v: unknown, field = 'fileNumber') =>
  normalized(field, v, PATTERNS.passportFileNumber, 'PA1079341954215');
export const normalizeDrivingLicense = (v: unknown, field = 'dlNumber') =>
  normalized(field, v, PATTERNS.drivingLicense, 'MH1420110012345');
export const normalizeVoterId = (v: unknown, field = 'voterId') =>
  normalized(field, v, PATTERNS.voterId, 'ABC1234567');

export function normalizeAccountNumber(v: unknown, field = 'accountNumber'): string {
  const s = str(field, v).trim();
  if (!PATTERNS.accountNumber.test(s)) {
    fail(field, `${field} must be a 9-18 digit numeric bank account number`);
  }
  return s;
}

export function normalizePhone(v: unknown, field = 'phone'): string {
  const s = str(field, v).trim();
  if (!PATTERNS.phone.test(s))
    fail(field, `${field} must be a valid 10-digit Indian mobile number`);
  return s;
}

/** Strict `YYYY-MM-DD` calendar date. */
export function normalizeDate(v: unknown, field: string): string {
  const s = str(field, v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  let ok = false;
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    ok = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  }
  if (!ok) fail(field, `${field} must be a valid date in YYYY-MM-DD format`);
  return s;
}

export function optionalName(v: unknown, field = 'name'): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = str(field, v).trim();
  if (s.length > MAX_NAME) fail(field, `${field} must be at most ${MAX_NAME} characters`);
  return s;
}

export function requireId(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim() === '') fail(field, `${field} is required`);
  return v;
}

export function requireObject(v: unknown, field: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(field, `${field} must be an object`);
  return v as Record<string, unknown>;
}
