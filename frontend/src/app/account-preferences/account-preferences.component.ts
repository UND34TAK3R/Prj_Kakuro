import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../services/firebase.service';
import { Subscription } from 'rxjs';
import { ThemeService } from '../services/theme.service';
import {MusicService} from '../services/music.service';

export interface UserPreferences {
  theme: string;
  backgroundMusic: string;
  profilePicture: string;
}

@Component({
  selector: 'app-account-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account-preferences.component.html',
  styleUrl: './account-preferences.component.css'
})
export class AccountPreferencesComponent implements OnInit, OnDestroy {
  private firebaseService = inject(FirebaseService);
  private themeService = inject(ThemeService);
  private musicService = inject(MusicService);

  currentUserId: string  = '';
  isSaving: boolean = false;
  saveSuccess: boolean = false;
  error: string  = '';

  // "up : UserPreferences" from all 3 sequence diagrams
  userPreferences: UserPreferences = {
    theme: 'light',
    backgroundMusic: 'none',
    profilePicture: ''
  };

  themes = [
    { value: 'light', label: 'Light'},
    { value: 'dark', label: 'Dark'},
    { value: 'ocean', label: 'Ocean'},
    { value: 'forest', label: 'Forest'}
  ];

  musicOptions = [
    { value: 'none', label: 'None'},
    { value: 'lofi', label: 'Lo-Fi'},
    { value: 'jazz', label: 'Jazz'},
    { value: 'nature', label: 'Nature'}
  ];

  avatarOptions = [
    { value: 'avatar1', label: '🧑'},
    { value: 'avatar2', label: '👩'},
    { value: 'avatar3', label: '🧔'},
    { value: 'avatar4', label: '👱'}
  ];

  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    const authSub = this.firebaseService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.loadPreferences();
      }
    });
    this.subscriptions.push(authSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private loadPreferences(): void {
    const prefSub = this.firebaseService
      .getUserPreferences(this.currentUserId)
      .subscribe(data => {
        if (!data) return;
        this.userPreferences = {
          theme: data.preferences?.theme ?? 'light',
          backgroundMusic: data.preferences?.backgroundMusic ?? 'none',
          profilePicture:  data.preferences?.profilePicture  ?? ''
        };
      });
    this.subscriptions.push(prefSub);
  }

  async selectTheme(theme: string): Promise<void> {
    this.userPreferences.theme = theme;
    this.themeService.applyTheme(theme);
    await this.saveUserPreferences();
  }

  async selectBackgroundMusic(music: string): Promise<void> {
    this.userPreferences.backgroundMusic = music;
    this.musicService.playMusic(music);
    await this.saveUserPreferences();
  }

  async changeProfilePicture(picture: string): Promise<void> {
    this.userPreferences.profilePicture = picture;
    await this.saveUserPreferences();
  }

  private async saveUserPreferences(): Promise<void> {
    try {
      this.isSaving = true;
      this.error    = '';
      await this.firebaseService.saveUserPreferences(
        this.currentUserId,
        this.userPreferences
      );
      this.showSuccess();
    } catch (err) {
      console.error('Error saving preferences:', err);
      this.error = 'Failed to save preferences.';
    } finally {
      this.isSaving = false;
    }
  }

  private showSuccess(): void {
    this.saveSuccess = true;
    setTimeout(() => this.saveSuccess = false, 2000);
  }

}
