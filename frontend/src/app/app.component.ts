import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {KakuroLocalComponent} from './kakuro-local/kakuro-local.component';
import {CommonModule, } from '@angular/common';
import {SidebarComponent} from './sidebar/sidebar.component';
import { FirebaseService } from './services/firebase.service';
import { ThemeService } from './services/theme.service';
import { MusicService } from './services/music.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit{
  title = 'Kakuro Game';

  // Routes where sidebar should not appear
  private noSidebarRoutes = ['/login', '/register', '', '/localGame'];
  private firebaseService = inject(FirebaseService)
  private themeService = inject(ThemeService);
  private musicService = inject(MusicService);

  constructor(private router: Router) {}

  showSidebar(): boolean {
    const currentUrl = this.router.url;
    return !this.noSidebarRoutes.includes(currentUrl);
  }

  private currentUid: string | null = null;

  ngOnInit(): void {
    this.firebaseService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUid = user.uid;
        this.firebaseService.setUserOnline(user.uid);
        this.themeService.loadThemeForUser(user.uid);
        this.loadMusicForUser(user.uid);
      }
    });
  }
  private loadMusicForUser(uid: string): void {
    this.firebaseService.getUserPreferences(uid).subscribe(data => {
      const track = data?.preferences?.backgroundMusic ?? 'none';
      this.musicService.playMusic(track);
    });
  }
  // Fires when the user closes the tab or navigates away
  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    if (this.currentUid) {
      this.firebaseService.setUserOffline(this.currentUid);
      this.musicService.stopMusic();
    }
  }

}
