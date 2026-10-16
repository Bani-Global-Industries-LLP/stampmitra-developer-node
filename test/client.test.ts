import { describe, expect, it, vi } from 'vitest';
import {
  AuthenticationError,
  ConflictError,
  ConnectionError,
  NotFoundError,
  PaymentRequiredError,
  PermissionError,
  RateLimitError,
  RequestAbortedError,
  StampMitra,
  StampMitraError,
  TimeoutError,
  UpstreamError,
  ValidationError,
  VERSION,
} from '../src/index.js';
import { makeClient, TEST_KEY } from './helpers.js';
import pkg from '../package.json' with { type: 'json' };

const PAN = { pan: 'ABCDE1234F' };

describe('security hardening', () => {
  const fetchOk = async () => new Response('{}');
  it.each(['http://api.example.org', 'ftp://x.test', 'not a url', 'https://user:pw@api.test'])(
    'rejects insecure/invalid baseUrl %s',
    (baseUrl) => {
      expect(() => new StampMitra({ apiKey: TEST_KEY, baseUrl, fetch: fetchOk })).toThrow(
        StampMitraError,
      );
    },
  );
  it.each([
    'http://localhost:4010',
    'http://127.0.0.1:4010/',
    'http://[::1]:4010',
    'https://x.test/',
  ])('accepts baseUrl %s', (baseUrl) => {
    expect(() => new StampMitra({ apiKey: TEST_KEY, baseUrl, fetch: fetchOk })).not.toThrow();
  });
  it('never follows redirects', async () => {
    let init: RequestInit | undefined;
    const c = new StampMitra({
      apiKey: TEST_KEY,
      fetch: async (_u, i) => ((init = i), new Response('{}')),
    });
    await c.services.list();
    expect(init?.redirect).toBe('error');
  });
  it('does not leak the API key via inspect/JSON', async () => {
    const { inspect } = await import('node:util');
    const c = new StampMitra({ apiKey: TEST_KEY, fetch: fetchOk });
    expect(inspect(c, { depth: null })).not.toContain(TEST_KEY);
    expect(JSON.stringify(c)).not.toContain(TEST_KEY);
  });
});

describe('construction', () => {
  it('version matches package.json', () => expect(VERSION).toBe(pkg.version));
  it('requires a key', () => {
    const prev = process.env.STAMPMITRA_API_KEY;
    delete process.env.STAMPMITRA_API_KEY;
    expect(() => new StampMitra({ fetch: async () => new Response('{}') })).toThrow(
      AuthenticationError,
    );
    if (prev) process.env.STAMPMITRA_API_KEY = prev;
  });
  it('reads env var', () => {
    process.env.STAMPMITRA_API_KEY = 'sk_live_abcdefgh12345678';
    const c = new StampMitra({ fetch: async () => new Response('{}') });
    delete process.env.STAMPMITRA_API_KEY;
    expect(c.environment).toBe('live');
  });
  it('rejects malformed keys unless allowCustomKey, without echoing the key', () => {
    expect(() => new StampMitra({ apiKey: 'nope_secret_value' })).toThrow(/Invalid API key format/);
    try {
      new StampMitra({ apiKey: 'nope_secret_value' });
    } catch (e) {
      expect((e as Error).message).not.toContain('nope_secret_value');
    }
    expect(
      new StampMitra({
        apiKey: 'custom',
        allowCustomKey: true,
        fetch: async () => new Response('{}'),
      }).environment,
    ).toBe('custom');
  });
  it('exposes environment and never serialises the key', () => {
    const { client } = makeClient([200]);
    expect(client.environment).toBe('test');
    expect(JSON.stringify(client)).not.toContain(TEST_KEY);
  });
  it('refuses a live key in a browser runtime', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});
    try {
      const mk = (extra = {}) =>
        new StampMitra({
          apiKey: 'sk_live_abcdefgh12345678',
          fetch: async () => new Response('{}'),
          ...extra,
        });
      expect(() => mk()).toThrow(/browser/);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect(() => mk({ dangerouslyAllowBrowser: true })).not.toThrow();
      expect(warn).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});

