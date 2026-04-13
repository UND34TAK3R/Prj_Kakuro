import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private firebaseService = inject(FirebaseService);

  applyTheme(theme: string): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  loadThemeForUser(uid: string): void {
    this.firebaseService.getUserPreferences(uid).subscribe(data => {
      const theme = data?.preferences?.theme ?? 'light';
      this.applyTheme(theme);
    });
  }
}
