/** Every verification response carries `referenceId` (billed, even for negative results). Unknown fields are preserved. */
export interface VerifyResult {
  referenceId: string;
  [key: string]: unknown;
}

export interface PanVerifyParams {
  /** ABCDE1234F. Normalised to upper case. */
  pan: string;
  /** Name to match against records (max 256 chars). */
  name?: string;
}
export interface PanVerification extends VerifyResult {
  pan?: string;
  type?: string;
  valid?: boolean;
  registeredName?: string;
  fatherName?: string;
  panStatus?: string;
  panStatusCode?: string;
  panStatusDescription?: string;
  nameMatchResult?: string;
  nameMatchScore?: string;
  aadhaarSeedingStatus?: string;
  aadhaarSeedingStatusDescription?: string;
  lastUpdatedAt?: string;
  message?: string;
}

export interface GstinVerifyParams {
  gstin: string;
  businessName?: string;
}
export interface GstinVerification extends VerifyResult {
  GSTIN?: string;
  valid?: boolean;
  legalName?: string;
  tradeName?: string;
  registrationStatus?: string;
  principalPlaceOfBusiness?: string;
  message?: string;
}

export interface RcVerifyParams {
  /** e.g. MH12AB1234. */
  vehicleNumber: string;
}
export interface RcVerification extends VerifyResult {
  regNo?: string;
  registrationStatus?: string;
  ownerName?: string;
  ownerFatherName?: string;
  vehicleClass?: string;
  vehicleManufacturerName?: string;
  model?: string;
  vehicleColor?: string;
  chassis?: string;
  engine?: string;
  registrationDate?: string;
  rcStatus?: string;
  rcExpiryDate?: string;
  insuranceUpto?: string;
  isCommercial?: boolean;
}

export interface VoterIdVerifyParams {
  voterId: string;
  name?: string;
}
export interface VoterIdVerification extends VerifyResult {
  valid?: boolean;
  name?: string;
  dob?: string;
  gender?: string;
  age?: number;
  address?: string;
  state?: string;
}

export interface DrivingLicenseVerifyParams {
  dlNumber: string;
  /** YYYY-MM-DD */
  dob: string;
}
export interface DrivingLicenseVerification extends VerifyResult {
  valid?: boolean;
  name?: string;
  fatherOrHusbandName?: string;
  dob?: string;
  address?: string;
  validUpto?: string;
  dlStatus?: string;
}

export interface PassportVerifyParams {
  /** Passport application file number (e.g. PA1079341954215), not the passport number. */
  fileNumber: string;
  /** YYYY-MM-DD */
  dob: string;
  name?: string;
}
export interface PassportVerification extends VerifyResult {
  valid?: boolean;
  name?: string;
  dob?: string;
  applicationType?: string;
}

export interface CinVerifyParams {
  cin: string;
}
export interface CinDirector {
  din?: string;
  name?: string;
  designation?: string;
  [key: string]: unknown;
}
export interface CinVerification extends VerifyResult {
  valid?: boolean;
  companyName?: string;
  incorporationDate?: string;
  cinStatus?: string;
  companyStatus?: string;
  directors?: CinDirector[];
  email?: string;
  registrationNumber?: string;
  incorporationCountry?: string;
}

export interface UdyamVerifyParams {
  /** e.g. UDYAM-MH-12-1234567 */
  udyamNumber: string;
}
export interface UdyamVerification extends VerifyResult {
  found?: boolean;
  udyamStatus?: string;
  enterpriseName?: string;
  enterpriseType?: string;
  organizationType?: string;
  certificateUrl?: string;
}

export interface PanToGstinParams {
  pan: string;
}
export interface PanToGstinResult extends VerifyResult {
  found?: boolean;
  gstins?: Array<{ gstin?: string; state?: string; status?: string; [key: string]: unknown }>;
}

export interface PanToUdyamParams {
  pan: string;
}
export interface PanToUdyamResult extends VerifyResult {
  found?: boolean;
  status?: string;
  udyamNumber?: string;
}

export interface BankAccountVerifyParams {
  /** 9-18 digits. */
  accountNumber: string;
  /** 11 characters, e.g. ICIC0001234. */
  ifsc: string;
  /** Beneficiary name to match. */
  name?: string;
  /** Optional Indian mobile number (accepted by the API's validator; not listed in the spec snapshot). */
  phone?: string;
}
/** Note: the bank-account response in the spec snapshot has no `referenceId`; it is optional here. */
export interface BankAccountVerification {
  referenceId?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  branchName?: string;
  accountExists?: boolean;
  beneficiaryName?: string;
  nameMatch?: boolean;
  nameMatchScore?: number;
  accountStatus?: string;
  [key: string]: unknown;
}
