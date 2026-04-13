import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';

@Component({
  selector: "app-matchmaking",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./matchmaking.component.html",
  styleUrl: "matchmaking.component.css"
})
export class MatchmakingComponent implements OnInit, OnDestroy {
  private firebase = inject(FirebaseService);
  private router = inject(Router)
  private route = inject(ActivatedRoute)

  currentUserId = "";
  gameMode = "Multiplayer";
  gridSize = "6x6";

  opponentFound = false
  searching = false;
  matchmakingInProgress = false // based on OpponentFound
  error = "";
  matchFoundCountdown: number | null = null;
  private countdownInterval?: any;

  private matchUnsubscribe?: () => void;
  private pollInterval?: any;

  ngOnInit(): void {
    this.gameMode = this.route.snapshot.queryParams["gameMode"] ?? "Multiplayer";
    this.gridSize = this.route.snapshot.queryParams["gridSize"] ?? "6x6";

    this.firebase.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.findOpponent();
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // C22: findOpponent(userId)
  async findOpponent(): Promise<void> {
    if (!this.currentUserId) return;
    this.error = "";
    this.searching = true;

    try {
      const opponentId = await this.firebase.findCompatibleOpponent(
        this.currentUserId, this.gameMode, this.gridSize
      );

      if (opponentId) {
        // Create gameSession and KakuroGame instance
        this.opponentFound = true;
        const sessionId = await this.firebase.createGameSession(
          this.currentUserId, opponentId, this.gameMode, this.gridSize
        );

        // Show countdown before navigating to multiplayer game
        this.startMatchFoundCountdown(sessionId);
      } else {
        await this.firebase.joinMatchmakingQueue(
          this.currentUserId, this.gameMode, this.gridSize
        );
        this.matchmakingInProgress = true;
        this.searching = false;
        this.listenForMatch(); // Listen until a match is made
      }
    } catch (err: any) {
      this.error = "Matchmaking error. Please try again.";
      this.searching = false;
    }
  }

  private listenForMatch(): void {
    this.matchUnsubscribe = this.firebase.listenForMatch(this.currentUserId, (sessionId) => {
      if (sessionId) {
        this.opponentFound = true;
        this.matchmakingInProgress = false;
        this.startMatchFoundCountdown(sessionId);
      }
    });
  }

  private startMatchFoundCountdown(sessionId: string): void {
    this.matchFoundCountdown = 3;
    this.countdownInterval = setInterval(() => {
      if (this.matchFoundCountdown !== null && this.matchFoundCountdown > 1) {
        this.matchFoundCountdown--;
      } else {
        clearInterval(this.countdownInterval);
        this.router.navigate(["/multiplayerGame"], { queryParams: { sessionId } });
      }
    }, 1000);
  }

  async cancelSearch(): Promise<void> {
    await this.firebase.leaveMatchmakingQueue(this.currentUserId);
    this.cleanup();
    await this.router.navigate(["/gameConfig"])
  }

  private cleanup(): void {
    if (this.matchUnsubscribe) this.matchUnsubscribe();
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }
}
