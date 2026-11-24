/**
 * Contract 1.2.0 conformance: every new operation (31) is replayed through the SDK over real HTTP against the
 * spec repo's mock server, and the typed result is compared with the golden response of its fixture. Also covers
 * multipart upload, idempotency-key generation, Retry-After handling and the never-retry set.
 *
 * Needs STAMPMITRA_SPEC_DIR (a checkout of stampmitra-developer-openapi); skipped when unset (required in CI).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  PaymentRequiredError,
  PermissionError,
  RateLimitError,
  StampMitra,
  UpstreamError,
  ValidationError,
} from '../../src/index.js';

const specDir = process.env.STAMPMITRA_SPEC_DIR ? resolve(process.env.STAMPMITRA_SPEC_DIR) : '';
const haveSpec = specDir !== '' && existsSync(resolve(specDir, 'scripts/mock-server.mjs'));
if (!haveSpec && process.env.CI) {
  throw new Error(
    'STAMPMITRA_SPEC_DIR must point to a checkout of stampmitra-developer-openapi in CI',
  );
}

const KEY = 'sk_test_abcdefgh12345678';
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface Fixture {
  operation: { method: string; path: string };
  scenario: string;
  request: {
    path: string;
    query?: Record<string, string>;
    body?: Json;
    multipart?: {
      parts: Array<{
        name: string;
        filename?: string;
        contentType?: string;
        content?: string;
        value?: string;
      }>;
    };
  };
  response: { status: number; headers: Record<string, string>; body: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
}
interface Recorded {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

type Call = (c: StampMitra, p: string[], f: Fixture) => Promise<unknown>;
const q = (f: Fixture) => (f.request.query ?? {}) as Json;
/** The 31 operations added in contract 1.2.0: METHOD + path template -> SDK call. */
const NEW_OPS: Record<string, Call> = {
  'GET /v1/estamp/states/availability': (c, _p, f) =>
    c.estamp.getStatesAvailability(
      q(f).active === undefined ? {} : { active: q(f).active === 'true' },
    ),
  'GET /v1/estamp/states/{stateCode}': (c, p) => c.estamp.getState(p[0]!),
  'GET /v1/estamp/states/{stateCode}/requirements': (c, p, f) =>
    c.estamp.getStateRequirements(p[0]!, {
      articleCode: q(f).articleCode,
      denomination: q(f).denomination === undefined ? undefined : Number(q(f).denomination),
      category: q(f).category,
    }),
  'GET /v1/estamp/states/{stateCode}/districts': (c, p) => c.estamp.listDistricts(p[0]!),
  'GET /v1/estamp/states/{stateCode}/districts/{districtCode}/sros': (c, p) =>
    c.estamp.listSros(p[0]!, p[1]!),
  'POST /v1/estamp/orders/validate': (c, _p, f) => c.estamp.validateOrder(f.request.body as never),
  'POST /v1/estamp/orders': (c, _p, f) => c.estamp.createOrder(f.request.body as never),
  'GET /v1/estamp/orders': (c, _p, f) =>
    c.estamp.listOrders({ page: Number(q(f).page), limit: Number(q(f).limit) }),
  'GET /v1/estamp/orders/{id}': (c, p) => c.estamp.getOrder(p[0]!),
  'POST /v1/estamp/orders/{id}/cancel': (c, p) => c.estamp.cancelOrder(p[0]!),
  'GET /v1/estamp/orders/{id}/export': (c, p) => c.estamp.exportOrder(p[0]!),
  'GET /v1/estamp/orders/{id}/stamps': (c, p) => c.estamp.listOrderStamps(p[0]!),
  'POST /v1/estamp/orders/{orderId}/documents': (c, p, f) => {
    const file = f.request.multipart!.parts.find((x) => x.name === 'file')!;
    const type = f.request.multipart!.parts.find((x) => x.name === 'type')?.value;
    return c.estamp.uploadOrderDocument(p[0]!, {
      file: new TextEncoder().encode(file.content),
      fileName: file.filename,
      contentType: file.contentType,
      type: type as 'pan_card' | undefined,
    });
  },
  'GET /v1/estamp/stamps/{stampId}': (c, p) => c.estamp.getStamp(p[0]!),
  'POST /v1/estamp/stamps/{stampId}/cancel': (c, p) => c.estamp.cancelStamp(p[0]!),
  'POST /v1/estamp/stamps/{stampId}/replace': (c, p) => c.estamp.replaceStamp(p[0]!),
  'POST /v1/estamp/stamps/{stampId}/pan-card': (c, p, f) =>
    c.estamp.setStampPanCard(p[0]!, f.request.body as never),
  'GET /v1/estamp/stamps/{stampId}/certificate': (c, p) => c.estamp.getStampCertificate(p[0]!),
  'GET /v1/estamp/wallet': (c) => c.estamp.getWallet(),
  'GET /v1/stamp-duty-wallet': (c) => c.stampDutyWallet.getBalance(),
  'POST /v1/stamp-duty-wallet/topup': (c, _p, f) =>
    c.stampDutyWallet.topup(f.request.body as never),
  'GET /v1/stamp-duty-wallet/transactions': (c, _p, f) =>
    c.stampDutyWallet.listTransactions({ limit: Number(q(f).limit) }),
  'GET /v1/stamp-duty-wallet/invoices': (c, _p, f) =>
    c.stampDutyWallet.listInvoices({ limit: Number(q(f).limit) }),
  'GET /v1/stamp-duty-wallet/invoices/{id}': (c, p) => c.stampDutyWallet.getInvoice(p[0]!),
  'GET /v1/service-fee-wallet': (c) => c.serviceFeeWallet.getBalance(),
  'POST /v1/service-fee-wallet/topup': (c, _p, f) =>
    c.serviceFeeWallet.topup(f.request.body as never),
  'GET /v1/service-fee-wallet/transactions': (c, _p, f) =>
    c.serviceFeeWallet.listTransactions({ limit: Number(q(f).limit) }),
  'GET /v1/service-fee-wallet/invoices': (c, _p, f) =>
    c.serviceFeeWallet.listInvoices({ limit: Number(q(f).limit) }),
  'GET /v1/service-fee-wallet/invoices/{id}': (c, p) => c.serviceFeeWallet.getInvoice(p[0]!),
  'GET /v1/account/balance': (c) => c.account.getBalance(),
  'GET /v1/account/usage': (c) => c.account.getUsage(),
};

