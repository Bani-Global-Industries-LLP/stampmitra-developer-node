import { ValidationError } from '../errors.js';
import { rejectedAPIPromise, type APIPromise, type RequestOptions } from '../http.js';
import type * as W from '../types/wallets.js';
import { requireObject } from '../validators.js';
import { Resource, enc, pathCall, type Context } from './base.js';
import { paginate } from './pagination.js';
import type { Page } from '../types/usage.js';

/** Shared plumbing of the two wallet resources. Routes differ only by prefix and response types. */
abstract class Wallet<Topup, Invoice, InvoicePage extends Page<Invoice>> extends Resource {
  private readonly base: string;
  constructor(ctx: Context, base: string) {
    super(ctx);
    this.base = base;
  }

  /** GET balance. A decimal string: parse it before comparing. */
  getBalance(opts?: RequestOptions): APIPromise<W.WalletBalance> {
    return this.ctx.http.request({ method: 'GET', path: this.base }, opts);
  }

  /**
   * POST topup. Returns the Razorpay order to pay in Checkout. Never auto-retried (it creates a payment order).
   * Read the fee, GST and total from the response; do not compute them.
   */
  topup(params: W.WalletTopupParams, opts?: RequestOptions): APIPromise<Topup> {
    try {
      const b = requireObject(params, 'params');
      const amount = b.baseAmount;
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('baseAmount must be a positive number', {
          field: 'baseAmount',
          status: 400,
          code: 'BAD_REQUEST',
          local: true,
        });
      }
      return this.ctx.http.request(
        {
          method: 'POST',
          path: `${this.base}/topup`,
          body: params,
          autoIdempotency: false,
          retry: 'never',
        },
        opts,
      );
    } catch (err) {
      return rejectedAPIPromise(err);
    }
  }

  /** GET transactions (one page of the ledger, newest first). */
  listTransactions(
    params: W.WalletListParams = {},
    opts?: RequestOptions,
  ): APIPromise<W.WalletTransactionsPage> {
    return this.ctx.http.request(
      { method: 'GET', path: `${this.base}/transactions`, query: params },
      opts,
    );
  }

  /** Async iterator over the whole ledger, following `nextCursor`. */
  listAllTransactions(
    params: W.WalletListParams = {},
    opts?: RequestOptions,
  ): AsyncGenerator<W.WalletTransaction, void, void> {
    return paginate<W.WalletTransaction, W.WalletListParams>(
      (p) => this.listTransactions(p, opts),
      params,
    );
  }

  /** GET invoices (one page, newest first). A sandbox key always gets an empty page. */
  listInvoices(params: W.WalletListParams = {}, opts?: RequestOptions): APIPromise<InvoicePage> {
    return this.ctx.http.request(
      { method: 'GET', path: `${this.base}/invoices`, query: params },
      opts,
    );
  }

  /** Async iterator over every invoice, following `nextCursor`. */
  listAllInvoices(
    params: W.WalletListParams = {},
    opts?: RequestOptions,
  ): AsyncGenerator<Invoice, void, void> {
    return paginate<Invoice, W.WalletListParams>((p) => this.listInvoices(p, opts), params);
  }

  /** GET invoices/{id}. Always 404 in sandbox. */
  getInvoice(id: string, opts?: RequestOptions): APIPromise<Invoice> {
    return pathCall(this.ctx, 'id', id, (i) => `${this.base}/invoices/${enc(i)}`, opts);
  }
}

/**
 * `client.stampDutyWallet`: GET /v1/stamp-duty-wallet and its `/topup`, `/transactions`, `/invoices` routes.
 * Top-up: a 6% processing fee plus 18% GST on that fee is added on top; the wallet is credited the amount you
 * add. The GST tax invoice (for the fee) is available from `listInvoices` / `getInvoice` (id = `topupId`).
 */
export class StampDutyWallet extends Wallet<
  W.StampDutyWalletTopup,
  W.StampDutyWalletInvoice,
  W.StampDutyWalletInvoicesPage
> {
  constructor(ctx: Context) {
    super(ctx, '/v1/stamp-duty-wallet');
  }
}

/** `client.serviceFeeWallet`: GET /v1/service-fee-wallet and its `/topup`, `/transactions`, `/invoices` routes. */
export class ServiceFeeWallet extends Wallet<
  W.ServiceFeeWalletTopup,
  W.ServiceFeeWalletInvoice,
  W.ServiceFeeWalletInvoicesPage
> {
  constructor(ctx: Context) {
    super(ctx, '/v1/service-fee-wallet');
  }
}
