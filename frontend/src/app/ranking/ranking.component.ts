import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../services/firebase.service';
import { Subscription } from 'rxjs';


//vision history:
//
// DEVELOPER          DATE                            COMMENTS
// Derrick Mangari 2026-03-15       Created the Leaderboard Component. Displays empty ranked rows
//                                  for 4x4, 6x6, and 8x8 Kakuro grids with Global / Friends scope
//                                  tabs. Ready to be wired to a Firebase leaderboard collection.

interface LeaderboardEntry {
  rank: number;
  uid: string;
  username: string;
  time: string;  // formatted "MM:SS"
}

interface Friend {
  id: string;
  uid: string;
  username: string;
  isOnline: boolean;
}


@Component({
  selector: 'app-ranking',
  imports: [CommonModule],
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.css'
})


export class RankingComponent implements OnInit, OnDestroy {
  private firebaseService = inject(FirebaseService);

  scope: 'global' | 'friends' = 'global';
  grid: '4x4' | '6x6' | '8x8' = '4x4';

  isLoading: boolean = false;
  error: string = '';
  currentUserId: string = '';

  leaderboardRows: LeaderboardEntry[] = [];
  private friendsMap = new Map<string, Friend>();

  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    // Get current user then load leaderboard — mirrors social.component.ts pattern
    const authSub = this.firebaseService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.loadFriendsMap();
      }
    });
    this.subscriptions.push(authSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  //Load friends into map first, then trigger leaderboard
  private loadFriendsMap(): void {
    const friendsSub = this.firebaseService
      .getFriends(this.currentUserId)
      .subscribe(friendEntries => {
        this.friendsMap.clear();

        for (const entry of friendEntries) {
          const friendId = entry.friendId ?? entry.id;

          // Fetch each friend's profile to get username
          const profileSub = this.firebaseService.getUser(friendId).subscribe(profile => {
            if (!profile) return;
            this.friendsMap.set(friendId, {
              id: friendId,
              uid: friendId,
              username: profile.username ?? 'Unknown',
              isOnline: false
            });
          });
          this.subscriptions.push(profileSub);
        }

        this.loadLeaderboard();
      });

    this.subscriptions.push(friendsSub);
  }

  private loadLeaderboard(): void {
    this.isLoading = true;
    this.error = '';

    const usersSub = this.firebaseService.getUsers().subscribe({
      next: (users) => {

        let filtered = users;
        if (this.scope === 'friends') {
          filtered = users.filter(u => this.friendsMap.has(u.id));
        }
        filtered = filtered.filter(u => u.pb?.[this.grid] !== null && u.pb?.[this.grid] !== undefined);

        filtered.sort((a, b) => a.pb[this.grid] - b.pb[this.grid]);

        this.leaderboardRows = filtered.map((u, index) => ({
          rank: index + 1,
          uid: u.id,
          username: u.username ?? 'Unknown',
          time: this.formatTime(u.pb[this.grid])
        }));

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading leaderboard:', err);
        this.error = 'Failed to load leaderboard.';
        this.isLoading = false;
      }
    });

    this.subscriptions.push(usersSub);
  }


  onScopeChange(scope: 'global' | 'friends'): void {
    this.scope = scope;
    this.loadLeaderboard();  // reload with new scope filter
  }

  onGridChange(grid: '4x4' | '6x6' | '8x8'): void {
    this.grid = grid;
    this.loadLeaderboard();  // reload with new grid filter
  }


  getRows(): LeaderboardEntry[] {
    return this.leaderboardRows;
  }

  getRankClass(rank: number): string {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return '';
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}


