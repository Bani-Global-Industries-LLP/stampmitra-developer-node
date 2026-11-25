import { ValidationError } from '../errors.js';
import { rejectedAPIPromise, type APIPromise, type RequestOptions } from '../http.js';
import type * as T from '../types/estamp.js';
import type { EstampWallet } from '../types/wallets.js';
import { requireId, requireObject } from '../validators.js';
import { Resource, enc, pathCall } from './base.js';
import { paginate } from './pagination.js';

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

  /** POST /v1/estamp/duty/calculate. Metered. Sends an auto-generated `Idempotency-Key` (reused across retries). */
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

  /** POST /v1/estamp/orders/{orderId}/parties. Sends an auto-generated `Idempotency-Key` (reused across retries). */
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
        },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /** GET /v1/estamp/states/availability. Live switch per state; inactive states are rejected with `STATE_INACTIVE`. */
  getStatesAvailability(
    params: T.EstampStatesAvailabilityParams = {},
    opts?: RequestOptions,
  ): APIPromise<T.EstampStatesAvailability> {
    return this.ctx.http.request(
      { method: 'GET', path: '/v1/estamp/states/availability', query: params },
      opts,
    );
  }

  /** GET /v1/estamp/states/{stateCode}. Serviceability and the flags that decide which order fields are needed. */
  getState(stateCode: string, opts?: RequestOptions): APIPromise<T.EstampState> {
    return pathCall(this.ctx, 'stateCode', stateCode, (c) => `/v1/estamp/states/${enc(c)}`, opts);
  }

  /** GET /v1/estamp/states/{stateCode}/requirements. Field rules for a combination, plus a ready-to-send `exampleBody`. */
  getStateRequirements(
    stateCode: string,
    params: T.EstampRequirementsParams = {},
    opts?: RequestOptions,
  ): APIPromise<T.EstampRequirements> {
    try {
      return this.ctx.http.request(
        {
          method: 'GET',
          path: `/v1/estamp/states/${enc(requireId(stateCode, 'stateCode'))}/requirements`,
          query: params,
        },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /** GET /v1/estamp/states/{stateCode}/districts. A bare array; send a `code` as `district` on a stamp line. */
  listDistricts(stateCode: string, opts?: RequestOptions): APIPromise<T.EstampDistrictList> {
    return pathCall(
      this.ctx,
      'stateCode',
      stateCode,
      (c) => `/v1/estamp/states/${enc(c)}/districts`,
      opts,
    );
  }

  /** GET /v1/estamp/states/{stateCode}/districts/{districtCode}/sros. A bare array; send a `value` as `sro`. */
  listSros(
    stateCode: string,
    districtCode: string,
    opts?: RequestOptions,
  ): APIPromise<T.EstampSroList> {
    try {
      const s = requireId(stateCode, 'stateCode');
      const d = requireId(districtCode, 'districtCode');
      return this.ctx.http.request(
        {
          method: 'GET',
          path: `/v1/estamp/states/${enc(s)}/districts/${enc(d)}/sros`,
        },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /**
   * POST /v1/estamp/orders/validate. A dry run: nothing is saved or charged. It takes no Idempotency-Key and is
   * retry-safe, so it is retried on 429/502/503/504, timeouts and connection errors.
   */
  validateOrder(
    body: T.EstampOrderRequest,
    opts?: RequestOptions,
  ): APIPromise<T.EstampValidateResult> {
    try {
      requireObject(body, 'body');
      return this.ctx.http.request(
        {
          method: 'POST',
          path: '/v1/estamp/orders/validate',
          body,
          autoIdempotency: false,
          retry: 'safe',
        },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /**
   * POST /v1/estamp/orders. Spends money, so the API REQUIRES an Idempotency-Key: one is generated when you pass
   * none and is reused across automatic retries. A generated key cannot protect you if YOU call this again after
   * an unknown outcome, so pass `{ idempotencyKey }` derived from something stable you own (and persist it).
   * Debits the Stamp Duty wallet and the Service wallet; a short wallet is a `PaymentRequiredError` (`wallet`).
   */
  createOrder(body: T.EstampOrderRequest, opts?: RequestOptions): APIPromise<T.EstampOrder> {
    try {
      requireObject(body, 'body');
      return this.ctx.http.request({ method: 'POST', path: '/v1/estamp/orders', body }, opts);
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /** GET /v1/estamp/orders (one page, newest first). Use `reference` on each item to resolve an unknown outcome. */
  listOrders(
    params: T.EstampOrderListParams = {},
    opts?: RequestOptions,
  ): APIPromise<T.EstampOrderList> {
    return this.ctx.http.request({ method: 'GET', path: '/v1/estamp/orders', query: params }, opts);
  }

  /** Async iterator over every order, following `nextCursor`. */
  listAllOrders(
    params: T.EstampOrderListParams = {},
    opts?: RequestOptions,
  ): AsyncGenerator<T.EstampOrder, void, void> {
    return paginate<T.EstampOrder, T.EstampOrderListParams>(
      (p) => this.listOrders(p, opts),
      params,
    );
  }

  /** GET /v1/estamp/orders/{id} */
  getOrder(id: string, opts?: RequestOptions): APIPromise<T.EstampOrder> {
    return pathCall(this.ctx, 'id', id, (i) => `/v1/estamp/orders/${enc(i)}`, opts);
  }

  /** POST /v1/estamp/orders/{id}/cancel. Never auto-retried. A 409 means it can no longer be cancelled. */
  cancelOrder(id: string, opts?: RequestOptions): APIPromise<T.EstampOrder> {
    return this.postNoRetry('id', id, (i) => `/v1/estamp/orders/${i}/cancel`, undefined, opts);
  }

  /** GET /v1/estamp/orders/{id}/export. A small reconciliation CSV (`filename`, `csv`). */
  exportOrder(id: string, opts?: RequestOptions): APIPromise<T.EstampOrderExport> {
    return pathCall(this.ctx, 'id', id, (i) => `/v1/estamp/orders/${enc(i)}/export`, opts);
  }

  /** GET /v1/estamp/orders/{id}/stamps */
  listOrderStamps(id: string, opts?: RequestOptions): APIPromise<T.EstampStampList> {
    return pathCall(this.ctx, 'id', id, (i) => `/v1/estamp/orders/${enc(i)}/stamps`, opts);
  }

  /**
   * POST /v1/estamp/orders/{orderId}/documents (multipart/form-data). Uploads the payer's PAN card (PDF, JPEG or
   * PNG, up to 10 MB; checked by the API). An order can be placed without it, but the PAN card is mandatory to complete the stamp: until one is on file the stamp waits. Sends an `Idempotency-Key` (generated when you
   * pass none); a retry re-sends the whole file with the same key.
   */
  uploadOrderDocument(
    orderId: string,
    params: T.EstampDocumentUploadParams,
    opts?: RequestOptions,
  ): APIPromise<T.EstampDocument> {
    try {
      const id = requireId(orderId, 'orderId');
      const p = requireObject(params, 'params') as unknown as T.EstampDocumentUploadParams;
      const file = p.file;
      if (
        !(file instanceof Blob) &&
        !(file instanceof Uint8Array) &&
        !(file instanceof ArrayBuffer)
      ) {
        throw new ValidationError('file is required (a Blob, Uint8Array or ArrayBuffer)', {
          field: 'file',
          status: 400,
          code: 'BAD_REQUEST',
          local: true,
        });
      }
      if (p.type !== undefined && p.type !== 'pan_card') {
        throw new ValidationError('type must be pan_card', {
          field: 'type',
          status: 400,
          code: 'BAD_REQUEST',
          local: true,
        });
      }
      const contentType = p.contentType ?? (file instanceof Blob ? file.type : '');
      const fileName =
        p.fileName ??
        (typeof File !== 'undefined' && file instanceof File ? file.name : 'pan-card');
      const type = p.type;
      return this.ctx.http.request(
        {
          method: 'POST',
          path: `/v1/estamp/orders/${enc(id)}/documents`,
          form: () => {
            const fd = new FormData();
            const blob =
              file instanceof Blob
                ? contentType && file.type !== contentType
                  ? new Blob([file], { type: contentType })
                  : file
                : new Blob([file as BlobPart], contentType ? { type: contentType } : {});
            fd.append('file', blob, fileName);
            if (type) fd.append('type', type);
            return fd;
          },
        },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /** GET /v1/estamp/stamps/{stampId} */
  getStamp(stampId: string, opts?: RequestOptions): APIPromise<T.EstampStamp> {
    return pathCall(this.ctx, 'stampId', stampId, (i) => `/v1/estamp/stamps/${enc(i)}`, opts);
  }

  /** POST /v1/estamp/stamps/{stampId}/cancel. Never auto-retried. */
  cancelStamp(stampId: string, opts?: RequestOptions): APIPromise<T.EstampStamp> {
    return this.postNoRetry(
      'stampId',
      stampId,
      (i) => `/v1/estamp/stamps/${i}/cancel`,
      undefined,
      opts,
    );
  }

  /** POST /v1/estamp/stamps/{stampId}/replace. Returns the replacement stamp (its own id). Never auto-retried. */
  replaceStamp(stampId: string, opts?: RequestOptions): APIPromise<T.EstampStamp> {
    return this.postNoRetry(
      'stampId',
      stampId,
      (i) => `/v1/estamp/stamps/${i}/replace`,
      undefined,
      opts,
    );
  }

  /** POST /v1/estamp/stamps/{stampId}/pan-card. Answers 202 (PROCESSING); read the result from the stamp. Never auto-retried. */
  setStampPanCard(
    stampId: string,
    params: T.EstampPanCardParams,
    opts?: RequestOptions,
  ): APIPromise<T.EstampPanCardResult> {
    try {
      const body = requireObject(params, 'params');
      return this.postNoRetry(
        'stampId',
        stampId,
        (i) => `/v1/estamp/stamps/${i}/pan-card`,
        body,
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /** GET /v1/estamp/stamps/{stampId}/certificate. Always 200; check `available`. Download `downloadUrl` promptly (5 minutes). */
  getStampCertificate(stampId: string, opts?: RequestOptions): APIPromise<T.EstampCertificate> {
    return pathCall(
      this.ctx,
      'stampId',
      stampId,
      (i) => `/v1/estamp/stamps/${enc(i)}/certificate`,
      opts,
    );
  }

  /** GET /v1/estamp/wallet. Both wallets in one read (needs both wallet read scopes). */
  getWallet(opts?: RequestOptions): APIPromise<EstampWallet> {
    return this.ctx.http.request({ method: 'GET', path: '/v1/estamp/wallet' }, opts);
  }

  private postNoRetry<R>(
    field: string,
    id: string,
    build: (encodedId: string) => string,
    body: unknown,
    opts?: RequestOptions,
  ): APIPromise<R> {
    try {
      return this.ctx.http.request<R>(
        {
          method: 'POST',
          path: build(enc(requireId(id, field))),
          body,
          autoIdempotency: false,
          retry: 'never',
        },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise<R>(err);
    }
  }
}
