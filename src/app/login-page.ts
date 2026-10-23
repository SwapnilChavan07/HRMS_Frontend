import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApiService } from './auth-api.service';

const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');
  readonly lockoutTimeRemaining = signal<string | null>(null);
  private lockoutDeadline: number | null = null;
  private lockoutTimer: ReturnType<typeof setInterval> | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    usernameOrEmail: ['', [Validators.required, Validators.maxLength(150)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  async submit(): Promise<void> {
    this.errorMessage.set('');
    if (this.form.invalid || this.isSubmitting() || this.lockoutDeadline !== null) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const { usernameOrEmail, password } = this.form.getRawValue();

    this.authApi.beginLogin(usernameOrEmail.trim(), password).subscribe({
      next: (response) => {
        if (!this.authApi.completeLogin(response, usernameOrEmail.trim())) {
          this.errorMessage.set(this.authApi.getResponseMessage(response) ?? 'The sign-in service rejected these credentials.');
          this.startLoginLockout(response);
          this.isSubmitting.set(false);
          return;
        }
        this.isSubmitting.set(false);
        void this.router.navigateByUrl('/mfa');
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.startLoginLockout(error instanceof HttpErrorResponse ? error.error : null);
        this.isSubmitting.set(false);
      },
    });
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.stopLoginLockout());
  }

  private startLoginLockout(response: unknown): void {
    this.stopLoginLockout();
    if (typeof response !== 'object' || response === null || Array.isArray(response)) {
      return;
    }
    const result = (response as Record<string, unknown>)['result'];
    if (typeof result !== 'object' || result === null || Array.isArray(result)) {
      return;
    }
    const lockout = result as Record<string, unknown>;
    const failedAt = lockout['failedLoginAttemptsDateTime'];
    if (lockout['canLogin'] !== false || typeof failedAt !== 'string') {
      return;
    }

    const timestampWithTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(failedAt)
      ? failedAt
      : `${failedAt}Z`;
    const failedAtTimestamp = Date.parse(timestampWithTimezone);
    if (!Number.isFinite(failedAtTimestamp)) {
      return;
    }

    this.lockoutDeadline = failedAtTimestamp + LOGIN_LOCKOUT_DURATION_MS;
    this.updateLockoutCountdown();
    if (this.lockoutDeadline !== null) {
      this.lockoutTimer = setInterval(() => this.updateLockoutCountdown(), 1000);
    }
  }

  private updateLockoutCountdown(): void {
    if (this.lockoutDeadline === null) {
      return;
    }
    const remainingMs = this.lockoutDeadline - Date.now();
    if (remainingMs <= 0) {
      this.stopLoginLockout();
      return;
    }

    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    this.lockoutTimeRemaining.set(
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
    );
  }

  private stopLoginLockout(): void {
    if (this.lockoutTimer !== null) {
      clearInterval(this.lockoutTimer);
      this.lockoutTimer = null;
    }
    this.lockoutDeadline = null;
    this.lockoutTimeRemaining.set(null);
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
    return 'Sign-in could not be completed. Please try again.';
  }
}
