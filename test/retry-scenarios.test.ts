import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/retry-scenarios.json' with { type: 'json' };
import { makeClient, type Step } from './helpers.js';

interface Scenario {
  name: string;
  method: string;
  path: string;
  idempotencyKey: boolean | string;
  sequence: unknown[];
  expectedAttempts: number;
  outcome: number | string;
  maxRetries?: number;
  retrySafe?: boolean;
  expectedDelayBeforeAttempt2Seconds?: number;
  sameIdempotencyKeyAcrossAttempts?: boolean;
}

function call(client: ReturnType<typeof makeClient>['client'], s: Scenario) {
  const path = s.path;
  const opts = {
    ...(s.maxRetries !== undefined ? { maxRetries: s.maxRetries } : {}),
    ...(s.idempotencyKey === true ? { idempotencyKey: 'k1' } : {}),
  };
  if (s.method === 'GET') {
    if (path === '/v1/services') return client.services.list(opts);
    if (path === '/v1/usage/summary') return client.usage.summary(opts);
    if (path === '/v1/logs') return client.logs.list({}, opts);
    if (path === '/v1/stamp-duty-wallet') return client.stampDutyWallet.getBalance(opts);
    if (path === '/v1/estamp/orders/estord_missing')
      return client.estamp.getOrder('estord_missing', opts);
    if (path === '/v1/estamp/states/MH') return client.estamp.getState('MH', opts);
    const m = /^\/v1\/orders\/([^/]+)(\/status)?$/.exec(path)!;
    return m[2] ? client.orders.getStatus(m[1]!, opts) : client.orders.get(m[1]!, opts);
  }
  if (path === '/v1/estamp/orders') return client.estamp.createOrder({ stamps: [] }, opts);
  if (path === '/v1/estamp/orders/validate')
    return client.estamp.validateOrder({ stamps: [] }, opts);
  if (path.endsWith('/documents'))
    return client.estamp.uploadOrderDocument('estord_1', { file: new Uint8Array([1]) }, opts);
  if (path === '/v1/estamp/orders/estord_1/cancel')
    return client.estamp.cancelOrder('estord_1', opts);
  if (path === '/v1/estamp/stamps/eststamp_1/cancel')
    return client.estamp.cancelStamp('eststamp_1', opts);
  if (path === '/v1/estamp/stamps/eststamp_1/replace')
    return client.estamp.replaceStamp('eststamp_1', opts);
  if (path === '/v1/estamp/stamps/eststamp_1/pan-card')
    return client.estamp.setStampPanCard(
      'eststamp_1',
      { panCardImage: 'https://x.example/p.png' },
      opts,
    );
  if (path === '/v1/stamp-duty-wallet/topup')
    return client.stampDutyWallet.topup({ baseAmount: 1 }, opts);
  if (path === '/v1/service-fee-wallet/topup')
    return client.serviceFeeWallet.topup({ baseAmount: 1 }, opts);
  if (path === '/v1/orders')
    return client.orders.create(
      { externalOrderId: 'a', externalCustomerId: 'b', serviceCode: 'c' },
      opts,
    );
  if (path === '/v1/payments/intents') return client.payments.intents.create({}, opts);
  if (path.endsWith('/parties')) return client.estamp.addParties('ord_1', {}, opts);
  if (path === '/v1/verify/pan') return client.verify.pan({ pan: 'ABCDE1234F' }, opts);
  if (path === '/v1/verify/gstin') return client.verify.gstin({ gstin: '07AAAAA1111A1Z1' }, opts);
  if (path === '/v1/verify/bank-account')
    return client.verify.bankAccount({ accountNumber: '123456789012', ifsc: 'ICIC0001234' }, opts);
  if (path === '/v1/estamp/duty/calculate') return client.estamp.calculateDuty({}, opts);
  if (path.endsWith('/replay')) return client.webhooks.events.replay('evt_1', opts);
  throw new Error(`unmapped scenario path ${path}`);
}

const RETRYABLE = new Set([429, 502, 503, 504]);
const itemStatus = (i: unknown) => (typeof i === 'object' ? (i as { status: number }).status : i);