const ERRORS: Record<number, new (...a: never[]) => Error> = {
  400: ValidationError,
  401: AuthenticationError,
  402: PaymentRequiredError,
  403: PermissionError,
  404: NotFoundError,
  409: ConflictError,
  422: ValidationError,
  429: RateLimitError,
  502: UpstreamError,
  503: UpstreamError,
};

/** Concrete path of a fixture -> values of the template's `{params}`. */
function pathParams(template: string, concrete: string): string[] {
  const re = new RegExp('^' + template.replace(/\{\w+\}/g, '([^/]+)') + '$');
  return (re.exec(concrete) ?? []).slice(1).map(decodeURIComponent);
}

describe.skipIf(!haveSpec)('mock-server conformance, contract 1.2.0', () => {
  let server: Server;
  let base: string;
  const fixtures: Fixture[] = [];
  const get = (key: string, scenario: string) => {
    const [m, ...t] = key.split(' ');
    const f = fixtures.find(
      (x) =>
        x.operation.method === m && x.operation.path === t.join(' ') && x.scenario === scenario,
    );
    if (!f) throw new Error(`no fixture ${key} ${scenario}`);
    return f;
  };
  const mk = (extra: Record<string, unknown> = {}, scenario?: string) =>
    new StampMitra({
      apiKey: KEY,
      baseUrl: base,
      maxRetries: 2,
      sleep: async () => undefined,
      random: () => 0,
      defaultHeaders: scenario ? { 'x-mock-scenario': scenario } : {},
      ...extra,
    });
  const recorded = async (): Promise<Recorded[]> =>
    (await (await fetch(`${base}/__mock/requests`)).json()) as Recorded[];

  beforeAll(async () => {
    const mod = (await import(pathToFileURL(resolve(specDir, 'scripts/mock-server.mjs')).href)) as {
      createMockServer: (o?: unknown) => Server;
      loadFixtures: (dir: string) => unknown;
    };
    const opsDir = resolve(specDir, 'fixtures/operations');
    for (const f of readdirSync(opsDir).filter((n) => n.endsWith('.json'))) {
      fixtures.push(JSON.parse(readFileSync(resolve(opsDir, f), 'utf8')) as Fixture);
    }
    server = mod.createMockServer({ routes: mod.loadFixtures(opsDir) });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));
  beforeEach(async () => {
    await fetch(`${base}/__mock/reset`, { method: 'POST' });
  });

  it('covers the 31 new operations', () => expect(Object.keys(NEW_OPS)).toHaveLength(31));

  describe('success fixtures', () => {
    it.each(Object.keys(NEW_OPS))('%s returns the fixture body over HTTP', async (key) => {
      const f = get(key, 'success');
      const out = await NEW_OPS[key]!(mk(), pathParams(f.operation.path, f.request.path), f);
      expect(out).toEqual(f.response.body);
      const reqs = await recorded();
      expect(reqs).toHaveLength(1);
      const r = reqs[0]!;
      expect(r.method).toBe(f.operation.method);
      expect(r.path).toBe(f.request.path);
      // (the POST /v1/estamp/orders fixture carries a stray page/limit query that the operation does not take)
      if (f.operation.method === 'GET') expect(r.query).toEqual(f.request.query ?? {});
      expect(r.headers.authorization).toBe(`Bearer ${KEY}`);
      if (f.request.body) expect(r.body).toEqual(f.request.body);
    });
  });

  describe('error fixtures', () => {
    const cases = Object.keys(NEW_OPS).flatMap((key) =>
      fixturesFor(key).map((st) => [key, st] as [string, number]),
    );
    function fixturesFor(key: string): number[] {
      // evaluated at collection time: read the directory directly
      const [m, ...t] = key.split(' ');
      const slug = (
        m!.toLowerCase() +
        '-' +
        t
          .join(' ')
          .replace(/[{}]/g, '')
          .replace(/[^A-Za-z0-9]+/g, '-')
          .replace(/^-/, '')
      ).toLowerCase();
      if (!haveSpec) return [];
      return readdirSync(resolve(specDir, 'fixtures/operations'))
        .filter((n) => n.startsWith(slug + '.error-'))
        .map((n) => Number(/error-(\d+)\.json$/.exec(n)![1]))
        .filter((st) => ERRORS[st]);
    }
    it.each(cases)(
      '%s error-%i maps to the typed error with the documented envelope',
      async (key, st) => {
        const f = get(key, 'success');
        const e = get(key, `error-${st}`);
        const err = (await NEW_OPS[key]!(
          mk({ maxRetries: 0 }, `error-${st}`),
          pathParams(f.operation.path, f.request.path),
          f,
        ).catch((x: unknown) => x)) as ValidationError & PaymentRequiredError & RateLimitError;
        expect(err).toBeInstanceOf(ERRORS[st]);
        const env = e.response.body.error;
        expect(err.status).toBe(st);
        expect(err.code).toBe(env.code);
        expect(err.message).toBe(env.message);
        expect(err.requestId).toBe(env.requestId);
        if (env.details?.errors) expect(err.fieldErrors).toEqual(env.details.errors);
        if (env.details?.wallet) expect(err.wallet).toBe(env.details.wallet);
        if (st === 429 && e.response.headers['Retry-After']) {
          expect(err.retryAfter).toBe(Number(e.response.headers['Retry-After']));
        }
      },
    );
  });

  describe('multipart upload', () => {
    it('sends a real multipart body: file part (name, type, bytes) and type part, no JSON content type', async () => {
      const key = 'POST /v1/estamp/orders/{orderId}/documents';
      const f = get(key, 'success');
      const part = f.request.multipart!.parts.find((x) => x.name === 'file')!;
      const out = await NEW_OPS[key]!(mk(), ['estord_9c1f2a3b'], f);
      expect(out).toEqual(f.response.body);
      const [r] = await recorded();
      expect(r!.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
      expect(r!.body.multipart).toEqual([
        {
          name: 'file',
          filename: part.filename,
          contentType: part.contentType,
          size: Buffer.byteLength(part.content!),
        },
        { name: 'type', value: 'pan_card', size: 8 },
      ]);
      expect(r!.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    });
    it('retries a 502 with the whole file re-sent and the same key', async () => {
      const key = 'POST /v1/estamp/orders/{orderId}/documents';
      const f = get(key, 'success');
      const out = await NEW_OPS[key]!(mk({}, 'seq:up:502,200'), ['estord_9c1f2a3b'], f);
      expect(out).toEqual(f.response.body);
      const reqs = await recorded();
      expect(reqs).toHaveLength(2);
      expect(reqs[1]!.body.multipart).toEqual(reqs[0]!.body.multipart);
      expect(reqs[1]!.headers['idempotency-key']).toBe(reqs[0]!.headers['idempotency-key']);
    });
  });

  describe('idempotency and retries', () => {
    const create = () => get('POST /v1/estamp/orders', 'success');
    it('createOrder auto-generates one key and reuses it across 503,503,201', async () => {
      const out = await mk({}, 'seq:c:503,503,200').estamp.createOrder(
        create().request.body as never,
      );
      expect(out).toEqual(create().response.body);
      const reqs = await recorded();
      expect(reqs).toHaveLength(3);
      expect(new Set(reqs.map((r) => r.headers['idempotency-key'])).size).toBe(1);
      expect(reqs[0]!.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    });
    it('createOrder honours a caller key and Retry-After on 429', async () => {
      const sleeps: number[] = [];
      const c = mk({ sleep: async (ms: number) => void sleeps.push(ms) }, 'seq:r:429,200');
      await c.estamp.createOrder(create().request.body as never, { idempotencyKey: 'agr-1-v1' });
      expect(sleeps).toEqual([1000]); // the mock's documented 429 carries Retry-After: 1
      const reqs = await recorded();
      expect(reqs.map((r) => r.headers['idempotency-key'])).toEqual(['agr-1-v1', 'agr-1-v1']);
    });
    it('409 IDEMPOTENCY_IN_PROGRESS is retried after Retry-After with the same key', async () => {
      const sleeps: number[] = [];
      const c = mk({ sleep: async (ms: number) => void sleeps.push(ms) }, 'seq:ip:409,200');
      await c.estamp.createOrder(create().request.body as never);
      expect(sleeps).toEqual([1000]);
      const reqs = await recorded();
      expect(reqs).toHaveLength(2);
      expect(reqs[0]!.headers['idempotency-key']).toBe(reqs[1]!.headers['idempotency-key']);
    });
    it('402 names the short wallet and is not retried', async () => {
      const err = (await mk({}, 'error-402')
        .estamp.createOrder(create().request.body as never)
        .catch((e: unknown) => e)) as PaymentRequiredError;
      expect(err.wallet).toBe('STAMP_DUTY');
      expect(await recorded()).toHaveLength(1);
    });
    it('validate is retried (no key sent) on 503,200', async () => {
      const f = get('POST /v1/estamp/orders/validate', 'success');
      await mk({}, 'seq:v:503,200').estamp.validateOrder(f.request.body as never);
      const reqs = await recorded();
      expect(reqs).toHaveLength(2);
      expect(reqs.every((r) => r.headers['idempotency-key'] === undefined)).toBe(true);
    });
    it('GET 503 honours Retry-After', async () => {
      const sleeps: number[] = [];
      const c = mk({ sleep: async (ms: number) => void sleeps.push(ms) }, 'error-503');
      await expect(c.estamp.getState('MH')).rejects.toBeInstanceOf(UpstreamError);
      // the documented 503 carries Retry-After: 1 for every attempt
      expect(sleeps.every((ms) => ms === 1000 || ms === 0)).toBe(true);
    });

    const NEVER: Array<[string, Call]> = [
      ['POST /v1/estamp/orders/{id}/cancel', NEW_OPS['POST /v1/estamp/orders/{id}/cancel']!],
      [
        'POST /v1/estamp/stamps/{stampId}/cancel',
        NEW_OPS['POST /v1/estamp/stamps/{stampId}/cancel']!,
      ],
      [
        'POST /v1/estamp/stamps/{stampId}/replace',
        NEW_OPS['POST /v1/estamp/stamps/{stampId}/replace']!,
      ],
      [
        'POST /v1/estamp/stamps/{stampId}/pan-card',
        NEW_OPS['POST /v1/estamp/stamps/{stampId}/pan-card']!,
      ],
      ['POST /v1/stamp-duty-wallet/topup', NEW_OPS['POST /v1/stamp-duty-wallet/topup']!],
      ['POST /v1/service-fee-wallet/topup', NEW_OPS['POST /v1/service-fee-wallet/topup']!],
    ];
    it.each(NEVER)(
      '%s is never auto-retried (one request on 503 and on 429)',
      async (key, call) => {
        const f = get(key, 'success');
        for (const st of ['503', '429']) {
          await fetch(`${base}/__mock/reset`, { method: 'POST' });
          const err = await call(
            mk({}, `seq:n${st}:${st},200`),
            pathParams(f.operation.path, f.request.path),
            f,
          ).catch((e: unknown) => e);
          expect(err).toBeInstanceOf(Error);
          const reqs = await recorded();
          expect(reqs).toHaveLength(1);
          expect(reqs[0]!.headers['idempotency-key']).toBeUndefined();
        }
      },
    );
    it('webhook replay is never auto-retried', async () => {
      await expect(mk({}, 'seq:rp:503,200').webhooks.events.replay('evt_1')).rejects.toBeInstanceOf(
        UpstreamError,
      );
      expect(await recorded()).toHaveLength(1);
    });
  });

  describe('typed money fields of the Stamp Duty top-up', () => {
    it('numbers stay numbers and strings stay strings; nothing is computed by the SDK', async () => {
      const f = get('POST /v1/stamp-duty-wallet/topup', 'success');
      const t = await mk().stampDutyWallet.topup(f.request.body as never);
      expect(typeof t.baseAmount).toBe('number');
      expect(typeof t.gstAmount).toBe('number');
      expect(typeof t.totalCharged).toBe('number');
      expect(typeof t.processingFeePercent).toBe('string');
      expect(typeof t.processingFeeAmount).toBe('string');
      expect(typeof t.creditAmount).toBe('string');
      expect(t).toEqual(f.response.body);
      const s = await mk().serviceFeeWallet.topup(
        get('POST /v1/service-fee-wallet/topup', 'success').request.body as never,
      );
      expect(typeof s.totalCharged).toBe('string');
    });
  });
});
