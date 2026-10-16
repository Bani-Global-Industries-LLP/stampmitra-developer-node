import type { APIPromise, RequestOptions } from '../http.js';
import type { LogEntry, LogListParams, LogPage } from '../types/usage.js';
import { Resource } from './base.js';
import { paginate } from './pagination.js';

export class Logs extends Resource {
  /** GET /v1/logs (one page). Use `nextCursor` from the result to fetch the next page. */
  list(params: LogListParams = {}, opts?: RequestOptions): APIPromise<LogPage> {
    return this.ctx.http.request({ method: 'GET', path: '/v1/logs', query: params }, opts);
  }

  /** Async iterator over every matching log entry, following `nextCursor` automatically. */
  listAll(params: LogListParams = {}, opts?: RequestOptions): AsyncGenerator<LogEntry, void, void> {
    return paginate<LogEntry, LogListParams>((p) => this.list(p, opts), params);
  }
}
