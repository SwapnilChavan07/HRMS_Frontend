import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

interface ApiResult {
  isSuccess?: boolean;
  success?: boolean;
  message?: string;
  result?: unknown;
}

export interface AuthenticatorSetupDetails {
  qrCodeBase64: string;
  manualEntryKey: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly baseUrl = '/api/Auth';
  private readonly accessToken = signal<string | null>(null);
  readonly usernameOrEmail = signal<string | null>(null);
  readonly enrollmentDetails = signal<AuthenticatorSetupDetails | null>(null);
  readonly isAuthenticated = signal(false);
  readonly successMessage = signal('');

  constructor(private readonly http: HttpClient) {}

  beginLogin(usernameOrEmail: string, password: string): Observable<unknown> {
    return this.http.post<unknown>(
      `${this.baseUrl}/login`,
      { usernameOrEmail, password },
      { withCredentials: true },
    );
  }

  verifyEmailOtp(usernameOrEmail: string, otp: string): Observable<unknown> {
    return this.http.post<unknown>(
      `${this.baseUrl}/verifyotp`,
      { usernameOrEmail, otp },
      { headers: this.authorizationHeaders(), withCredentials: true },
    );
  }

  verifyAuthenticatorSetupOtp(code: string): Observable<unknown> {
    return this.http.post<unknown>(
      `${this.baseUrl}/authenticator/verify-setup-otp`,
      { code },
      { headers: this.authorizationHeaders(), withCredentials: true },
    );
  }

  verifyAuthenticatorLogin(usernameOrEmail: string, code: string): Observable<unknown> {
    return this.http.post<unknown>(
      `${this.baseUrl}/authenticator/verify-login-otp`,
      { usernameOrEmail, code },
      { withCredentials: true },
    );
  }

  sendEmailOtp(usernameOrEmail: string): Observable<unknown> {
    return this.http.post<unknown>(
      `${this.baseUrl}/sendotpToEmail`,
      { usernameOrEmail },
      { headers: this.authorizationHeaders(), withCredentials: true },
    );
  }

  enrollAuthenticator(): Observable<unknown> {
    return this.http.post<unknown>(
      `${this.baseUrl}/authenticator/setup`,
      null,
      { headers: this.authorizationHeaders(), withCredentials: true },
    );
  }

  completeLogin(response: unknown, usernameOrEmail?: string): boolean {
    const result = this.readResult(response);
    if (result?.isSuccess === false || result?.success === false) {
      return false;
    }

    if (usernameOrEmail) {
      this.usernameOrEmail.set(usernameOrEmail);
    }
    this.accessToken.set(
      this.readToken(result?.result) ?? this.readToken(response) ?? this.accessToken(),
    );
    this.successMessage.set(result?.message ?? '');
    this.isAuthenticated.set(true);
    return true;
  }

  setEnrollmentDetails(response: unknown): boolean {
    const result = this.readResult(response);
    if (result?.isSuccess === false || result?.success === false) {
      return false;
    }
    const payload = result?.result ?? response;
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return false;
    }
    const fields = payload as Record<string, unknown>;
    const qrCodeBase64 = fields['qrCodeBase64'];
    const manualEntryKey = fields['manualEntryKey'];
    if (
      typeof qrCodeBase64 !== 'string' ||
      !qrCodeBase64.trim() ||
      typeof manualEntryKey !== 'string' ||
      !manualEntryKey.trim()
    ) {
      return false;
    }

    this.accessToken.set(
      this.readToken(payload) ?? this.readToken(response) ?? this.accessToken(),
    );
    this.enrollmentDetails.set({
      qrCodeBase64: qrCodeBase64.trim(),
      manualEntryKey: manualEntryKey.trim(),
      message:
        (typeof fields['message'] === 'string' && fields['message']) ||
        result?.message ||
        'Scan the QR code with your authenticator app, then verify the six-digit code.',
    });
    this.successMessage.set(
      (typeof fields['message'] === 'string' && fields['message']) ||
        result?.message ||
        '',
    );
    return true;
  }

  clearEnrollmentDetails(): void {
    this.enrollmentDetails.set(null);
  }

  getResponseMessage(response: unknown): string | null {
    return this.readResult(response)?.message ?? null;
  }

  isSuccessfulResponse(response: unknown): boolean {
    const result = this.readResult(response);
    return result?.isSuccess !== false && result?.success !== false;
  }

  clearSession(): void {
    this.usernameOrEmail.set(null);
    this.accessToken.set(null);
    this.enrollmentDetails.set(null);
    this.isAuthenticated.set(false);
    this.successMessage.set('');
  }

  private authorizationHeaders(): HttpHeaders {
    const token = this.accessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private readResult(value: unknown): ApiResult | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    return {
      isSuccess: typeof record['isSuccess'] === 'boolean' ? record['isSuccess'] : undefined,
      success: typeof record['success'] === 'boolean' ? record['success'] : undefined,
      message: typeof record['message'] === 'string' ? record['message'] : undefined,
      result: record['result'],
    };
  }

  private readToken(value: unknown): string | null {
    if (typeof value === 'string' && value.split('.').length === 3) {
      return value;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    for (const key of ['token', 'accessToken', 'access_token']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.split('.').length === 3) {
        return candidate;
      }
    }
    return null;
  }

}