describe('requests', () => {
  it('sends auth, content, user-agent headers and JSON body; returns parsed data', async () => {
    const { client, calls } = makeClient(
      [{ status: 200, body: { referenceId: 'R1', valid: true, extraField: 1 } }],
      {
        appInfo: { name: 'myapp', version: '2.0' },
      },
    );
    const res = await client.verify.pan({ pan: ' abcde1234f ', name: 'Rahul' });
    expect(res).toEqual({ referenceId: 'R1', valid: true, extraField: 1 });
    const c = calls[0]!;
    expect(c.url).toBe('https://api-b2b.stampmitra.in/v1/verify/pan');
    expect(c.method).toBe('POST');
    expect(c.headers.Authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(c.headers['Content-Type']).toBe('application/json');
    expect(c.headers.Accept).toBe('application/json');
    expect(c.headers['User-Agent']).toMatch(
      /^stampmitra-node\/0\.1\.0 \(node\/[\d.]+\) myapp\/2\.0$/,
    );
    expect(JSON.parse(c.body!)).toEqual({ pan: 'ABCDE1234F', name: 'Rahul' });
    expect(c.headers['Idempotency-Key']).toBeUndefined();
  });
  it('honours baseUrl, defaultHeaders and per-request headers', async () => {
    const { client, calls } = makeClient([200], {
      baseUrl: 'http://localhost:9/',
      defaultHeaders: { 'X-A': '1' },
    });
    await client.services.list({ headers: { 'X-B': '2' } });
    expect(calls[0]!.url).toBe('http://localhost:9/v1/services');
    expect(calls[0]!.headers['X-A']).toBe('1');
    expect(calls[0]!.headers['X-B']).toBe('2');
  });
  it('encodes path ids and query strings', async () => {
    const { client, calls } = makeClient([200]);
    await client.orders.get('a/b c');
    await client.logs.list({ from: '2026-01-01', status: 'failure', limit: 10 });
    expect(calls[0]!.url).toMatch(/\/v1\/orders\/a%2Fb%20c$/);
    expect(calls[1]!.url).toMatch(/\/v1\/logs\?from=2026-01-01&status=failure&limit=10$/);
  });
  it('withResponse exposes status, headers and requestId', async () => {
    const { client } = makeClient([{ status: 200, headers: { 'x-request-id': 'rq9' }, body: [] }]);
    const { data, response } = await client.services.list().withResponse();
    expect(data).toEqual([]);
    expect(response.status).toBe(200);
    expect(response.requestId).toBe('rq9');
    expect(response.attempts).toBe(1);
  });
  it('treats any 2xx (e.g. 201) as success and falls back to jitter without Retry-After', async () => {
    const { client, sleeps } = makeClient([429, { status: 201, body: { id: 'o1' } }]);
    expect(await client.logs.list().then(() => 'ok')).toBe('ok');
    expect(sleeps).toEqual([500]);
    const c2 = makeClient([{ status: 201, body: { id: 'o1' } }]);
    expect(
      await c2.client.orders.create({
        externalOrderId: 'a',
        externalCustomerId: 'b',
        serviceCode: 'c',
      }),
    ).toEqual({ id: 'o1' });
  });
  it('rejects empty path ids locally', async () => {
    const { client, calls } = makeClient([200]);
    await expect(client.orders.get('')).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });
  it('validation failure is local: no network call', async () => {
    const { client, calls } = makeClient([200]);
    await expect(client.verify.pan({ pan: 'bad' })).rejects.toMatchObject({
      field: 'pan',
      local: true,
    });
    expect(calls).toHaveLength(0);
  });
  it('validateInput:false sends as-is', async () => {
    const { client, calls } = makeClient([200], { validateInput: false });
    await client.verify.pan({ pan: 'bad' });
    expect(JSON.parse(calls[0]!.body!)).toEqual({ pan: 'bad' });
  });
  it('non-JSON success body is an UpstreamError', async () => {
    const { client } = makeClient([{ status: 200, text: '<html>' }]);
    await expect(client.services.list()).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe('error mapping', () => {
  const table: Array<[number, new (...a: never[]) => StampMitraError]> = [
    [400, ValidationError],
    [401, AuthenticationError],
    [402, PaymentRequiredError],
    [403, PermissionError],
    [404, NotFoundError],
    [409, ConflictError],
    [429, RateLimitError],
    [500, UpstreamError],
    [502, UpstreamError],
  ];
  it.each(table)('status %i', async (status, Cls) => {
    const { client } = makeClient([
      {
        status,
        headers: { 'retry-after': '3' },
        body: {
          error: { code: 'CODE', message: 'server says no', requestId: 'rid', field: 'pan' },
        },
      },
    ]);
    // verify POST: never retried, so a single scripted response is enough
    const err = await client.verify.pan(PAN).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Cls);
    const e = err as StampMitraError;
    expect(e.status).toBe(status);
    expect(e.code).toBe('CODE');
    expect(e.message).toBe('server says no');
    expect(e.requestId).toBe('rid');
    expect(e.raw).toMatchObject({ error: { code: 'CODE' } });
    if (status === 400) expect((e as ValidationError).field).toBe('pan');
    if (status === 429) expect((e as RateLimitError).retryAfter).toBe(3);
  });
  it('403 surfaces the server message verbatim', async () => {
    const msg = 'This endpoint requires an IP-allowlisted API key.';
    const { client } = makeClient([
      { status: 403, body: { error: { code: 'FORBIDDEN', message: msg, requestId: 'r' } } },
    ]);
    await expect(
      client.verify.passport({ fileNumber: 'PA1079341954215', dob: '1990-01-01' }),
    ).rejects.toMatchObject({ message: msg });
  });
  it('non-JSON error bodies still map by status', async () => {
    const { client } = makeClient([
      { status: 502, text: '<h1>Bad Gateway</h1>', headers: { 'x-request-id': 'edge1' } },
    ]);
    const e = (await client.verify.pan(PAN).catch((x: unknown) => x)) as UpstreamError;
    expect(e).toBeInstanceOf(UpstreamError);
    expect(e.status).toBe(502);
    expect(e.message).toContain('Bad Gateway');
    expect(e.requestId).toBe('edge1');
  });
  it('unknown 4xx maps to the base error', async () => {
    const { client } = makeClient([418]);
    const e = await client.services.list().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(StampMitraError);
    expect((e as StampMitraError).status).toBe(418);
  });
  it('Retry-After as HTTP date', async () => {
    const date = new Date(Date.now() + 10_000).toUTCString();
    const { client } = makeClient([{ status: 429, headers: { 'retry-after': date } }]);
    const e = (await client.verify.pan(PAN).catch((x: unknown) => x)) as RateLimitError;
    expect(e.retryAfter).toBeGreaterThan(5);
  });
  it('connection error and timeout', async () => {
    const a = makeClient(['connection_error'], { maxRetries: 0 });
    await expect(a.client.services.list()).rejects.toBeInstanceOf(ConnectionError);
    const b = makeClient(['timeout'], { maxRetries: 0, timeout: 10 });
    await expect(b.client.services.list()).rejects.toBeInstanceOf(TimeoutError);
  });
  it('caller abort', async () => {
    const { client } = makeClient(['timeout']);
    const ac = new AbortController();
    const p = client.services.list({ signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toBeInstanceOf(RequestAbortedError);
  });
});

describe('retries', () => {
  it('GET retries 503 with full-jitter backoff (injected sleep)', async () => {
    const { client, calls, sleeps } = makeClient([503, 503, 200], { random: () => 1 });
    await client.services.list();
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([500, 1000]); // random()=1 -> upper bound of base*2^attempt
  });
  it('backoff is capped at 8s and jittered', async () => {
    const { client, sleeps } = makeClient([503, 503, 503, 503, 503, 503, 503, 200], {
      random: () => 0.5,
    });
    await client.services.list({ maxRetries: 8 });
    expect(Math.max(...sleeps)).toBe(4000);
    expect(sleeps[0]).toBe(250);
  });
  it('honours Retry-After', async () => {
    const { client, sleeps } = makeClient([{ status: 429, headers: { 'retry-after': '2' } }, 200]);
    await client.logs.list();
    expect(sleeps).toEqual([2000]);
  });
  it('exhausts retries and throws the last error', async () => {
    const { client, calls } = makeClient([503]);
    await expect(client.services.list()).rejects.toBeInstanceOf(UpstreamError);
    expect(calls).toHaveLength(3);
  });
  it('does not retry 4xx', async () => {
    const { client, calls } = makeClient([404, 200]);
    await expect(client.orders.get('x')).rejects.toBeInstanceOf(NotFoundError);
    expect(calls).toHaveLength(1);
  });
  it('retries connection errors and timeouts on GET', async () => {
    const { client, calls } = makeClient(['connection_error', 'timeout', 200], { timeout: 10 });
    await client.services.list();
    expect(calls).toHaveLength(3);
  });
  it('per-request maxRetries override', async () => {
    const { client, calls } = makeClient([503, 200]);
    await expect(client.services.list({ maxRetries: 0 })).rejects.toBeInstanceOf(UpstreamError);
    expect(calls).toHaveLength(1);
  });
});

describe('idempotency', () => {
  const orderBody = { externalOrderId: 'o1', externalCustomerId: 'c1', serviceCode: 'estamp.x' };
  it('auto-generates a UUIDv4 key and reuses it across retries', async () => {
    const { client, calls } = makeClient([502, 503, 200]);
    await client.orders.create(orderBody);
    expect(calls).toHaveLength(3);
    const keys = calls.map((c) => c.headers['Idempotency-Key']);
    expect(keys[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(new Set(keys).size).toBe(1);
  });
  it('different calls get different keys', async () => {
    const { client, calls } = makeClient([200]);
    await client.orders.create(orderBody);
    await client.orders.create(orderBody);
    expect(calls[0]!.headers['Idempotency-Key']).not.toBe(calls[1]!.headers['Idempotency-Key']);
  });
  it('uses the caller-supplied key', async () => {
    const { client, calls } = makeClient([200]);
    await client.payments.intents.create({ orderId: 'o' }, { idempotencyKey: 'mine' });
    expect(calls[0]!.headers['Idempotency-Key']).toBe('mine');
  });
  it('parties also auto-keys; duty/replay do not and are not retried', async () => {
    const a = makeClient([200]);
    await a.client.estamp.addParties('o1', { parties: [] });
    expect(a.calls[0]!.headers['Idempotency-Key']).toBeTruthy();
    const b = makeClient([503, 200]);
    await expect(b.client.estamp.calculateDuty({ state: 'MH' })).rejects.toBeInstanceOf(
      UpstreamError,
    );
    expect(b.calls).toHaveLength(1);
    expect(b.calls[0]!.headers['Idempotency-Key']).toBeUndefined();
    const c = makeClient([503, 200]);
    await expect(c.client.webhooks.events.replay('e1')).rejects.toBeInstanceOf(UpstreamError);
    expect(c.calls).toHaveLength(1);
  });
  it('an explicit key on duty/calculate enables retries', async () => {
    const { client, calls } = makeClient([503, 200]);
    await client.estamp.calculateDuty({ state: 'MH' }, { idempotencyKey: 'k' });
    expect(calls).toHaveLength(2);
  });
  it('orders.create validates required fields locally', async () => {
    const { client, calls } = makeClient([200]);
    await expect(client.orders.create({ externalOrderId: 'x' } as never)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(calls).toHaveLength(0);
  });
});

describe('billed verification POSTs', () => {
  it.each([502, 503, 504, 429])('never retried on %i', async (status) => {
    const { client, calls } = makeClient([status, 200]);
    await expect(client.verify.pan(PAN)).rejects.toBeInstanceOf(StampMitraError);
    expect(calls).toHaveLength(1);
  });
  it('never retried after a timeout', async () => {
    const { client, calls } = makeClient(['timeout', 200], { timeout: 10 });
    await expect(client.verify.pan(PAN)).rejects.toBeInstanceOf(TimeoutError);
    expect(calls).toHaveLength(1);
  });
  it('never retried when the failure came after the response started', async () => {
    const { client, calls } = makeClient(['body_error', 200]);
    await expect(client.verify.pan(PAN)).rejects.toBeInstanceOf(ConnectionError);
    expect(calls).toHaveLength(1);
  });
  it('retried on a connection error before any response', async () => {
    const { client, calls } = makeClient(['connection_error', 200]);
    await client.verify.pan(PAN);
    expect(calls).toHaveLength(2);
  });
  it('a negative result is a normal 200 result', async () => {
    const { client } = makeClient([{ status: 200, body: { referenceId: 'R', valid: false } }]);
    expect((await client.verify.pan(PAN)).valid).toBe(false);
  });
});

describe('logging', () => {
  it('logs nothing without a logger', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { client } = makeClient([200]);
    await client.verify.pan(PAN);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('redacts keys, identifiers and personal data', async () => {
    const logs: Array<{ message: string; meta?: Record<string, unknown> }> = [];
    const { client } = makeClient(
      [
        {
          status: 200,
          body: {
            referenceId: 'R',
            pan: 'ABCDE1234F',
            registeredName: 'RAHUL KUMAR',
            message: 'PAN ABCDE1234F ok',
            accountNumber: '000123456789',
          },
        },
      ],
      {
        logger: { debug: (message, meta) => logs.push({ message, meta }) },
        defaultHeaders: { 'x-api-key': TEST_KEY },
      },
    );
    await client.verify.pan({ pan: 'ABCDE1234F', name: 'Rahul Kumar' });
    const dump = JSON.stringify(logs);
    expect(logs.length).toBe(2);
    for (const secret of [TEST_KEY, 'ABCDE1234F', 'RAHUL KUMAR', 'Rahul Kumar', '000123456789']) {
      expect(dump).not.toContain(secret);
    }
    expect(dump).toContain('[REDACTED]');
    expect(dump).toContain('******234F');
  });
  it('a throwing logger does not break the request', async () => {
    const { client } = makeClient([200], {
      logger: {
        debug: () => {
          throw new Error('boom');
        },
      },
    });
    await expect(client.services.list()).resolves.toBeDefined();
  });
});

describe('pagination', () => {
  it('logs.listAll follows nextCursor and passes filters', async () => {
    const { client, calls } = makeClient([
      { status: 200, body: { items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'c1' } },
      { status: 200, body: { items: [{ id: 'c' }], nextCursor: 'c2' } },
      { status: 200, body: { items: [], nextCursor: null } },
    ]);
    const ids: string[] = [];
    for await (const e of client.logs.listAll({ service: 'estamp', limit: 2 })) ids.push(e.id);
    expect(ids).toEqual(['a', 'b', 'c']);
    expect(calls).toHaveLength(3);
    expect(calls[0]!.url).toContain('service=estamp&limit=2');
    expect(calls[0]!.url).not.toContain('cursor');
    expect(calls[1]!.url).toContain('cursor=c1');
    expect(calls[2]!.url).toContain('cursor=c2');
  });
  it('stops if the server repeats a cursor', async () => {
    const { client, calls } = makeClient([
      { status: 200, body: { items: [{ id: 'a' }], nextCursor: 'same' } },
    ]);
    const out: unknown[] = [];
    for await (const e of client.webhooks.events.listAll()) out.push(e);
    expect(calls).toHaveLength(2);
    expect(out).toHaveLength(2);
  });
});

describe('idempotency key CSPRNG', () => {
  const orderBody = { externalOrderId: 'o1', externalCustomerId: 'c1', serviceCode: 'estamp.x' };
  it('works without globalThis.crypto by loading node webcrypto', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      const { client, calls } = makeClient([200]);
      await client.orders.create(orderBody);
      expect(calls[0]!.headers['Idempotency-Key']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('throws a clear error (no Math.random) when no CSPRNG exists', async () => {
    const { uuidv4 } = await import('../src/http.js');
    vi.stubGlobal('crypto', undefined);
    const rnd = vi.spyOn(Math, 'random');
    try {
      await expect(uuidv4(async () => undefined)).rejects.toThrow(
        /Pass `idempotencyKey` explicitly/,
      );
      expect(rnd).not.toHaveBeenCalled();
    } finally {
      rnd.mockRestore();
      vi.unstubAllGlobals();
    }
  });
  it('uses getRandomValues for a v4 UUID when randomUUID is absent', async () => {
    const { uuidv4 } = await import('../src/http.js');
    vi.stubGlobal('crypto', undefined);
    const id = await uuidv4(async () => ({
      getRandomValues: (a) => {
        (a as unknown as Uint8Array).fill(0xff);
        return a;
      },
    }));
    vi.unstubAllGlobals();
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });
});
