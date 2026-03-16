import { Component, inject } from '@angular/core';
import { RouterLink, Router } from "@angular/router";
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { FirebaseService } from '../services/firebase.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  imports: [RouterLink, ReactiveFormsModule, CommonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})

// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Derrick Mangari 2026-03-13       Created the Register Component with no functionality, just the template and styles for now.
// Derrick Mangari 2026-03-14       Added form controls and validation, and implemented the signUp method to register users with Firebase Auth. 
//                                  Also added error handling to display user-friendly messages based on Firebase error codes, and implemented a custom validator to ensure password and confirm password fields match.

export class RegisterComponent {
  private fb = inject(FormBuilder);
  private firebase = inject(FirebaseService);
  private router = inject(Router);

  error = '';

  passwordMatchValidator: ValidatorFn = (form: AbstractControl): ValidationErrors | null => {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  };

  form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
  }, { validators: this.passwordMatchValidator });

  async signUp() {
    this.error = '';

    // Mark all fields as touched so inline validation errors appear
    this.form.markAllAsTouched();

    if (this.form.invalid) return;

    const { username, email, password } = this.form.value;
    try {
      const taken = await this.firebase.isUsernameTaken(username!);
      if (taken) {
        this.error = this.getErrorMessage('username-taken');
        return;
      }
      await this.firebase.register(username!, email!, password!);
      this.router.navigate(['/homepage']);
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? '';
      this.error = this.getErrorMessage(code);
    }
  }

  private getErrorMessage(code: string): string {
    switch (code) {
      case 'passwordMismatch':          return 'Passwords do not match.';
      case 'username-taken':            return 'That username is already taken.';
      case 'auth/email-already-in-use': return 'Email is already registered.';
      case 'auth/invalid-email':        return 'Invalid email address.';
      case 'auth/weak-password':        return 'Password must be at least 6 characters.';
      default:                          return 'Something went wrong. Please try again.';
    }
  }
}
