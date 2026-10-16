import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/webhook-signatures.json' with { type: 'json' };
import * as edge from '../src/webhooks.js';
import * as node from '../src/webhooks-node.js';
import { WebhookSignatureError } from '../src/errors.js';

const REASON: Record<string, string> = {
  signature_mismatch: 'mismatch',
  timestamp_outside_tolerance: 'stale',
  invalid_timestamp: 'malformed',
};
const now = fixtures.now * 1000;

describe('shared webhook vectors', () => {
  for (const v of fixtures.vectors) {
    it(`${v.name} (async WebCrypto)`, async () => {
      const ok = await edge.verifySignature(v.payload, v.timestamp, v.signature, v.secret, {
        now,
        toleranceSeconds: fixtures.toleranceSeconds,
      });
      expect(ok).toBe(v.expected.valid);
      if (!v.expected.valid) {
        await expect(
          edge.constructEvent(v.payload, v.timestamp, v.signature, v.secret, { now }),
        ).rejects.toMatchObject({
          reason: REASON[(v.expected as { reason: string }).reason],
        });
      }
    });
    it(`${v.name} (sync node:crypto)`, () => {
      expect(node.verifySignature(v.payload, v.timestamp, v.signature, v.secret, { now })).toBe(
        v.expected.valid,
      );
    });
  }
});

describe('webhook helpers', () => {
  const valid = fixtures.vectors[0]!;
  it('constructEvent returns the parsed body', async () => {
    const evt = await edge.constructEvent<{ id: string }>(
      valid.payload,
      valid.timestamp,
      valid.signature,
      valid.secret,
      { now },
    );
    expect(evt.id).toBe('evt_01HZX3P0C4');
    expect(
      node.constructEvent<{ id: string }>(
        valid.payload,
        valid.timestamp,
        valid.signature,
        valid.secret,
        { now },
      ).id,
    ).toBe('evt_01HZX3P0C4');
  });
  it('accepts bytes and verifies the same as strings', async () => {
    const bytes = new TextEncoder().encode(valid.payload);
    expect(
      await edge.verifySignature(bytes, valid.timestamp, valid.signature, valid.secret, { now }),
    ).toBe(true);
    expect(
      node.verifySignature(bytes, valid.timestamp, valid.signature, valid.secret, { now }),
    ).toBe(true);
  });
  it('async and sync computeSignature agree', async () => {
    expect(await edge.computeSignature('s', '1', '{}')).toBe(node.computeSignature('s', '1', '{}'));
  });
  it('reads headers from Headers and plain objects', async () => {
    const h = {
      'X-Webhook-Signature': valid.signature,
      'X-Webhook-Timestamp': valid.timestamp,
      'X-Webhook-Event-Id': 'evt_1',
    };
    expect(edge.extractWebhookHeaders(new Headers(h)).eventId).toBe('evt_1');
    expect(edge.extractWebhookHeaders(h).signature).toBe(valid.signature);
    const evt = await edge.constructEventFromHeaders(valid.payload, h, valid.secret, { now });
    expect(evt).toMatchObject({ type: 'order.completed' });
    expect(node.constructEventFromHeaders(valid.payload, h, valid.secret, { now })).toMatchObject({
      type: 'order.completed',
    });
  });
  it('rejects missing headers and non-JSON bodies', async () => {
    await expect(edge.constructEventFromHeaders('{}', {}, 's')).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    const body = 'not json';
    const sig = await edge.computeSignature('s', '100', body);
    await expect(
      edge.constructEvent(body, '100', sig, 's', { toleranceSeconds: Infinity }),
    ).rejects.toMatchObject({ reason: 'malformed' });
  });
  it('tolerance can be given as a number', async () => {
    expect(
      await edge.verifySignature(valid.payload, valid.timestamp, valid.signature, valid.secret, 5),
    ).toBe(false); // real clock: stale
  });
});
