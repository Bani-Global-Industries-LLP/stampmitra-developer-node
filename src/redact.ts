const SECRET_HEADERS = new Set(['authorization', 'x-api-key', 'proxy-authorization', 'cookie']);
/** Keys whose values are identifiers: keep only the last 4 characters. */
const ID_KEYS = new Set([
  'pan',
  'gstin',
  'accountnumber',
  'dlnumber',
  'filenumber',
  'voterid',
  'cin',
  'udyamnumber',
  'vehiclenumber',
  'regno',
  'phone',
  'din',
  'chassis',
  'engine',
  'email',
]);
/** Keys holding personal data: fully redacted. */
const PERSONAL_KEYS = new Set([
  'name',
  'registeredname',
  'fathername',
  'businessname',
  'beneficiaryname',
  'legalname',
  'tradename',
  'ownername',
  'ownerfathername',
  'fatherorhusbandname',
  'dob',
  'address',
  'principalplaceofbusiness',
  'companyname',
  'enterprisename',
]);

const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
const GSTIN_RE = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g;
const KEY_RE = /\bsk_(?:test|live)_[A-Za-z0-9_-]+/g;

export function maskId(value: string): string {
  if (value.length <= 4) return '****';
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

export function redactString(text: string): string {
  return text
    .replace(KEY_RE, 'sk_[REDACTED]')
    .replace(GSTIN_RE, (m) => maskId(m))
    .replace(PAN_RE, (m) => maskId(m));
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SECRET_HEADERS.has(k.toLowerCase()) ? '[REDACTED]' : redactString(v);
  }
  return out;
}

/** Deep-copies `value`, masking identifiers and personal data. Safe to log. */
export function redactBody(value: unknown, key = ''): unknown {
  const k = key.toLowerCase();
  if (typeof value === 'string') {
    if (PERSONAL_KEYS.has(k)) return '[REDACTED]';
    if (ID_KEYS.has(k)) return maskId(value);
    return redactString(value);
  }
  if (typeof value === 'number' && ID_KEYS.has(k)) return maskId(String(value));
  if (Array.isArray(value)) return value.map((v) => redactBody(v, key));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [kk, vv] of Object.entries(value)) out[kk] = redactBody(vv, kk);
    return out;
  }
  return value;
}
