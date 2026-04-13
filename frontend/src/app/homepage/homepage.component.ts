import {Component, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.css'
})

// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Derrick Mangari 2026-03-14       Created the Homepage Component
// Justin P.       2026-04-12       Added game to Homepage Component

export class HomepageComponent {
  private router = inject(Router);

  // Game config
  selectedGameMode: "Singleplayer" | "Multiplayer" = "Singleplayer";
  selectedGridSize: "4x4" | "6x6" | "8x8" = "6x6";

  gameModes: Array<"Singleplayer" | "Multiplayer"> = ["Singleplayer", "Multiplayer"];
  gridSizes: Array<"4x4" | "6x6" | "8x8"> = ["4x4", "6x6", "8x8"];

  // C1
  selectGameMode(mode: "Singleplayer" | "Multiplayer"): void {
    this.selectedGameMode = mode;
  }

  // C2
  selectGridSize(size: "4x4" | "6x6" | "8x8"): void {
    this.selectedGridSize = size;
  }

  playGame(): void {
    if (this.selectedGameMode === "Singleplayer") {
      this.router.navigate(["/localGame"], {
        queryParams: { gridSize: this.selectedGridSize }
      });
    } else {
      this.router.navigate(["/matchmaking"], {
        queryParams: {
          gameMode: "Multiplayer",
          gridSize: this.selectedGridSize
        }
      });
    }
  }
}
