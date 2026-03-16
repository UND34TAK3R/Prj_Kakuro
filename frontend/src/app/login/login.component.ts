import { Component, inject } from '@angular/core';
import { RouterLink, Router } from "@angular/router";
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { FirebaseService } from '../services/firebase.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})

// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Derrick Mangari 2026-03-13       Created the Login Component with no functionality, just the template and styles for now.
// Derrick Mangari 2026-03-14       Added form controls and validation, and implemented the login method to authenticate users with Firebase Auth.
//                                  Also added error handling to display user-friendly messages based on Firebase error codes.
export class LoginComponent {
  private fb = inject(FormBuilder);
  private firebase = inject(FirebaseService);
  private router = inject(Router);

  error = '';

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  async login() {
    this.error = '';

    // Mark all fields as touched so inline validation errors appear
    this.form.markAllAsTouched();

    if (this.form.invalid) return;

    const { email, password } = this.form.value;

    try {
      await this.firebase.login(email!, password!);
      this.router.navigate(['/homepage']);
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? '';
      console.log(code, err.message);
      this.error = this.getErrorMessage(code);
    }
  }

  private getErrorMessage(code: string): string {
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      default:
        return 'An error occurred. Please try again.';
    }
  }
}