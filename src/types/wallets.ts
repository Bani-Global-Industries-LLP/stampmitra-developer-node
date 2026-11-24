import type { Page } from './usage.js';

/** Balance of one wallet. `balance` is a decimal string: parse it, never concatenate it. */
export interface WalletBalance {
  balance: string;
  currency: 'INR';
}
export interface EstampWalletPart {
  balance: string;
  held: string | null;
  available: string | null;
}
/** Both wallets in one read; the Service Fee Wallet is under `serviceFee`. */
export interface EstampWallet extends EstampWalletPart {
  currency: 'INR';
  serviceFee: EstampWalletPart;
  mode: 'live' | 'test';
  simulated: boolean;
}

export interface WalletTopupParams {
  /** Rupees to put in the wallet, without any fee or tax. Positive. */
  baseAmount: number;
}
/**
 * Stamp Duty top-up. `baseAmount`, `gstAmount` and `totalCharged` are JSON numbers; every other amount is a
 * string. Read the fee, GST and total from here: do not compute them.
 */
export interface StampDutyWalletTopup {
  baseAmount: number;
  processingFeePercent: string;
  processingFeeAmount: string;
  gstAmount: number;
  totalCharged: number;
  creditAmount: string;
  /** Live only. Also the invoice id. */
  topupId?: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  sandbox?: boolean;
  credited?: string;
  balance?: string;
  currency?: string;
  notice?: string;
}
/** Service Fee top-up: every amount is a string. */
export interface ServiceFeeWalletTopup {
  baseAmount: string;
  gstAmount: string;
  processingFeePercent: string;
  processingFeeAmount: string;
  creditAmount: string;
  totalCharged: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  sandbox?: boolean;
  credited?: string;
  balance?: string;
  currency?: string;
  notice?: string;
}

export interface WalletListParams {
  limit?: number;
  cursor?: string;
}
export interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  referenceId: string;
  description: string;
  mode: string;
  createdAt: string;
}
export type WalletTransactionsPage = Page<WalletTransaction>;

/** GST tax invoice for the processing fee of one paid Stamp Duty top-up (not for the credited amount). */
export interface StampDutyWalletInvoice {
  id: string;
  invoiceNumber: string | null;
  razorpayOrderId: string;
  baseAmount: string;
  gstAmount: string;
  totalCharged: string;
  creditedAmount: string;
  gstin: string | null;
  gstinVerified: boolean;
  legalBusinessName: string | null;
  status: string;
  paidAt: string | null;
}
export type StampDutyWalletInvoicesPage = Page<StampDutyWalletInvoice> & { notice?: string };

/** GST tax invoice for one Service Fee top-up. */
export interface ServiceFeeWalletInvoice {
  id: string;
  invoiceNumber: string | null;
  baseAmount: string;
  gstAmount: string;
  totalCharged: string;
  gstin: string | null;
  gstinVerified: boolean;
  legalBusinessName: string | null;
  status: string;
  paidAt: string | null;
}
export type ServiceFeeWalletInvoicesPage = Page<ServiceFeeWalletInvoice>;
