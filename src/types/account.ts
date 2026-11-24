/** An amount in paise (integer) and rupees (paise / 100). */
export interface Money {
  paise: number;
  rupees: number;
}
export interface AccountBalance {
  generatedAt: string;
  environment: 'LIVE' | 'SANDBOX';
  sandbox: boolean;
  notice: string | null;
  currency: 'INR';
  balance: Money;
  available: Money;
  state: 'OK' | 'LOW_BALANCE' | 'FINISHED';
  lowBalance: boolean;
  lowBalanceThreshold: Money;
  estimatedCallsRemaining: {
    atCheapestPrice: number | null;
    cheapestProduct: { serviceCode: string; name: string; price: Money } | null;
    atSevenDayAverage: number | null;
    sevenDayAverageCost: Money | null;
  };
  lastTopUp: { amount: Money; at: string } | null;
  signupCredit: { granted: Money; left: Money };
  [key: string]: unknown;
}

export interface UsageCounts {
  requests: number;
  billedRequests: number;
  failedNotBilled: number;
  successNotBilled: number;
  pendingBilling: number;
  /** Before GST. */
  spend: Money;
}
export interface AccountUsagePeriod extends UsageCounts {
  month: string;
  from: string;
  to: string;
  gstIncluded: false;
  byProduct: Array<UsageCounts & { serviceCode: string; name: string }>;
  daily: Array<UsageCounts & { date: string }>;
}
export interface AccountUsage {
  generatedAt: string;
  environment: 'LIVE' | 'SANDBOX';
  sandbox: boolean;
  notice: string | null;
  timezone: 'Asia/Kolkata';
  currentMonth: AccountUsagePeriod;
  previousMonth: AccountUsagePeriod;
  today: {
    date: string;
    requests: number;
    billedRequests: number;
    failedNotBilled: number;
    spend: Money;
    requestsPerDay: { limit: number | null; used: number; remaining: number | null };
  };
  limits: {
    requestsPerMinute: { limit: number | null; source: 'PLAN' | 'LIVE_RAMP' | 'SANDBOX' | 'NONE' };
    requestsPerDay: { limit: number | null; source: 'PROVISIONAL' | 'NONE' };
  };
  [key: string]: unknown;
}
