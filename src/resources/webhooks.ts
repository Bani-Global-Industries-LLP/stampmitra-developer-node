import { rejectedAPIPromise, type APIPromise, type RequestOptions } from '../http.js';
import type {
  WebhookDelivery,
  WebhookEventListParams,
  WebhookEventPage,
  WebhookReplayResult,
} from '../types/usage.js';
import { requireId } from '../validators.js';
import { Resource, enc } from './base.js';
import { paginate } from './pagination.js';

export class WebhookEvents extends Resource {
  /** GET /v1/webhooks/events (one page of delivery attempts). */
  list(params: WebhookEventListParams = {}, opts?: RequestOptions): APIPromise<WebhookEventPage> {
    return this.ctx.http.request(
      { method: 'GET', path: '/v1/webhooks/events', query: params },
      opts,
    );
  }

  /** Async iterator over all delivery attempts, following `nextCursor`. */
  listAll(
    params: WebhookEventListParams = {},
    opts?: RequestOptions,
  ): AsyncGenerator<WebhookDelivery, void, void> {
    return paginate<WebhookDelivery, WebhookEventListParams>((p) => this.list(p, opts), params);
  }

  /** POST /v1/webhooks/events/{id}/replay. Re-fires the same payload. Never auto-keyed and never auto-retried after a response (pass `idempotencyKey` to opt in to retries). */
  replay(id: string, opts?: RequestOptions): APIPromise<WebhookReplayResult> {
    try {
      return this.ctx.http.request(
        {
          method: 'POST',
          path: `/v1/webhooks/events/${enc(requireId(id, 'id'))}/replay`,
          body: {},
          autoIdempotency: false,
        },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }
}

export class Webhooks extends Resource {
  readonly events: WebhookEvents;
  constructor(ctx: ConstructorParameters<typeof Resource>[0]) {
    super(ctx);
    this.events = new WebhookEvents(ctx);
  }
}
