import type { APIPromise, RequestOptions } from '../http.js';
import type { Service, ServiceList } from '../types/estamp.js';
import { Resource, enc, pathCall } from './base.js';

export class Services extends Resource {
  /** GET /v1/services */
  list(opts?: RequestOptions): APIPromise<ServiceList> {
    return this.ctx.http.request({ method: 'GET', path: '/v1/services' }, opts);
  }

  /** GET /v1/services/{serviceCode} */
  get(serviceCode: string, opts?: RequestOptions): APIPromise<Service> {
    return pathCall(this.ctx, 'serviceCode', serviceCode, (c) => `/v1/services/${enc(c)}`, opts);
  }
}
