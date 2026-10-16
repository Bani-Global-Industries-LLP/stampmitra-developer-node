/** Loose object for payloads whose shape the API has not finalised. Unknown fields are preserved. */
export interface AnyObject {
  [key: string]: unknown;
}

export interface Service {
  serviceCode: string;
  name?: string;
  active?: boolean;
  [key: string]: unknown;
}
/** `GET /v1/services` returns a bare array (older docs showed `{ services: [...] }`; both are tolerated at runtime). */
export type ServiceList = Service[];

/** GET /v1/estamp/* reference-data responses; shapes are not finalised upstream. */
export type EstampSchema = AnyObject;
export type EstampStates = AnyObject;
export type EstampInstruments = AnyObject;
export type EstampArticles = AnyObject;

export type DutyCalculateParams = AnyObject;
export type DutyCalculation = AnyObject;
export type AddPartiesParams = AnyObject;
export type AddPartiesResult = AnyObject;

export interface OrderCreateParams {
  /** Your own reference for this order. */
  externalOrderId: string;
  /** Your own reference for the customer. */
  externalCustomerId: string;
  /** Entitled service code, e.g. `estamp.instrument.rent_agreement` (see `services.list()`). */
  serviceCode: string;
  /** Free-form, service-specific payload (the e-Stamp field shape is not finalised). */
  details?: AnyObject;
  [key: string]: unknown;
}
export interface Order extends AnyObject {
  id?: string;
}
export type OrderStatus = AnyObject;
export type OrderPayment = AnyObject;
export type OrderDocuments = AnyObject;
export type DocumentDownload = AnyObject;

export type PaymentIntentCreateParams = AnyObject;
export interface PaymentIntent extends AnyObject {
  id?: string;
}
