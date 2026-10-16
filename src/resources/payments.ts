import { rejectedAPIPromise, type APIPromise, type RequestOptions } from '../http.js';
import type * as T from '../types/estamp.js';
import { requireObject } from '../validators.js';
import { Resource, enc, pathCall } from './base.js';

export class PaymentIntents extends Resource {
  /** POST /v1/payments/intents. Sends an auto-generated `Idempotency-Key` (reused across retries). */
  create(body: T.PaymentIntentCreateParams, opts?: RequestOptions): APIPromise<T.PaymentIntent> {
    try {
      requireObject(body, 'body');
      return this.ctx.http.request(
        { method: 'POST', path: '/v1/payments/intents', body, autoIdempotency: true },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /** GET /v1/payments/intents/{id} */
  get(id: string, opts?: RequestOptions): APIPromise<T.PaymentIntent> {
    return pathCall(this.ctx, 'id', id, (i) => `/v1/payments/intents/${enc(i)}`, opts);
  }
}

export class Payments extends Resource {
  readonly intents: PaymentIntents;
  constructor(ctx: ConstructorParameters<typeof Resource>[0]) {
    super(ctx);
    this.intents = new PaymentIntents(ctx);
  }
}
