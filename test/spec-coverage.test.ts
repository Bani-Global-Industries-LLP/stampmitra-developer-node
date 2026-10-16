import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { StampMitra } from '../src/index.js';
import { scriptedFetch, TEST_KEY } from './helpers.js';

interface Spec {
  paths: Record<string, Record<string, unknown>>;
}
const spec = JSON.parse(
  readFileSync(new URL('../spec/openapi.json', import.meta.url), 'utf8'),
) as Spec;
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const specOps = Object.entries(spec.paths).flatMap(([path, item]) =>
  Object.keys(item)
    .filter((m) => METHODS.has(m))
    .map((m) => `${m.toUpperCase()} ${path}`),
);

/** Exercises every SDK method once and records the METHOD + path template it hit. */
async function sdkOps(): Promise<Set<string>> {
  const sf = scriptedFetch([200]);
  const c = new StampMitra({ apiKey: TEST_KEY, fetch: sf.fetch });
  const calls: Array<() => Promise<unknown>> = [
    () => c.verify.pan({ pan: 'ABCDE1234F' }),
    () => c.verify.gstin({ gstin: '07AAAAA1111A1Z1' }),
    () => c.verify.rc({ vehicleNumber: 'MH12AB1234' }),
    () => c.verify.voterId({ voterId: 'ABC1234567' }),
    () => c.verify.drivingLicense({ dlNumber: 'MH1420110012345', dob: '1990-01-01' }),
    () => c.verify.passport({ fileNumber: 'PA1079341954215', dob: '1990-01-01' }),
    () => c.verify.cin({ cin: 'U74999DL2015PTC284009' }),
    () => c.verify.udyam({ udyamNumber: 'UDYAM-MH-12-1234567' }),
    () => c.verify.panToGstin({ pan: 'ABCDE1234F' }),
    () => c.verify.panToUdyam({ pan: 'ABCDE1234F' }),
    () => c.verify.bankAccount({ accountNumber: '123456789012', ifsc: 'ICIC0001234' }),
    () => c.services.list(),
    () => c.services.get('S'),
    () => c.estamp.getSchema('S'),
    () => c.estamp.listStates(),
    () => c.estamp.listInstruments('MH'),
    () => c.estamp.listArticles('I'),
    () => c.estamp.calculateDuty({}),
    () => c.estamp.addParties('O', {}),
    () => c.orders.create({ externalOrderId: 'a', externalCustomerId: 'b', serviceCode: 'c' }),
    () => c.orders.get('O'),
    () => c.orders.getStatus('O'),
    () => c.orders.getPayment('O'),
    () => c.orders.listDocuments('O'),
    () => c.orders.getDocumentDownload('O', 'D'),
    () => c.payments.intents.create({}),
    () => c.payments.intents.get('P'),
    () => c.usage.summary(),
    () => c.logs.list(),
    () => c.webhooks.events.list(),
    () => c.webhooks.events.replay('E'),
  ];
  for (const call of calls) await call();
  // Map concrete URLs back onto spec path templates.
  const templates = Object.keys(spec.paths).map((p) => ({
    p,
    re: new RegExp(`^${p.replace(/\{[^}]+\}/g, '[^/]+')}$`),
  }));
  const hit = new Set<string>();
  for (const call of sf.calls) {
    const pathname = new URL(call.url).pathname;
    const t = templates.find((x) => x.re.test(pathname));
    hit.add(`${call.method} ${t ? t.p : pathname}`);
  }
  return hit;
}

describe('spec coverage (spec/openapi.json)', () => {
  it('has the expected number of operations in the snapshot', () => {
    expect(specOps.length).toBe(31);
  });
  it('every spec METHOD+path has an SDK method', async () => {
    const hit = await sdkOps();
    const missing = specOps.filter((op) => !hit.has(op));
    expect(missing, `SDK is missing: ${missing.join(', ')}`).toEqual([]);
  });
  it('the SDK calls nothing that is not in the spec', async () => {
    const hit = await sdkOps();
    const extra = [...hit].filter((op) => !specOps.includes(op));
    expect(extra).toEqual([]);
  });
});
