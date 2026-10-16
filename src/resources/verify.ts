import { rejectedAPIPromise, type APIPromise, type RequestOptions } from '../http.js';
import type * as T from '../types/verify.js';
import * as v from '../validators.js';
import { Resource } from './base.js';

/** Identity & business verification. Every call, including negative results, is billed. These POSTs are never auto-retried. */
export class Verify extends Resource {
  private post<R>(
    path: string,
    body: Record<string, unknown>,
    opts?: RequestOptions,
  ): APIPromise<R> {
    return this.ctx.http.request<R>({ method: 'POST', path, body }, opts);
  }

  /** Runs `build` (which validates and normalises) unless validation is disabled. Throws synchronously-as-rejection. */
  private run<P, R>(
    params: P,
    path: string,
    build: (p: P) => Record<string, unknown>,
    opts?: RequestOptions,
  ): APIPromise<R> {
    let body: Record<string, unknown>;
    try {
      body = this.ctx.validateInput ? build(params) : { ...(params as object) };
    } catch (err) {
      return rejectedAPIPromise<R>(err);
    }
    return this.post<R>(path, body, opts);
  }

  /** POST /v1/verify/pan */
  pan(params: T.PanVerifyParams, opts?: RequestOptions): APIPromise<T.PanVerification> {
    return this.run(
      params,
      '/v1/verify/pan',
      (p) => ({ pan: v.normalizePan(p.pan), ...opt('name', v.optionalName(p.name)) }),
      opts,
    );
  }

  /** POST /v1/verify/gstin */
  gstin(params: T.GstinVerifyParams, opts?: RequestOptions): APIPromise<T.GstinVerification> {
    return this.run(
      params,
      '/v1/verify/gstin',
      (p) => ({
        gstin: v.normalizeGstin(p.gstin),
        ...opt('businessName', v.optionalName(p.businessName, 'businessName')),
      }),
      opts,
    );
  }

  /** POST /v1/verify/rc */
  rc(params: T.RcVerifyParams, opts?: RequestOptions): APIPromise<T.RcVerification> {
    return this.run(
      params,
      '/v1/verify/rc',
      (p) => ({ vehicleNumber: v.normalizeVehicleNumber(p.vehicleNumber) }),
      opts,
    );
  }

  /** POST /v1/verify/voter-id */
  voterId(params: T.VoterIdVerifyParams, opts?: RequestOptions): APIPromise<T.VoterIdVerification> {
    return this.run(
      params,
      '/v1/verify/voter-id',
      (p) => ({ voterId: v.normalizeVoterId(p.voterId), ...opt('name', v.optionalName(p.name)) }),
      opts,
    );
  }

  /** POST /v1/verify/driving-license (needs an IP-allowlisted key; a 403 carries the server's message). */
  drivingLicense(
    params: T.DrivingLicenseVerifyParams,
    opts?: RequestOptions,
  ): APIPromise<T.DrivingLicenseVerification> {
    return this.run(
      params,
      '/v1/verify/driving-license',
      (p) => ({
        dlNumber: v.normalizeDrivingLicense(p.dlNumber),
        dob: v.normalizeDate(p.dob, 'dob'),
      }),
      opts,
    );
  }

  /** POST /v1/verify/passport (needs an IP-allowlisted key; a 403 carries the server's message). */
  passport(
    params: T.PassportVerifyParams,
    opts?: RequestOptions,
  ): APIPromise<T.PassportVerification> {
    return this.run(
      params,
      '/v1/verify/passport',
      (p) => ({
        fileNumber: v.normalizePassportFileNumber(p.fileNumber),
        dob: v.normalizeDate(p.dob, 'dob'),
        ...opt('name', v.optionalName(p.name)),
      }),
      opts,
    );
  }

  /** POST /v1/verify/cin */
  cin(params: T.CinVerifyParams, opts?: RequestOptions): APIPromise<T.CinVerification> {
    return this.run(params, '/v1/verify/cin', (p) => ({ cin: v.normalizeCin(p.cin) }), opts);
  }

  /** POST /v1/verify/udyam */
  udyam(params: T.UdyamVerifyParams, opts?: RequestOptions): APIPromise<T.UdyamVerification> {
    return this.run(
      params,
      '/v1/verify/udyam',
      (p) => ({ udyamNumber: v.normalizeUdyam(p.udyamNumber) }),
      opts,
    );
  }

  /** POST /v1/verify/pan-to-gstin */
  panToGstin(params: T.PanToGstinParams, opts?: RequestOptions): APIPromise<T.PanToGstinResult> {
    return this.run(
      params,
      '/v1/verify/pan-to-gstin',
      (p) => ({ pan: v.normalizePan(p.pan) }),
      opts,
    );
  }

  /** POST /v1/verify/pan-to-udyam */
  panToUdyam(params: T.PanToUdyamParams, opts?: RequestOptions): APIPromise<T.PanToUdyamResult> {
    return this.run(
      params,
      '/v1/verify/pan-to-udyam',
      (p) => ({ pan: v.normalizePan(p.pan) }),
      opts,
    );
  }

  /** POST /v1/verify/bank-account */
  bankAccount(
    params: T.BankAccountVerifyParams,
    opts?: RequestOptions,
  ): APIPromise<T.BankAccountVerification> {
    return this.run(
      params,
      '/v1/verify/bank-account',
      (p) => ({
        accountNumber: v.normalizeAccountNumber(p.accountNumber),
        ifsc: v.normalizeIfsc(p.ifsc),
        ...opt('name', v.optionalName(p.name)),
        ...opt('phone', p.phone === undefined ? undefined : v.normalizePhone(p.phone)),
      }),
      opts,
    );
  }
}

function opt(key: string, value: string | undefined): Record<string, string> {
  return value === undefined ? {} : { [key]: value };
}
