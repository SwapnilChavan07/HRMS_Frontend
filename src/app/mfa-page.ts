import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApiService } from './auth-api.service';

@Component({
  selector: 'app-mfa-page',
  imports: [FormsModule],
  templateUrl: './mfa-page.html',
  styleUrl: './mfa-page.css',
})
export class MfaPage {
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  readonly usernameOrEmail = this.authApi.usernameOrEmail;
  readonly enrollmentDetails = this.authApi.enrollmentDetails;
  readonly qrCodeSource = computed(() => {
    const encodedQr = this.enrollmentDetails()?.qrCodeBase64;
    if (!encodedQr) {
      return null;
    }
    if (encodedQr.startsWith('data:image/')) {
      return encodedQr;
    }
    const imageType = encodedQr.startsWith('PHN2Zy') ? 'image/svg+xml' : 'image/png';
    return `data:${imageType};base64,${encodedQr}`;
  });
  readonly successMessage = this.authApi.successMessage;
  readonly otpCode = signal('');
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');
  readonly selectedMethod = signal<'email' | 'authenticator' | null>(null);
  readonly isSubmitting = signal(false);
  readonly isEnrolling = signal(false);
  readonly authenticatorAlreadyEnabled = signal(false);
  readonly isSendingEmailOtp = signal(false);
  readonly emailOtpSent = signal(false);
  readonly isVerified = signal(false);

  constructor() {
    if (!this.usernameOrEmail()) {
      void this.router.navigateByUrl('/login');
    }
  }

  chooseAuthenticator(): void {
    this.selectedMethod.set('authenticator');
    this.otpCode.set('');
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.authenticatorAlreadyEnabled.set(false);
    this.authApi.clearEnrollmentDetails();

    if (this.isEnrolling()) {
      return;
    }
    this.isEnrolling.set(true);
    this.authApi.enrollAuthenticator().subscribe({
      next: (response) => {
        if (this.authApi.setEnrollmentDetails(response)) {
          this.infoMessage.set(
            this.authApi.getResponseMessage(response) ??
              'Scan the QR code with your authenticator app, then enter the six-digit code.',
          );
        } else {
          this.errorMessage.set(
            this.authApi.getResponseMessage(response) ??
              'Authenticator setup did not return QR code details.',
          );
        }
        this.isEnrolling.set(false);
      },
      error: (error: unknown) => {
        if (this.isAuthenticatorAlreadyEnabledError(error)) {
          this.authenticatorAlreadyEnabled.set(true);
          this.infoMessage.set(
            'Authenticator is already enabled. Enter the six-digit code from your authenticator app.',
          );
        } else {
          this.errorMessage.set(this.getErrorMessage(error));
        }
        this.isEnrolling.set(false);
      },
    });
  }

  chooseEmail(): void {
    this.selectedMethod.set('email');
    this.otpCode.set('');
    this.emailOtpSent.set(false);
    this.infoMessage.set('');
    this.errorMessage.set('');

    const usernameOrEmail = this.usernameOrEmail();
    if (!usernameOrEmail || this.isSendingEmailOtp()) {
      return;
    }

    this.isSendingEmailOtp.set(true);
    this.authApi.sendEmailOtp(usernameOrEmail).subscribe({
      next: (response) => {
        if (!this.authApi.isSuccessfulResponse(response)) {
          this.errorMessage.set(
            this.authApi.getResponseMessage(response) ?? 'The email verification code could not be sent.',
          );
        } else {
          this.emailOtpSent.set(true);
          this.infoMessage.set(
            this.authApi.getResponseMessage(response) ?? 'A verification code was sent to your registered email.',
          );
        }
        this.isSendingEmailOtp.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.isSendingEmailOtp.set(false);
      },
    });
  }

  verifyCode(): void {
    const code = this.otpCode().trim();
    const usernameOrEmail = this.usernameOrEmail();
    this.errorMessage.set('');
    if (!this.selectedMethod()) {
      this.errorMessage.set('Choose an authentication method first.');
      return;
    }
    if (this.selectedMethod() === 'email' && !this.emailOtpSent()) {
      this.errorMessage.set('Send a verification code to your registered email before continuing.');
      return;
    }
    if (!usernameOrEmail || !/^\d{6}$/.test(code) || this.isSubmitting()) {
      if (!/^\d{6}$/.test(code)) {
        this.errorMessage.set('Enter the 6-digit verification code.');
      }
      return;
    }

    if (this.selectedMethod() === 'authenticator') {
      this.isSubmitting.set(true);
      const verification = this.enrollmentDetails()
        ? this.authApi.verifyAuthenticatorSetupOtp(code)
        : this.authApi.verifyAuthenticatorLogin(usernameOrEmail, code);
      verification.subscribe({
        next: (response) => {
          if (!this.authApi.completeLogin(response, usernameOrEmail)) {
            this.errorMessage.set(
              this.authApi.getResponseMessage(response) ?? 'The authenticator code was not accepted.',
            );
          } else {
            this.isVerified.set(true);
            this.infoMessage.set(
              this.authApi.getResponseMessage(response) ??
                'Authenticator code verified successfully. Login successful.',
            );
          }
          this.isSubmitting.set(false);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.getErrorMessage(error));
          this.isSubmitting.set(false);
        },
      });
      return;
    }

    this.isSubmitting.set(true);
    this.authApi.verifyEmailOtp(usernameOrEmail, code).subscribe({
      next: (response) => {
        if (!this.authApi.completeLogin(response)) {
          this.errorMessage.set(this.authApi.getResponseMessage(response) ?? 'The verification code was not accepted.');
        } else {
          this.isVerified.set(true);
          this.infoMessage.set(this.authApi.getResponseMessage(response) ?? 'OTP verified successfully. Login successful.');
        }
        this.isSubmitting.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.isSubmitting.set(false);
      },
    });
  }

  startOver(): void {
    this.authApi.clearSession();
    void this.router.navigateByUrl('/login');
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
      if (error.status === 0) {
        return 'Unable to connect to the sign-in service. Check your connection and try again.';
      }
    }
    return 'The request could not be completed. Please try again.';
  }

  private isAuthenticatorAlreadyEnabledError(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }
    const body = error.error;
    const message =
      typeof body === 'string'
        ? body
        : typeof body === 'object' && body !== null && 'message' in body &&
            typeof body.message === 'string'
          ? body.message
          : '';
    return /authenticator is already enabled/i.test(message);
  }
}