/**
 * The vendored fixtures encode the pre-Wave-2 rule (keyless billed POSTs are never retried). The SDK now
 * auto-keys every POST except webhook replay, so those scenarios are evaluated as keyed: retry on
 * 429/502/503/504, connection errors and timeouts until a non-retryable item or maxRetries.
 */
function keyedExpectation(s: Scenario): { attempts: number; outcome: number | string } {
  const max = (s.maxRetries ?? 2) + 1;
  let n = 0;
  let last: unknown;
  for (const item of s.sequence) {
    n++;
    last = item;
    const st = itemStatus(item);
    const retryable = typeof st === 'string' || RETRYABLE.has(st as number);
    if (!retryable || n >= max) break;
  }
  const st = itemStatus(last);
  if (typeof st === 'number' && st < 300) return { attempts: n, outcome: 200 };
  if (st === 'timeout') return { attempts: n, outcome: 'TimeoutError' };
  if (st === 'connection_error') return { attempts: n, outcome: 'ConnectionError' };
  if (st === 429) {
    const ra = (last as { headers?: Record<string, string> }).headers?.['Retry-After'];
    return { attempts: n, outcome: `RateLimitError(retryAfter=${ra})` };
  }
  return { attempts: n, outcome: `UpstreamError(${st})` };
}

/** Operations marked x-retry-safe=false: never auto-retried, never auto-keyed. */
const NEVER_RETRY = /\/(cancel|replace|pan-card|topup|replay)$/;
const itemWithCode = (i: unknown, code: string) =>
  typeof i === 'object'
    ? { ...(i as object), body: { error: { code, message: 'm', requestId: 'r' } } }
    : { status: i as number, body: { error: { code, message: 'm', requestId: 'r' } } };

describe('shared retry scenarios', () => {
  for (const s of fixtures.scenarios as Scenario[]) {
    it(s.name, async () => {
      // `Name(CODE)` outcomes (non-numeric) are checked against error.code.
      const codeOutcome = /^\w+\(([A-Z_]+)\)$/.exec(String(s.outcome))?.[1];
      const seq = codeOutcome
        ? s.sequence.map((i) =>
            typeof i === 'number' && i >= 400 ? itemWithCode(i, codeOutcome) : i,
          )
        : s.sequence;
      const { client, calls, sleeps } = makeClient(seq as Step[], { timeout: 20 });
      const res = await call(client, s)
        .withResponse()
        .then(
          (r) => r.response.status as number | string,
          (raw: unknown) => {
            const e = raw as Error & { status?: number; retryAfter?: number; code?: string };
            const want = String(s.outcome);
            if (want.includes('retryAfter')) return `${e.name}(retryAfter=${e.retryAfter})`;
            if (codeOutcome) return `${e.name}(${e.code})`;
            if (want.includes('(')) return `${e.name}(${e.status})`;
            return e.name;
          },
        );
      const never = s.method === 'POST' && NEVER_RETRY.test(s.path);
      const noKeyParam = never || s.path === '/v1/estamp/orders/validate';
      const reKeyed = s.method === 'POST' && s.idempotencyKey === false && !noKeyParam;
      const want = reKeyed
        ? keyedExpectation(s)
        : { attempts: s.expectedAttempts, outcome: s.outcome };
      expect(calls.length).toBe(want.attempts);
      // The sequence of one fixture scenario scripts a bare 200 where the contract's success is 201: any 2xx is success.
      const ok = (v: unknown) => typeof v === 'number' && v >= 200 && v < 300;
      expect(ok(res) && ok(want.outcome) ? want.outcome : res).toBe(want.outcome);
      if (s.expectedDelayBeforeAttempt2Seconds !== undefined) {
        expect(sleeps[0]).toBe(s.expectedDelayBeforeAttempt2Seconds * 1000);
      }
      if (s.method === 'GET' || noKeyParam) {
        expect(calls.every((c) => c.headers['Idempotency-Key'] === undefined)).toBe(true);
      } else if (s.method === 'POST') {
        expect(new Set(calls.map((c) => c.headers['Idempotency-Key'])).size).toBe(1);
        expect(calls[0]!.headers['Idempotency-Key']).toBeTruthy();
      }
      if (s.sameIdempotencyKeyAcrossAttempts) {
        expect(new Set(calls.map((c) => c.headers['Idempotency-Key'])).size).toBe(1);
      }
    });
  }
});
