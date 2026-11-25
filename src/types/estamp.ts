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
  /** The id you supplied; orders are addressed by it (`orders.get(externalOrderId)`). */
  externalOrderId?: string;
  createdAt?: string;
  serviceCode?: string;
}
export type OrderStatus = AnyObject;
export type OrderPayment = AnyObject;
export type OrderDocuments = AnyObject;
export type DocumentDownload = AnyObject;

export type PaymentIntentCreateParams = AnyObject;
export interface PaymentIntent extends AnyObject {
  id?: string;
}

// ---------------------------------------------------------------------------
// e-Stamp (contract 1.2.0): catalogue, typed orders, stamps, PAN card, certificates
// ---------------------------------------------------------------------------

export type EstampCategory = 'e_stamp' | 'traditional_stamp';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

/** One party to the instrument. Unknown properties are rejected by the API (`UNKNOWN_FIELD`). */
export interface EstampParty {
  name: string;
  address?: string;
  phone?: string;
  fatherHusbandName?: string;
  gender?: Gender;
}

export interface EstampPropertyArea {
  unit: 'Square Feet' | 'Square Yard' | 'Square Meters' | 'Not Applicable';
  /** Required, and greater than 0, unless the unit is `Not Applicable`. */
  value?: number;
}

/** One stamp line of an order. `firstParty` / `secondParty` take a bare name or an {@link EstampParty}. */
export interface EstampStampLine {
  clientReference?: string;
  /** State code from `estamp.listStates()`. One order covers exactly one state. */
  state: string;
  category?: EstampCategory;
  articleCode: string;
  /** Requested duty in rupees; the authoritative duty is computed by StampMitra. */
  denomination: number;
  /** A party name, `FIRST_PARTY` or `SECOND_PARTY`. */
  stampDutyPayer?: string;
  payerPhone?: string;
  payerGender?: Gender;
  firstParty: string | EstampParty;
  secondParty?: string | EstampParty;
  purpose?: string;
  district?: string;
  sro?: string;
  cessAmount?: number;
  propertyArea?: EstampPropertyArea;
  /** https link to the payer's PAN card. An order can be placed without it, but the PAN card is mandatory to complete the stamp: until one is on file the stamp waits; send it with the order or later with `setStampPanCard`. */
  panCardImage?: string;
  costCentre?: string;
  businessUnit?: string;
  linkedDocRef?: string;
  /** 1 to 1000 (default 1). */
  quantity?: number;
}

/** Body of `validateOrder` and `createOrder`: 1 to 5000 stamp lines, all in one state. */
export interface EstampOrderRequest {
  reference?: string;
  stamps: EstampStampLine[];
}

export interface EstampStateAvailability {
  code: string;
  name: string;
  active: boolean;
  eStampAvailable: boolean;
  traditionalAvailable: boolean;
}
export interface EstampStatesAvailability {
  data: EstampStateAvailability[];
  count: number;
  activeCount: number;
}
export interface EstampStatesAvailabilityParams {
  /** Only states that are (or are not) accepting orders. */
  active?: boolean;
}

/** A null flag means "not known", not "no". */
export interface EstampState {
  code: string;
  name: string;
  isActive?: boolean;
  eStampAvailable?: boolean;
  traditionalAvailable?: boolean;
  minAmount?: string | number | null;
  maxAmount?: string | number | null;
  sroRequired?: boolean;
  cessRequired?: boolean;
  propertyAreaRequired?: boolean;
  fatherHusbandNameRequired?: boolean | null;
  firstPartyAddressRequired?: boolean | null;
  panCardImageRequired?: boolean | null;
  instrumentCount?: number;
  [key: string]: unknown;
}

export interface EstampRequirementsParams {
  articleCode?: string;
  denomination?: number;
  category?: EstampCategory;
}
export interface EstampRequirementField {
  field?: string;
  name?: string;
  required: boolean;
  requiredWhen?: Record<string, unknown>;
  recommended?: boolean;
  enforcedByBulkApi?: boolean;
  description?: string;
  allowedValues?: string[];
  [key: string]: unknown;
}
export interface EstampRequirements {
  state?: { code?: string; name?: string; active?: boolean };
  category?: EstampCategory;
  article?: { code?: string; isSecondPartyNA?: boolean };
  denomination?: {
    provided?: number | null;
    min?: number | null;
    max?: number | null;
    allowedAmounts?: unknown[] | null;
    multipleOf?: number | null;
  };
  fields?: EstampRequirementField[];
  limits?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  /** A valid single-stamp body for this combination, ready for `validateOrder`. */
  exampleBody: { stamps: EstampStampLine[] };
  [key: string]: unknown;
}

export interface EstampDistrict {
  code: string;
  name: string;
  [key: string]: unknown;
}
export type EstampDistrictList = EstampDistrict[];
export interface EstampSro {
  /** Send as `sro` on a stamp line. */
  value: string;
  label?: string;
  name?: string;
  [key: string]: unknown;
}
export type EstampSroList = EstampSro[];

