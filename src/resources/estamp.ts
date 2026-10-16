import { rejectedAPIPromise, type APIPromise, type RequestOptions } from '../http.js';
import type * as T from '../types/estamp.js';
import { requireId, requireObject } from '../validators.js';
import { Resource, enc, pathCall } from './base.js';

export class Estamp extends Resource {
  /** GET /v1/estamp/schema/{serviceCode} */
  getSchema(serviceCode: string, opts?: RequestOptions): APIPromise<T.EstampSchema> {
    return pathCall(
      this.ctx,
      'serviceCode',
      serviceCode,
      (c) => `/v1/estamp/schema/${enc(c)}`,
      opts,
    );
  }

  /** GET /v1/estamp/states */
  listStates(opts?: RequestOptions): APIPromise<T.EstampStates> {
    return this.ctx.http.request({ method: 'GET', path: '/v1/estamp/states' }, opts);
  }

  /** GET /v1/estamp/states/{stateCode}/instruments */
  listInstruments(stateCode: string, opts?: RequestOptions): APIPromise<T.EstampInstruments> {
    return pathCall(
      this.ctx,
      'stateCode',
      stateCode,
      (c) => `/v1/estamp/states/${enc(c)}/instruments`,
      opts,
    );
  }

  /** GET /v1/estamp/instruments/{instrumentCode}/articles */
  listArticles(instrumentCode: string, opts?: RequestOptions): APIPromise<T.EstampArticles> {
    return pathCall(
      this.ctx,
      'instrumentCode',
      instrumentCode,
      (c) => `/v1/estamp/instruments/${enc(c)}/articles`,
      opts,
    );
  }

  /** POST /v1/estamp/duty/calculate. Metered; not auto-retried unless you pass an `idempotencyKey`. */
  calculateDuty(body: T.DutyCalculateParams, opts?: RequestOptions): APIPromise<T.DutyCalculation> {
    try {
      requireObject(body, 'body');
      return this.ctx.http.request(
        { method: 'POST', path: '/v1/estamp/duty/calculate', body },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /** POST /v1/estamp/orders/{orderId}/parties. Sends an auto-generated `Idempotency-Key`. */
  addParties(
    orderId: string,
    body: T.AddPartiesParams,
    opts?: RequestOptions,
  ): APIPromise<T.AddPartiesResult> {
    try {
      const id = requireId(orderId, 'orderId');
      requireObject(body, 'body');
      return this.ctx.http.request(
        {
          method: 'POST',
          path: `/v1/estamp/orders/${enc(id)}/parties`,
          body,
          autoIdempotency: true,
        },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }
}
