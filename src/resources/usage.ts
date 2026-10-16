import type { APIPromise, RequestOptions } from '../http.js';
import type { UsageSummary } from '../types/usage.js';
import { Resource } from './base.js';

export class Usage extends Resource {
  /** GET /v1/usage/summary */
  summary(opts?: RequestOptions): APIPromise<UsageSummary> {
    return this.ctx.http.request({ method: 'GET', path: '/v1/usage/summary' }, opts);
  }
}
