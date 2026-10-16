export interface UsageSummary {
  currentPeriod?: { start?: string; end?: string };
  totalApiRequests?: number;
  callsByService?: Record<string, number>;
  callsByPeriod?: Array<{ period: string; count: number }>;
  callsByDay?: Array<{ day: string; count: number }>;
  [key: string]: unknown;
}

export interface LogEntry {
  id: string;
  createdAt?: string;
  actorType?: string;
  actorId?: string | null;
  service?: string;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface LogListParams {
  /** ISO date/time lower bound (inclusive). */
  from?: string;
  /** ISO date/time upper bound (exclusive). */
  to?: string;
  /** One service code, e.g. `estamp`. */
  service?: string;
  status?: 'success' | 'failure';
  /** Page size; default 50, max 200. */
  limit?: number;
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string | null;
  [key: string]: unknown;
}
export type LogPage = Page<LogEntry>;

export interface WebhookDelivery {
  id?: string;
  [key: string]: unknown;
}
export type WebhookEventPage = Page<WebhookDelivery>;
export interface WebhookEventListParams {
  limit?: number;
  cursor?: string;
}
export type WebhookReplayResult = { [key: string]: unknown };
