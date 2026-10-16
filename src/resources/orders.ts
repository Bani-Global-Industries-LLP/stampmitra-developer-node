import { rejectedAPIPromise, type APIPromise, type RequestOptions } from '../http.js';
import type * as T from '../types/estamp.js';
import { requireId, requireObject } from '../validators.js';
import { Resource, enc, pathCall } from './base.js';

export class Orders extends Resource {
  /** POST /v1/orders. Sends an auto-generated `Idempotency-Key` (reused across retries). */
  create(body: T.OrderCreateParams, opts?: RequestOptions): APIPromise<T.Order> {
    try {
      const b = requireObject(body, 'body');
      for (const f of ['externalOrderId', 'externalCustomerId', 'serviceCode']) {
        requireId(b[f] as string, f);
      }
      return this.ctx.http.request({ method: 'POST', path: '/v1/orders', body }, opts);
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /** GET /v1/orders/{id} */
  get(id: string, opts?: RequestOptions): APIPromise<T.Order> {
    return pathCall(this.ctx, 'id', id, (i) => `/v1/orders/${enc(i)}`, opts);
  }

  /** GET /v1/orders/{id}/status */
  getStatus(id: string, opts?: RequestOptions): APIPromise<T.OrderStatus> {
    return pathCall(this.ctx, 'id', id, (i) => `/v1/orders/${enc(i)}/status`, opts);
  }

  /** GET /v1/orders/{id}/payment */
  getPayment(id: string, opts?: RequestOptions): APIPromise<T.OrderPayment> {
    return pathCall(this.ctx, 'id', id, (i) => `/v1/orders/${enc(i)}/payment`, opts);
  }

  /** GET /v1/orders/{id}/documents */
  listDocuments(id: string, opts?: RequestOptions): APIPromise<T.OrderDocuments> {
    return pathCall(this.ctx, 'id', id, (i) => `/v1/orders/${enc(i)}/documents`, opts);
  }

  /** GET /v1/orders/{id}/documents/{documentId}/download. Returns a short-lived signed URL. */
  getDocumentDownload(
    id: string,
    documentId: string,
    opts?: RequestOptions,
  ): APIPromise<T.DocumentDownload> {
    try {
      const i = requireId(id, 'id');
      const d = requireId(documentId, 'documentId');
      return this.ctx.http.request(
        { method: 'GET', path: `/v1/orders/${enc(i)}/documents/${enc(d)}/download` },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }
}
