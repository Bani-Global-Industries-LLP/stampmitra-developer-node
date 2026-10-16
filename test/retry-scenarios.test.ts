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
    const m = /^\/v1\/orders\/([^/]+)(\/status)?$/.exec(path)!;
    return m[2] ? client.orders.getStatus(m[1]!, opts) : client.orders.get(m[1]!, opts);
  }
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

describe('shared retry scenarios', () => {
  for (const s of fixtures.scenarios as Scenario[]) {
    it(s.name, async () => {
      const { client, calls } = makeClient(s.sequence as Step[], { timeout: 20 });
      const res = await call(client, s).then(
        () => 200 as number | string,
        (raw: unknown) => {
          const e = raw as Error & { status?: number; retryAfter?: number };
          const want = String(s.outcome);
          if (want.includes('retryAfter')) return `${e.name}(retryAfter=${e.retryAfter})`;
          if (want.includes('(')) return `${e.name}(${e.status})`;
          return e.name;
        },
      );
      expect(calls.length).toBe(s.expectedAttempts);
      expect(res).toBe(s.outcome);
      if (s.idempotencyKey === 'auto') {
        expect(new Set(calls.map((c) => c.headers['Idempotency-Key'])).size).toBe(1);
        expect(calls[0]!.headers['Idempotency-Key']).toBeTruthy();
      }
    });
  }
});
