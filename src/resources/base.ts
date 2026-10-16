import {
  rejectedAPIPromise,
  type APIPromise,
  type HttpClient,
  type RequestOptions,
} from '../http.js';
import { requireId } from '../validators.js';

export interface Context {
  http: HttpClient;
  validateInput: boolean;
}

export abstract class Resource {
  protected readonly ctx: Context;
  constructor(ctx: Context) {
    this.ctx = ctx;
  }
}

export const enc = (v: string): string => encodeURIComponent(v);

/** GET helper that validates one path id and returns a rejected promise on failure. */
export function pathCall<R>(
  ctx: Context,
  field: string,
  value: string,
  build: (id: string) => string,
  opts?: RequestOptions,
): APIPromise<R> {
  try {
    return ctx.http.request<R>({ method: 'GET', path: build(requireId(value, field)) }, opts);
  } catch (err) {
    return rejectedAPIPromise<R>(err);
  }
}
