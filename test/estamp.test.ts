import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  PaymentRequiredError,
  RateLimitError,
  UpstreamError,
  ValidationError,
} from '../src/index.js';
import { makeClient } from './helpers.js';

const ORDER = {
  reference: 'r1',
  stamps: [{ state: 'MH', articleCode: 'A', denomination: 500, firstParty: 'Jane Doe' }],
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createOrder idempotency', () => {
  it('auto-generates a UUIDv4 Idempotency-Key when the caller omits it, reused across retries', async () => {
    const { client, calls } = makeClient([503, 429, 201]);
    await client.estamp.createOrder(ORDER);
    expect(calls).toHaveLength(3);
    const keys = new Set(calls.map((c) => c.headers['Idempotency-Key']));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toMatch(UUID);
  });
  it('a caller key wins and different calls get different generated keys', async () => {
    const a = makeClient([201]);
    await a.client.estamp.createOrder(ORDER, { idempotencyKey: 'lease-1-v1' });
    expect(a.calls[0]!.headers['Idempotency-Key']).toBe('lease-1-v1');
    const b = makeClient([201]);
    await b.client.estamp.createOrder(ORDER);
    await b.client.estamp.createOrder(ORDER);
    expect(b.calls[0]!.headers['Idempotency-Key']).not.toBe(b.calls[1]!.headers['Idempotency-Key']);
  });
  it('409 IDEMPOTENCY_IN_PROGRESS honours Retry-After and resends with the same key', async () => {
    const { client, calls, sleeps } = makeClient([
      {
        status: 409,
        headers: { 'Retry-After': '3' },
        body: { error: { code: 'IDEMPOTENCY_IN_PROGRESS', message: 'm', requestId: 'r' } },
      },
      201,
    ]);
    await client.estamp.createOrder(ORDER);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([3000]);
    expect(calls[0]!.headers['Idempotency-Key']).toBe(calls[1]!.headers['Idempotency-Key']);
  });
  it('any other 409 is a state conflict and is not retried', async () => {
    const { client, calls } = makeClient([
      { status: 409, body: { error: { code: 'CONFLICT', message: 'm', requestId: 'r' } } },
      201,
    ]);
    await expect(client.estamp.createOrder(ORDER)).rejects.toBeInstanceOf(ConflictError);
    expect(calls).toHaveLength(1);
  });
  it.each([429, 503])('honours Retry-After on %i', async (status) => {
    const { client, sleeps } = makeClient([{ status, headers: { 'Retry-After': '4' } }, 201]);
    await client.estamp.createOrder(ORDER);
    expect(sleeps).toEqual([4000]);
  });
});

describe('never auto-retried', () => {
  const ops: Array<[string, (c: ReturnType<typeof makeClient>['client']) => Promise<unknown>]> = [
    ['cancelOrder', (c) => c.estamp.cancelOrder('o1')],
    ['cancelStamp', (c) => c.estamp.cancelStamp('s1')],
    ['replaceStamp', (c) => c.estamp.replaceStamp('s1')],
    [
      'setStampPanCard',
      (c) => c.estamp.setStampPanCard('s1', { panCardImage: 'https://x.example/p.png' }),
    ],
    ['stampDutyWallet.topup', (c) => c.stampDutyWallet.topup({ baseAmount: 1000 })],
    ['serviceFeeWallet.topup', (c) => c.serviceFeeWallet.topup({ baseAmount: 1000 })],
    ['webhooks.replay', (c) => c.webhooks.events.replay('e1')],
  ];
  it.each(ops)(
    '%s: one attempt on 503, 429, timeout and connection error; no auto key',
    async (_n, call) => {
      for (const step of [503, 429, 'timeout', 'connection_error'] as const) {
        const { client, calls } = makeClient([step, 200], { timeout: 10 });
        await expect(call(client)).rejects.toBeInstanceOf(Error);
        expect(calls).toHaveLength(1);
        expect(calls[0]!.headers['Idempotency-Key']).toBeUndefined();
      }
    },
  );
  it('a 429 surfaces retryAfter to the caller', async () => {
    const { client } = makeClient([{ status: 429, headers: { 'Retry-After': '9' } }, 200]);
    const err = await client.stampDutyWallet.topup({ baseAmount: 5 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBe(9);
  });
});

describe('validateOrder (retry-safe)', () => {
  it('is retried without an Idempotency-Key', async () => {
    const { client, calls } = makeClient([503, 200]);
    await client.estamp.validateOrder(ORDER);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.headers['Idempotency-Key'] === undefined)).toBe(true);
  });
  it('does not retry a 400', async () => {
    const { client, calls } = makeClient([400, 200]);
    await expect(client.estamp.validateOrder(ORDER)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(1);
  });
});

describe('typed error details', () => {
  it('400 exposes details.errors[] as fieldErrors', async () => {
    const issue = { field: 'stamps[0].articleCode', code: 'REQUIRED', message: 'req', index: 0 };
    const { client } = makeClient([
      {
        status: 400,
        body: {
          error: {
            code: 'BAD_REQUEST',
            message: 'VALIDATION_FAILED: x',
            details: { errors: [issue, { nope: 1 }] },
            requestId: 'r',
          },
        },
      },
    ]);
    const err = (await client.estamp
      .createOrder(ORDER)
      .catch((e: unknown) => e)) as ValidationError;
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.fieldErrors).toEqual([issue]);
    expect(err.details?.errors).toEqual([issue]);
    expect(err.code).toBe('BAD_REQUEST');
  });
  it('402 exposes the short wallet', async () => {
    const { client } = makeClient([
      {
        status: 402,
        body: {
          error: {
            code: 'PAYMENT_REQUIRED',
            message: 'm',
            details: { wallet: 'SERVICE_FEE' },
            requestId: 'r',
          },
        },
      },
    ]);
    const err = (await client.estamp
      .createOrder(ORDER)
      .catch((e: unknown) => e)) as PaymentRequiredError;
    expect(err).toBeInstanceOf(PaymentRequiredError);
    expect(err.wallet).toBe('SERVICE_FEE');
  });
  it('errors without details keep working', async () => {
    const { client } = makeClient([400]);
    const err = (await client.estamp
      .validateOrder(ORDER)
      .catch((e: unknown) => e)) as ValidationError;
    expect(err.details).toBeUndefined();
    expect(err.fieldErrors).toEqual([]);
  });
});

