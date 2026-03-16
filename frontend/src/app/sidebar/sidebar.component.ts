import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})


// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Derrick Mangari 2026-03-13       Created the Sidebar Component, the template and styles 
export class SidebarComponent {

  private firebase = inject(FirebaseService);
   private router = inject(Router);

  async logout() {
    // Implement logout logic here, e.g., call a service to handle authentication state
    await this.firebase.logout();
    this.router.navigate(['/login']);
  }

  navItems = [
      {
        label: 'Play Game',
        route: '/homepage',
      },
      {
        label: 'Social Hub',
        route: '/social',
      },
      {
        label: 'Leaderboard',
        route: '/rankings',
      }
    ];
}