/** Priced totals in rupees. Never recalculate or override them. */
export interface EstampOrderQuote {
  faceValueTotal: number;
  serviceFeeTotal: number;
  gstOnFee: number;
  serviceWalletDebitTotal: number;
}
export interface EstampValidationIssue {
  index: number;
  message: string;
  code?: string;
  field?: string;
}
export interface EstampDocumentRequirement {
  type: 'PAN_CARD_IMAGE';
  required: boolean;
  recommended: boolean;
  uploadWith: string;
}
export interface EstampOrderCounts {
  total?: number;
  e_stamp?: number;
  traditional_stamp?: number;
}
/** Nothing was saved and nothing was charged. */
export interface EstampValidateResult {
  valid: boolean;
  reference: string | null;
  state: string | null;
  status: 'READY_TO_PLACE' | 'WARNINGS' | 'NEEDS_INFORMATION';
  isTest: boolean;
  counts: EstampOrderCounts;
  errors: EstampValidationIssue[];
  warnings: EstampValidationIssue[];
  quote: EstampOrderQuote | null;
  documentsRequired: EstampDocumentRequirement[];
  createdAt: string;
  [key: string]: unknown;
}

export interface EstampOrderStampRef {
  id: string;
  clientReference?: string;
}
/** A non-blocking hint that never rejects the order (e.g. `PAN_CARD_RECOMMENDED`: the PAN card is still mandatory to complete the stamp). */
export interface EstampOrderAdvisory {
  code: string;
  field?: string;
  message: string;
}
export interface EstampOrder {
  id: string;
  orderId?: string;
  reference?: string | null;
  state?: string;
  /** Pre-placement status on a live order (e.g. `PENDING_REVIEW`); other values are possible, treat unknown ones as unknown-safe. */
  status: string;
  isTest?: boolean;
  counts?: EstampOrderCounts;
  stampCount?: number;
  stamps?: EstampOrderStampRef[];
  documents?: { panCard?: 'MISSING' | 'RECEIVED' };
  advisories?: EstampOrderAdvisory[];
  errors?: unknown[];
  warnings?: unknown[];
  warningsAcknowledged?: boolean;
  failure?: { code: string; message: string };
  sandbox?: { scenario?: string; statusChangedAt?: string; nextStatusAt?: string | null };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}
export interface EstampOrderListParams {
  /** Page numbers beyond 20 are refused; continue with `cursor`. */
  page?: number;
  /** 1 to 100 (default 20). */
  limit?: number;
  cursor?: string;
}
export interface EstampOrderList {
  items: EstampOrder[];
  nextCursor: string | null;
  data?: EstampOrder[];
  pagination?: { page: number; limit: number; total: number | null };
  [key: string]: unknown;
}
export interface EstampOrderExport {
  filename: string;
  csv: string;
}

export type EstampPanCardState =
  'NOT_PROVIDED' | 'PROCESSING' | 'VERIFIED' | 'IN_REVIEW' | 'REJECTED' | 'FAILED';
export interface EstampPanCardStatus {
  status: EstampPanCardState;
  code: string | null;
  message: string | null;
}
export interface EstampStamp {
  id: string;
  clientReference?: string;
  bulkOrderId?: string;
  status: string;
  verified: boolean;
  panCard?: EstampPanCardStatus;
  state?: string;
  category?: EstampCategory;
  amount?: number;
  uin?: string;
  costCentre?: string;
  businessUnit?: string;
  purpose?: string;
  [key: string]: unknown;
}
export interface EstampStampList {
  items: EstampStamp[];
  count: number;
  nextCursor: string | null;
}
/** HTTP 202: the check runs afterwards, so `panCard.status` is `PROCESSING`. */
export interface EstampPanCardResult {
  stampId: string;
  panCard: EstampPanCardStatus;
}
export interface EstampDocument {
  documentId: string;
  orderId: string;
  type: 'pan_card';
  fileName: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  sizeBytes: number;
  receivedAt: string;
  status: 'RECEIVED';
}
/** Always HTTP 200: `available` says whether the certificate has been delivered. */
export interface EstampCertificate {
  available: boolean;
  status: 'not_yet_available' | 'available';
  /** StampMitra-hosted, time-limited (5 minute) URL: download promptly. */
  downloadUrl?: string;
  expiresAt?: string;
  certificateNumber?: string | null;
}

/** A file for the PAN card upload. Use a `Blob`/`File`, or raw bytes with `fileName` and `contentType`. */
export interface EstampDocumentUploadParams {
  /** PDF, JPEG or PNG, at most 10 MB (checked by the API). */
  file: Blob | Uint8Array | ArrayBuffer;
  /** File name sent with the part (default: the `File` name, else `pan-card`). */
  fileName?: string;
  /** Content type of the part (default: the `Blob` type). Must match the file's actual bytes. */
  contentType?: string;
  /** Only `pan_card` is accepted (the default). */
  type?: 'pan_card';
}
export interface EstampPanCardParams {
  /** https link (default port, no credentials) to the payer's PAN card. A new link replaces any earlier one. */
  panCardImage: string;
}
