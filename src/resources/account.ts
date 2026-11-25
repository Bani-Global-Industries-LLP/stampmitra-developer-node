import type { APIPromise, RequestOptions } from '../http.js';
import type { AccountBalance, AccountUsage } from '../types/account.js';
import { Resource } from './base.js';

export class Account extends Resource {
  /** GET /v1/account/balance. Service wallet balance (verification calls) and low-balance state (amounts exclude GST). */
  getBalance(opts?: RequestOptions): APIPromise<AccountBalance> {
    return this.ctx.http.request({ method: 'GET', path: '/v1/account/balance' }, opts);
  }

  /** GET /v1/account/usage. This and last month (IST), today, and your limits. */
  getUsage(opts?: RequestOptions): APIPromise<AccountUsage> {
    return this.ctx.http.request({ method: 'GET', path: '/v1/account/usage' }, opts);
  }
}