describe('uploadOrderDocument (multipart)', () => {
  it('sends a multipart body with a file part and a type part, no JSON content type', async () => {
    const bodies: FormData[] = [];
    const { client, calls } = makeClient([502, 201]);
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await client.estamp.uploadOrderDocument('ord/1', {
      file: pdf,
      fileName: 'pan.pdf',
      contentType: 'application/pdf',
      type: 'pan_card',
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toContain('/v1/estamp/orders/ord%2F1/documents');
    expect(calls[0]!.headers['Content-Type']).toBeUndefined();
    expect(calls[0]!.headers['Idempotency-Key']).toMatch(UUID);
    expect(calls[1]!.headers['Idempotency-Key']).toBe(calls[0]!.headers['Idempotency-Key']);
    for (const c of calls) {
      const fd = c.body as unknown as FormData;
      expect(fd).toBeInstanceOf(FormData);
      bodies.push(fd);
      const f = fd.get('file') as File;
      expect(f.name).toBe('pan.pdf');
      expect(f.type).toBe('application/pdf');
      expect(f.size).toBe(5);
      expect(fd.get('type')).toBe('pan_card');
    }
    expect(bodies[0]).not.toBe(bodies[1]); // fresh body per attempt
  });
  it('uses a File name and type, and omits `type` when not given', async () => {
    const { client, calls } = makeClient([201]);
    await client.estamp.uploadOrderDocument('o', {
      file: new File([new Uint8Array([1, 2])], 'scan.png', { type: 'image/png' }),
    });
    const fd = calls[0]!.body as unknown as FormData;
    expect((fd.get('file') as File).name).toBe('scan.png');
    expect((fd.get('file') as File).type).toBe('image/png');
    expect(fd.has('type')).toBe(false);
  });
  it('rejects a missing file locally', async () => {
    const { client, calls } = makeClient([201]);
    await expect(client.estamp.uploadOrderDocument('o', {} as never)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(calls).toHaveLength(0);
  });
  it('a 400 (e.g. FILE_TOO_LARGE) is not retried', async () => {
    const { client, calls } = makeClient([400, 201]);
    await expect(
      client.estamp.uploadOrderDocument('o', { file: new Uint8Array([1]) }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(1);
  });
});

describe('queries and local validation', () => {
  it('requirements sends articleCode, denomination and category', async () => {
    const { client, calls } = makeClient([200]);
    await client.estamp.getStateRequirements('MH', {
      articleCode: 'ART1',
      denomination: 500,
      category: 'e_stamp',
    });
    const u = new URL(calls[0]!.url);
    expect(u.pathname).toBe('/v1/estamp/states/MH/requirements');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      articleCode: 'ART1',
      denomination: '500',
      category: 'e_stamp',
    });
  });
  it('availability sends active=false', async () => {
    const { client, calls } = makeClient([200]);
    await client.estamp.getStatesAvailability({ active: false });
    expect(new URL(calls[0]!.url).search).toBe('?active=false');
  });
  it('listAllOrders follows nextCursor', async () => {
    const { client, calls } = makeClient([
      { status: 200, body: { items: [{ id: 'a', status: 'X' }], nextCursor: 'c2' } },
      { status: 200, body: { items: [{ id: 'b', status: 'X' }], nextCursor: null } },
    ]);
    const ids: string[] = [];
    for await (const o of client.estamp.listAllOrders({ limit: 1 })) ids.push(o.id);
    expect(ids).toEqual(['a', 'b']);
    expect(new URL(calls[1]!.url).searchParams.get('cursor')).toBe('c2');
  });
  it.each([0, -5, Number.NaN, '10'])('topup rejects baseAmount %s locally', async (amt) => {
    const { client, calls } = makeClient([200]);
    await expect(client.stampDutyWallet.topup({ baseAmount: amt as never })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(calls).toHaveLength(0);
  });
  it('empty ids are rejected without a request', async () => {
    const { client, calls } = makeClient([200]);
    await expect(client.estamp.cancelStamp('')).rejects.toBeInstanceOf(ValidationError);
    await expect(client.estamp.getOrder(' ')).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });
  it('GET wallet 503 is retried', async () => {
    const { client, calls } = makeClient([503, 200]);
    await client.stampDutyWallet.getBalance();
    expect(calls).toHaveLength(2);
  });
  it('UpstreamError after exhausting retries on createOrder', async () => {
    const { client, calls } = makeClient([503]);
    await expect(client.estamp.createOrder(ORDER)).rejects.toBeInstanceOf(UpstreamError);
    expect(calls).toHaveLength(3);
  });
});
