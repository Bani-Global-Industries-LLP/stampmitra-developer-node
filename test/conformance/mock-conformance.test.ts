/**
 * Live-ish conformance: runs the SDK over real HTTP against the spec repo's mock server
 * (stampmitra-developer-openapi/scripts/mock-server.mjs) and the shared fixtures.
 *
 * Needs a checkout of the spec repo: set STAMPMITRA_SPEC_DIR (CI does this). Without it the suite is
 * skipped locally; in CI (CI=true) a missing spec dir is a failure.
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
  ConnectionError,
  NotFoundError,
  PaymentRequiredError,
  PermissionError,
  RateLimitError,
  StampMitra,
  TimeoutError,
  UpstreamError,
  ValidationError,
  type RequestOptions,
} from '../../src/index.js';
import * as nodeWh from '../../src/webhooks-node.js';
import * as edgeWh from '../../src/webhooks.js';
import * as v from '../../src/validators.js';

const specDir = process.env.STAMPMITRA_SPEC_DIR ? resolve(process.env.STAMPMITRA_SPEC_DIR) : '';
const haveSpec = specDir !== '' && existsSync(resolve(specDir, 'scripts/mock-server.mjs'));
if (!haveSpec && process.env.CI) {
  throw new Error(
    'STAMPMITRA_SPEC_DIR must point to a checkout of stampmitra-developer-openapi in CI',
  );
}

const KEY = 'sk_test_abcdefgh12345678';
type Json = Record<string, unknown>;
interface Fixture {
  operation: { method: string; path: string };
  scenario: string;
  request: { body?: Json };
  response: { status: number; body: unknown };
}
interface Recorded {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

describe.skipIf(!haveSpec)('mock-server conformance', () => {
  let server: Server;
  let base: string;
  const fixtures = new Map<string, Fixture>();

  const fx = (method: string, path: string, scenario = 'success'): Fixture => {
    const f = fixtures.get(`${method} ${path} ${scenario}`);
    if (!f) throw new Error(`no fixture ${method} ${path} ${scenario}`);
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
      const j = JSON.parse(readFileSync(resolve(opsDir, f), 'utf8')) as Fixture;
      fixtures.set(`${j.operation.method} ${j.operation.path} ${j.scenario}`, j);
    }
    server = mod.createMockServer({ routes: mod.loadFixtures(opsDir) });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));
  beforeEach(async () => {
    await fetch(`${base}/__mock/reset`, { method: 'POST' });
  });

  describe('all 31 operations', () => {
    const body = (m: string, p: string): Json => fx(m, p).request.body ?? {};
    type Op = [string, string, (c: StampMitra, o?: RequestOptions) => Promise<unknown>, string];
    const ops: Op[] = [
      [
        'POST',
        '/v1/verify/pan',
        (c, o) => c.verify.pan(body('POST', '/v1/verify/pan') as never, o),
        '/v1/verify/pan',
      ],
      [
        'POST',
        '/v1/verify/gstin',
        (c, o) => c.verify.gstin(body('POST', '/v1/verify/gstin') as never, o),
        '/v1/verify/gstin',
      ],
      [
        'POST',
        '/v1/verify/rc',
        (c, o) => c.verify.rc(body('POST', '/v1/verify/rc') as never, o),
        '/v1/verify/rc',
      ],
      [
        'POST',
        '/v1/verify/voter-id',
        (c, o) => c.verify.voterId(body('POST', '/v1/verify/voter-id') as never, o),
        '/v1/verify/voter-id',
      ],
      [
        'POST',
        '/v1/verify/driving-license',
        (c, o) => c.verify.drivingLicense(body('POST', '/v1/verify/driving-license') as never, o),
        '/v1/verify/driving-license',
      ],
      [
        'POST',
        '/v1/verify/passport',
        (c, o) => c.verify.passport(body('POST', '/v1/verify/passport') as never, o),
        '/v1/verify/passport',
      ],
      [
        'POST',
        '/v1/verify/cin',
        (c, o) => c.verify.cin(body('POST', '/v1/verify/cin') as never, o),
        '/v1/verify/cin',
      ],
      [
        'POST',
        '/v1/verify/udyam',
        (c, o) => c.verify.udyam(body('POST', '/v1/verify/udyam') as never, o),
        '/v1/verify/udyam',
      ],
      [
        'POST',
        '/v1/verify/pan-to-gstin',
        (c, o) => c.verify.panToGstin(body('POST', '/v1/verify/pan-to-gstin') as never, o),
        '/v1/verify/pan-to-gstin',
      ],
      [
        'POST',
        '/v1/verify/pan-to-udyam',
        (c, o) => c.verify.panToUdyam(body('POST', '/v1/verify/pan-to-udyam') as never, o),
        '/v1/verify/pan-to-udyam',
      ],
      [
        'POST',
        '/v1/verify/bank-account',
        (c, o) => c.verify.bankAccount(body('POST', '/v1/verify/bank-account') as never, o),
        '/v1/verify/bank-account',
      ],
      ['GET', '/v1/services', (c, o) => c.services.list(o), '/v1/services'],
      [
        'GET',
        '/v1/services/{serviceCode}',
        (c, o) => c.services.get('svc_1', o),
        '/v1/services/svc_1',
      ],
      [
        'GET',
        '/v1/estamp/schema/{serviceCode}',
        (c, o) => c.estamp.getSchema('svc_1', o),
        '/v1/estamp/schema/svc_1',
      ],
      ['GET', '/v1/estamp/states', (c, o) => c.estamp.listStates(o), '/v1/estamp/states'],
      [
        'GET',
        '/v1/estamp/states/{stateCode}/instruments',
        (c, o) => c.estamp.listInstruments('MH', o),
        '/v1/estamp/states/MH/instruments',
      ],
      [
        'GET',
        '/v1/estamp/instruments/{instrumentCode}/articles',
        (c, o) => c.estamp.listArticles('INS1', o),
        '/v1/estamp/instruments/INS1/articles',
      ],
      [
        'POST',
        '/v1/estamp/duty/calculate',
        (c, o) => c.estamp.calculateDuty(body('POST', '/v1/estamp/duty/calculate') as never, o),
        '/v1/estamp/duty/calculate',
      ],
      [
        'POST',
        '/v1/estamp/orders/{orderId}/parties',
        (c, o) =>
          c.estamp.addParties(
            'ord_1',
            body('POST', '/v1/estamp/orders/{orderId}/parties') as never,
            o,
          ),
        '/v1/estamp/orders/ord_1/parties',
      ],
      [
        'POST',
        '/v1/orders',
        (c, o) => c.orders.create(body('POST', '/v1/orders') as never, o),
        '/v1/orders',
      ],
      ['GET', '/v1/orders/{id}', (c, o) => c.orders.get('ord_1', o), '/v1/orders/ord_1'],
      [
        'GET',
        '/v1/orders/{id}/status',
        (c, o) => c.orders.getStatus('ord_1', o),
        '/v1/orders/ord_1/status',
      ],
      [
        'GET',
        '/v1/orders/{id}/payment',
        (c, o) => c.orders.getPayment('ord_1', o),
        '/v1/orders/ord_1/payment',
      ],
      [
        'GET',
        '/v1/orders/{id}/documents',
        (c, o) => c.orders.listDocuments('ord_1', o),
        '/v1/orders/ord_1/documents',
      ],
      [
        'GET',
        '/v1/orders/{id}/documents/{documentId}/download',
        (c, o) => c.orders.getDocumentDownload('ord_1', 'doc_1', o),
        '/v1/orders/ord_1/documents/doc_1/download',
      ],
      [
        'POST',
        '/v1/payments/intents',
        (c, o) => c.payments.intents.create(body('POST', '/v1/payments/intents') as never, o),
        '/v1/payments/intents',
      ],
      [
        'GET',
        '/v1/payments/intents/{id}',
        (c, o) => c.payments.intents.get('pi_1', o),
        '/v1/payments/intents/pi_1',
      ],
      ['GET', '/v1/usage/summary', (c, o) => c.usage.summary(o), '/v1/usage/summary'],
      ['GET', '/v1/logs', (c, o) => c.logs.list({}, o), '/v1/logs'],
      [
        'GET',
        '/v1/webhooks/events',
        (c, o) => c.webhooks.events.list({}, o),
        '/v1/webhooks/events',
      ],
      [
        'POST',
        '/v1/webhooks/events/{id}/replay',
        (c, o) => c.webhooks.events.replay('evt_1', o),
        '/v1/webhooks/events/evt_1/replay',
      ],
    ];

    it('covers 31 operations', () => expect(ops).toHaveLength(31));

    it.each(ops)(
      '%s %s returns the fixture body over HTTP',
      async (method, template, call, path) => {
        const out = await call(mk());
        expect(out).toEqual(fx(method, template).response.body);
        const reqs = await recorded();
        expect(reqs).toHaveLength(1);
        expect(reqs[0]!.method).toBe(method);
        expect(reqs[0]!.path).toBe(path);
        expect(reqs[0]!.headers.authorization).toBe(`Bearer ${KEY}`);
        expect(reqs[0]!.headers['user-agent']).toMatch(/^stampmitra-node\//);
      },
    );
  });

  describe('error status mapping', () => {
    const cases: Array<[number, new (...a: never[]) => Error]> = [
      [400, ValidationError],
      [401, AuthenticationError],
      [402, PaymentRequiredError],
      [403, PermissionError],
      [404, NotFoundError],
      [409, ConflictError],
      [422, ValidationError],
      [429, RateLimitError],
      [500, UpstreamError],
      [502, UpstreamError],
      [503, UpstreamError],
      [504, UpstreamError],
    ];
    it.each(cases)('GET %i maps to the right class (no retries)', async (status, Cls) => {
      const c = mk({ maxRetries: 0 }, `error-${status}`);
      const err = await c.services.list().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Cls);
      expect((err as { status: number }).status).toBe(status);
      expect((err as { requestId?: string }).requestId).toBeTruthy();
      expect(String((err as Error).message)).not.toContain(KEY);
    });

    it('documented fixture error body fields surface (code, message, requestId)', async () => {
      const f = fx('POST', '/v1/verify/pan', 'error-400');
      const err = (await mk({}, 'error-400')
        .verify.pan({ pan: 'ABCDE1234F' })
        .catch((e: unknown) => e)) as ValidationError;
      const env = (f.response.body as { error: { code: string; message: string } }).error;
      expect(err.code).toBe(env.code);
      expect(err.message).toBe(env.message);
    });

    it('429 with Retry-After exposes retryAfter; GET retries honour it and succeed', async () => {
      const err = (await mk({ maxRetries: 0 }, 'error-429')
        .services.list()
        .catch((e: unknown) => e)) as RateLimitError;
      expect(err.retryAfter).toBe(1);
      const sleeps: number[] = [];
      const c = mk({ sleep: async (ms: number) => void sleeps.push(ms) }, 'seq:ra:429,200');
      await c.services.list();
      expect(sleeps).toEqual([1000]);
    });

    it('429 without Retry-After leaves retryAfter undefined', async () => {
      const f = fx('POST', '/v1/verify/pan', 'error-429');
      expect(f.response.status).toBe(429);
      const raw = new Response('{"error":{"code":"TOO_MANY_REQUESTS","message":"x"}}', {
        status: 429,
      });
      const c = new StampMitra({
        apiKey: KEY,
        baseUrl: base,
        maxRetries: 0,
        fetch: async () => raw,
      });
      const err = (await c.services.list().catch((e: unknown) => e)) as RateLimitError;
      expect(err).toBeInstanceOf(RateLimitError);
      expect(err.retryAfter).toBeUndefined();
    });

    it('non-JSON error body still maps by status', async () => {
      const c = new StampMitra({
        apiKey: KEY,
        baseUrl: base,
        maxRetries: 0,
        fetch: async () => new Response('<html>Bad Gateway</html>', { status: 502 }),
      });
      const err = await c.services.list().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UpstreamError);
    });

    it('ignores unknown extra response fields and preserves them', async () => {
      const c = new StampMitra({
        apiKey: KEY,
        baseUrl: base,
        fetch: async () => new Response('{"items":[],"brandNewField":{"x":1}}', { status: 200 }),
      });
      const out = (await c.services.list()) as unknown as Json;
      expect(out.brandNewField).toEqual({ x: 1 });
    });
  });

  describe('retries and idempotency', () => {
    it('GET seq 503,503,200 succeeds on attempt 3', async () => {
      const out = await mk({}, 'seq:g:503,503,200').services.list();
      expect(out).toEqual(fx('GET', '/v1/services').response.body);
      expect(await recorded()).toHaveLength(3);
    });

    it('GET seq 503,503,503 exhausts retries (3 attempts) and throws UpstreamError', async () => {
      const err = await mk({}, 'seq:h:503')
        .services.list()
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UpstreamError);
      expect(await recorded()).toHaveLength(3);
    });

    it('POST /v1/orders reuses one Idempotency-Key across retries', async () => {
      const b = fx('POST', '/v1/orders').request.body as never;
      const out = await mk({}, 'seq:o:503,503,200').orders.create(b);
      expect(out).toEqual(fx('POST', '/v1/orders').response.body);
      const reqs = await recorded();
      expect(reqs).toHaveLength(3);
      const keys = new Set(reqs.map((r) => r.headers['idempotency-key']));
      expect(keys.size).toBe(1);
      expect([...keys][0]).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('caller-supplied idempotencyKey is sent verbatim on every attempt', async () => {
      const b = fx('POST', '/v1/payments/intents').request.body as never;
      await mk({}, 'seq:p:502,200').payments.intents.create(b, { idempotencyKey: 'my-key-1' });
      const reqs = await recorded();
      expect(reqs.map((r) => r.headers['idempotency-key'])).toEqual(['my-key-1', 'my-key-1']);
    });

    it('verification POST 503,503,200 makes 3 attempts with the same auto key', async () => {
      const b = fx('POST', '/v1/verify/pan').request.body as never;
      const out = await mk({}, 'seq:v:503,503,200').verify.pan(b);
      expect(out).toEqual(fx('POST', '/v1/verify/pan').response.body);
      const reqs = await recorded();
      expect(reqs).toHaveLength(3);
      const keys = new Set(reqs.map((r) => r.headers['idempotency-key']));
      expect(keys.size).toBe(1);
      expect([...keys][0]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('verification POST keeps a caller-supplied key on every attempt', async () => {
      const b = fx('POST', '/v1/verify/pan').request.body as never;
      await mk({}, 'seq:vk:503,200').verify.pan(b, { idempotencyKey: 'caller-key-9' });
      const reqs = await recorded();
      expect(reqs.map((r) => r.headers['idempotency-key'])).toEqual([
        'caller-key-9',
        'caller-key-9',
      ]);
    });

    it('verification POST 429 is retried (same key) and succeeds', async () => {
      const b = fx('POST', '/v1/verify/pan').request.body as never;
      await mk({}, 'seq:v429:429,200').verify.pan(b);
      const reqs = await recorded();
      expect(reqs).toHaveLength(2);
      expect(reqs[0]!.headers['idempotency-key']).toBe(reqs[1]!.headers['idempotency-key']);
    });

    it('webhook replay is never auto-keyed and not retried after a 503', async () => {
      const err = await mk({}, 'seq:rp:503,200')
        .webhooks.events.replay('evt_1')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UpstreamError);
      const reqs = await recorded();
      expect(reqs).toHaveLength(1);
      expect(reqs[0]!.headers['idempotency-key']).toBeUndefined();
    });

    it('verification POST IS retried after a pre-response connection drop', async () => {
      const b = fx('POST', '/v1/verify/pan').request.body as never;
      const out = await mk({}, 'seq:c:conn,200').verify.pan(b);
      expect(out).toEqual(fx('POST', '/v1/verify/pan').response.body);
      expect(await recorded()).toHaveLength(2);
    });

    it('GET seq conn,200 retries through a dropped connection', async () => {
      await mk({}, 'seq:d:conn,200').services.list();
      expect(await recorded()).toHaveLength(2);
    });

    it('timeout: a keyed verification POST is retried with the same key, then TimeoutError', async () => {
      const b = fx('POST', '/v1/verify/pan').request.body as never;
      const err = await mk({ timeout: 50, maxRetries: 1 }, 'delay:400')
        .verify.pan(b)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(TimeoutError);
      await new Promise((r) => setTimeout(r, 450));
      const reqs = await recorded();
      expect(reqs).toHaveLength(2);
      expect(reqs[0]!.headers['idempotency-key']).toBe(reqs[1]!.headers['idempotency-key']);
    });

    it('connection refused raises ConnectionError (after retries for GET)', async () => {
      const c = new StampMitra({
        apiKey: KEY,
        baseUrl: 'http://127.0.0.1:1',
        maxRetries: 1,
        sleep: async () => undefined,
      });
      const err = await c.services.list().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConnectionError);
      expect(String((err as Error).message)).not.toContain(KEY);
    });
  });

  describe('pagination (logs, webhook events)', () => {
    it('listAll follows nextCursor across 3 pages', async () => {
      const pages = ['c1', 'c2', null];
      let n = 0;
      const realFetch = globalThis.fetch;
      const c = new StampMitra({
        apiKey: KEY,
        baseUrl: base,
        fetch: async (url, init) => {
          const r = await realFetch(url, init);
          const j = (await r.json()) as { items: unknown[]; nextCursor: string | null };
          j.nextCursor = pages[n++] ?? null;
          return new Response(JSON.stringify(j), { status: 200 });
        },
      });
      const items: unknown[] = [];
      for await (const e of c.logs.listAll({ service: 'pan.verify', limit: 1 })) items.push(e);
      expect(items).toHaveLength(3);
      const reqs = (await recorded()).filter((r) => r.path === '/v1/logs');
      expect(reqs.map((r) => r.query.cursor)).toEqual([undefined, 'c1', 'c2']);
      expect(reqs.every((r) => r.query.service === 'pan.verify' && r.query.limit === '1')).toBe(
        true,
      );
    });

    it('single page with null cursor yields once', async () => {
      const items: unknown[] = [];
      for await (const e of mk().logs.listAll()) items.push(e);
      expect(items.length).toBeGreaterThan(0);
      expect((await recorded()).filter((r) => r.path === '/v1/logs')).toHaveLength(1);
    });
  });

  describe('shared fixtures', () => {
    interface WhVector {
      name: string;
      secret: string;
      timestamp: string;
      payload: string;
      signature: string;
      expected: { valid: boolean; reason?: string } | boolean | string;
      [k: string]: unknown;
    }
    const wh = JSON.parse(
      readFileSync(resolve(specDir, 'fixtures/webhook-signatures.json'), 'utf8'),
    ) as {
      now: number;
      toleranceSeconds: number;
      vectors: WhVector[];
    };
    const isValid = (x: WhVector['expected']): boolean =>
      typeof x === 'boolean' ? x : typeof x === 'string' ? x === 'valid' : x.valid;

    it('has vectors', () => expect(wh.vectors.length).toBeGreaterThan(3));
    it.each(wh.vectors.map((x) => [x.name, x] as const))(
      'webhook vector %s (sync + async)',
      async (_n, x) => {
        const opts = { toleranceSeconds: wh.toleranceSeconds, now: wh.now * 1000 };
        const want = isValid(x.expected);
        const headers = { 'X-Webhook-Signature': x.signature, 'X-Webhook-Timestamp': x.timestamp };
        expect(nodeWh.verifySignature(x.payload, x.timestamp, x.signature, x.secret, opts)).toBe(
          want,
        );
        expect(
          await edgeWh.verifySignatureAsync(x.payload, x.timestamp, x.signature, x.secret, opts),
        ).toBe(want);
        if (want) {
          const parsed = JSON.parse(x.payload) as unknown;
          expect(
            nodeWh.constructEvent(x.payload, x.timestamp, x.signature, x.secret, opts),
          ).toEqual(parsed);
          expect(nodeWh.constructEventFromHeaders(x.payload, headers, x.secret, opts)).toEqual(
            parsed,
          );
          expect(
            await edgeWh.constructEventFromHeaders(x.payload, headers, x.secret, opts),
          ).toEqual(parsed);
        } else {
          expect(() =>
            nodeWh.constructEvent(x.payload, x.timestamp, x.signature, x.secret, opts),
          ).toThrow();
          await expect(
            edgeWh.constructEvent(x.payload, x.timestamp, x.signature, x.secret, opts),
          ).rejects.toThrow();
        }
      },
    );

    const vals = JSON.parse(readFileSync(resolve(specDir, 'fixtures/validators.json'), 'utf8')) as {
      validators: Record<string, { pattern: string; valid: string[]; invalid: string[] }>;
    };
    const norm: Record<string, (x: unknown) => string> = {
      pan: v.normalizePan,
      gstin: v.normalizeGstin,
      ifsc: v.normalizeIfsc,
      cin: v.normalizeCin,
      udyam: v.normalizeUdyam,
      vehicleNumber: v.normalizeVehicleNumber,
      bankAccount: v.normalizeAccountNumber,
      passport: v.normalizePassportFileNumber,
      drivingLicense: v.normalizeDrivingLicense,
      voterId: v.normalizeVoterId,
    };
    it('every spec validator has an SDK counterpart', () => {
      for (const k of Object.keys(vals.validators)) expect(norm[k], k).toBeTypeOf('function');
    });
    for (const [k, spec] of Object.entries(vals.validators)) {
      it(`validator ${k}: ${spec.valid.length} valid / ${spec.invalid.length} invalid vectors`, () => {
        const re = new RegExp(spec.pattern);
        for (const s of spec.valid) expect(re.test(norm[k]!(s)), s).toBe(true);
        for (const s of spec.invalid)
          expect(() => norm[k]!(s), JSON.stringify(s)).toThrow(ValidationError);
      });
    }
  });
});
