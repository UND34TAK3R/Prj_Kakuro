import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ranking',
  imports: [CommonModule],
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.css'
})
// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Derrick Mangari 2026-03-15       Created the Leaderboard Component. Displays empty ranked rows
//                                  for 4x4, 6x6, and 8x8 Kakuro grids with Global / Friends scope
//                                  tabs. Ready to be wired to a Firebase leaderboard collection.
export class RankingComponent {
  scope: 'global' | 'friends' = 'global';
  grid: '4x4' | '6x6' | '8x8' = '4x4';
 
  // Returns 10 placeholder rows — swap for real Firebase data later
  getRows(): number[] {
    return Array.from({ length: 10 }, (_, i) => i);
  }
 
  getRankClass(rank: number): string {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return '';
  }
}
 
