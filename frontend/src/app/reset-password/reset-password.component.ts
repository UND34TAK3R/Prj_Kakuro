import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';

@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, ReactiveFormsModule, CommonModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})

// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Justin P.       2026-04-12   Created RequestPasswordComponent: implements isd Request Password Reset.
//                              1. verifyEmail(email) – validates the form field.
//                              2. sendChangePasswordRequest(email) – calls Firebase sendPasswordResetEmail.
//                              3. displaySuccessMessage() / displayErrorMessage() – shown via template bindings.

export class ResetPasswordComponent {
  private fb   = inject(FormBuilder);
  private auth = inject(Auth);

  successMessage = '';
  errorMessage   = '';
  loading        = false;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  // 1.1: verifyEmail(email)
  private verifyEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // 1.2: sendChangePasswordRequest(email)
  private async sendChangePasswordRequest(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email.trim());
  }

  async requestReset(): Promise<void> {
    this.successMessage = '';
    this.errorMessage   = '';
    this.form.markAllAsTouched();

    if (this.form.invalid) return;

    const email = this.form.value.email!;

    // 1.1: verifyEmail
    if (!this.verifyEmail(email)) {
      this.errorMessage = 'Please enter a valid email address.';
      return;
    }

    this.loading = true;
    try {
      // 1.2: sendChangePasswordRequest
      await this.sendChangePasswordRequest(email);
      // 1.3: displaySuccessMessage
      this.successMessage = 'Password reset email sent! Check your inbox.';
      this.form.reset();
    } catch (err: any) {
      // 1.4: displayErrorMessage
      this.errorMessage = this.getErrorMessage(err?.code ?? '');
    } finally {
      this.loading = false;
    }
  }

  private getErrorMessage(code: string): string {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/invalid-email':
        return 'No account found with that email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}
