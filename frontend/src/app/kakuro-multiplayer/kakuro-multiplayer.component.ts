import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';
import {
  Firestore,
  doc,
  onSnapshot,
  updateDoc,
  collection,
  addDoc,
  getDoc
} from '@angular/fire/firestore';

// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Justin P.  2026-04-12   Created KakuroMultiplayerComponent: real-time two-player Kakuro game
//                               using an existing GameSession created by MatchmakingComponent or
//                               SocialComponent (duel invite). Implements Pause, Resume, Quit Game
//                               (isd Pause Game, isd Resume Game, isd Quit Game diagrams).

type CellType = 'empty' | 'clue' | 'playable';

interface Cell {
  type: CellType;
  row: number;
  col: number;
  value?: number;
  solution?: number;
  clueDown?: number;
  clueAcross?: number;
  isFixed?: boolean;
  isBlack?: boolean;
  isClue?: boolean;
}

@Component({
  selector: 'app-kakuro-multiplayer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kakuro-multiplayer.component.html',
  styleUrl: './kakuro-multiplayer.component.css'
})
export class KakuroMultiplayerComponent implements OnInit, OnDestroy {
  private firebase= inject(FirebaseService);
  private firestore = inject(Firestore);
  router = inject(Router);
  private route = inject(ActivatedRoute);

  // ─── Session info ────────────────────────────────────────────
  sessionId = '';
  currentUid= '';
  player1: { id: string; username: string } = { id: '', username: '' };
  player2: { id: string; username: string } = { id: '', username: '' };
  gridSize = '6x6';
  gameMode = 'Multiplayer';

  // ─── Game state ──────────────────────────────────────────────
  sessionState: 'active' | 'paused' | 'finished' = 'active';
  grid: Cell[][] = [];
  isGridReady = false;
  isLoading = true;
  isGameComplete = false;
  opponentLeft = false;
  error = '';

  // ─── Timer ───────────────────────────────────────────────────
  time = '00:00';
  private timerInterval?: any;
  private startTime?: Date;
  private pausedElapsed = 0; // ms elapsed before most recent pause

  // ─── Firestore listeners ─────────────────────────────────────
  private sessionUnsub?:  () => void;
  private gameEndUnsub?:  () => void;
  private kakuroGameId  = '';

  // ─── Puzzle engine (shared with KakuroLocalComponent) ────────
  private currentSolution: Cell[][] = [];

  // =========================================================
  ngOnInit(): void {
    this.sessionId = this.route.snapshot.queryParams['sessionId'] ?? '';
    if (!this.sessionId) {
      this.error = 'No session ID provided.';
      this.isLoading = false;
      return;
    }

    this.firebase.currentUser$.subscribe(user => {
      if (user) {
        this.currentUid = user.uid;
        this.loadSession();
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // ─── Load session and bootstrap puzzle ───────────────────────
  private async loadSession(): Promise<void> {
    const sessionRef = doc(this.firestore, `gameSessions/${this.sessionId}`);
    const snap = await getDoc(sessionRef);

    if (!snap.exists()) {
      this.error = 'Game session not found.';
      this.isLoading = false;
      return;
    }

    const data = snap.data();
    this.player1 = data['player1'];
    this.player2 = data['player2'];
    this.gridSize = data['gridSize'] ?? '6x6';
    this.gameMode = data['gameMode'] ?? 'Multiplayer';
    this.kakuroGameId = data['kakuroGameId'] ?? '';
    this.sessionState = data['state'] ?? 'active';

    // Generate the puzzle grid (same seed-based approach as local game)
    this.generateAndStorePuzzle();

    // Listen for live session state changes (pause/resume by other player)
    this.sessionUnsub = onSnapshot(sessionRef, (s) => {
      if (!s.exists()) return;
      const newState = s.data()['state'];
      if (newState !== this.sessionState) {
        this.sessionState = newState;
        if (newState === 'active') {
          this.resumeTimer();
        } else if (newState === 'paused') {
          this.pauseTimer();
        }
      }
    });

    // Listen for the other player quitting
    this.gameEndUnsub = this.firebase.listenForGameEnd(this.sessionId, () => {
      this.opponentLeft = true;
      this.sessionState = 'finished';
      this.stopTimer();
    });

    this.isLoading = false;
    this.startTimer();
  }

  // ─── Puzzle generation (ported from KakuroLocalComponent) ────
  private generateAndStorePuzzle(): void {
    const [r, c] = this.gridSize.split('x').map(Number);
    const puzzle  = this.generateKakuroPuzzle(r, c);
    this.grid     = puzzle;
    this.isGridReady = true;
  }

  generateKakuroPuzzle(rows: number, cols: number): Cell[][] {
    if (rows < 4) rows = 4;
    if (cols < 4) cols = 4;

    const grid: Cell[][] = [];
    for (let row = 0; row < rows; row++) {
      grid[row] = [];
      for (let col = 0; col < cols; col++) {
        grid[row][col] = { type: 'empty', row, col, isBlack: false, isClue: false };
      }
    }

    const isLarge = rows * cols > 80;
    const freq    = isLarge ? 2 : 3;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (row === 0 || col === 0) {
          grid[row][col].type = 'clue'; grid[row][col].isBlack = true; grid[row][col].isClue = true;
        } else if ((row + col) % freq === 0) {
          if (isLarge || Math.random() > 0.5) {
            grid[row][col].type = 'clue'; grid[row][col].isBlack = true; grid[row][col].isClue = true;
          } else {
            grid[row][col].type = 'playable';
          }
        } else {
          grid[row][col].type = 'playable';
        }
      }
    }

    if (isLarge) {
      this.fillGridSimple(grid, rows, cols);
    } else {
      const ok = this.solvePuzzle(grid, 2000);
      if (!ok) return this.generateSimplePuzzle(rows, cols);
    }

    this.calculateClues(grid);

    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const cell = grid[row][col];
        if (cell.type === 'playable') { cell.value = undefined; cell.isFixed = false; }
      }

    return grid;
  }

  private generateSimplePuzzle(rows: number, cols: number): Cell[][] {
    const grid: Cell[][] = [];
    for (let row = 0; row < rows; row++) {
      grid[row] = [];
      for (let col = 0; col < cols; col++) {
        if (row === 0 && col === 0)  grid[row][col] = { type: 'empty', row, col, isBlack: true,  isClue: false };
        else if (row === 0 || col === 0) grid[row][col] = { type: 'clue', row, col, isBlack: true,  isClue: true  };
        else                         grid[row][col] = { type: 'playable', row, col, isBlack: false, isClue: false };
      }
    }
    for (let row = 1; row < rows; row++)
      for (let col = 1; col < cols; col++)
        grid[row][col].solution = ((row + col - 1) % 9) + 1;

    this.calculateClues(grid);
    for (let row = 1; row < rows; row++)
      for (let col = 1; col < cols; col++) { grid[row][col].value = undefined; grid[row][col].isFixed = false; }

    return grid;
  }

  private solvePuzzle(grid: Cell[][], timeout: number): boolean {
    const cells = grid.flat().filter(c => c.type === 'playable');
    return this.backtrack(grid, cells, 0, Date.now(), timeout);
  }

  private backtrack(grid: Cell[][], cells: Cell[], idx: number, t0: number, timeout: number): boolean {
    if (idx % 100 === 0 && Date.now() - t0 > timeout) return false;
    if (idx === cells.length) return true;
    const cell = cells[idx];
    const used = new Set([...this.usedInRow(grid, cell.row, cell.col), ...this.usedInCol(grid, cell.row, cell.col)]);
    const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
    for (const n of nums) {
      if (!used.has(n)) {
        cell.solution = n;
        if (this.backtrack(grid, cells, idx + 1, t0, timeout)) return true;
        cell.solution = undefined;
      }
    }
    return false;
  }

  private usedInRow(grid: Cell[][], row: number, beforeCol: number): Set<number> {
    const s = new Set<number>();
    for (let c = beforeCol - 1; c >= 0; c--) {
      if (grid[row][c].type !== 'playable') break;
      if (grid[row][c].solution !== undefined) s.add(grid[row][c].solution!);
    }
    return s;
  }

  private usedInCol(grid: Cell[][], beforeRow: number, col: number): Set<number> {
    const s = new Set<number>();
    for (let r = beforeRow - 1; r >= 0; r--) {
      if (grid[r][col].type !== 'playable') break;
      if (grid[r][col].solution !== undefined) s.add(grid[r][col].solution!);
    }
    return s;
  }

  private fillGridSimple(grid: Cell[][], rows: number, cols: number): void {
    let n = 1;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c].type === 'playable') { grid[r][c].solution = ((r * 3 + c * 2 + n++) % 9) + 1; }
  }

  private calculateClues(grid: Cell[][]): void {
    const size = grid.length;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const cell = grid[row][col];
        if (cell.type !== 'clue') continue;

        let aSum = 0, aCount = 0;
        for (let c = col + 1; c < grid[row].length && grid[row][c].type === 'playable'; c++) { aSum += grid[row][c].solution ?? 0; aCount++; }
        if (aCount > 0) cell.clueAcross = aSum;

        let dSum = 0, dCount = 0;
        for (let r = row + 1; r < size && grid[r][col].type === 'playable'; r++) { dSum += grid[r][col].solution ?? 0; dCount++; }
        if (dCount > 0) cell.clueDown = dSum;
      }
    }
  }

  // ─── Cell interaction ────────────────────────────────────────
  onCellChange(cell: Cell): void {
    if (cell.type !== 'playable' || cell.isFixed || this.sessionState !== 'active') return;
    if (cell.value !== undefined) {
      const v = Number(cell.value);
      if (isNaN(v) || v < 1 || v > 9) { cell.value = undefined; return; }
      cell.value = v;
    }
    this.checkCompletion();
  }

  isCellCorrect(cell: Cell): boolean {
    return cell.type === 'playable' && cell.value !== undefined && cell.value === cell.solution;
  }

  private checkCompletion(): void {
    const complete = this.grid.every(row =>
      row.every(cell => cell.type !== 'playable' || cell.value === cell.solution)
    );
    if (complete && !this.isGameComplete) {
      this.isGameComplete = true;
      this.sessionState   = 'finished';
      this.stopTimer();
    }
  }

  trackByIndex(i: number): number { return i; }

  // Pause Game
  async pauseGame(): Promise<void> {
    if (this.sessionState !== 'active') return;
    try {
      await this.firebase.pauseGame(this.sessionId);
      // sessionState will be updated by the live listener
    } catch (err) {
      console.error('pauseGame error:', err);
    }
  }

  // Resume Game
  async resumeGame(): Promise<void> {
    if (this.sessionState !== 'paused') return;
    try {
      await this.firebase.resumeGame(this.sessionId);
    } catch (err) {
      console.error('resumeGame error:', err);
    }
  }

  // Quit Game
  async quitGame(): Promise<void> {
    try {
      await this.firebase.quitGame(this.sessionId, this.currentUid, true);
      this.cleanup();
      this.router.navigate(['/homepage']);
    } catch (err) {
      console.error('quitGame error:', err);
      this.router.navigate(['/homepage']);
    }
  }

  // Timer
  private startTimer(): void {
    this.stopTimer();
    this.startTime = new Date(Date.now() - this.pausedElapsed);
    this.timerInterval = setInterval(() => this.updateTimer(), 1000);
  }

  // Pause Timer
  private pauseTimer(): void {
    if (this.startTime) this.pausedElapsed = Date.now() - this.startTime.getTime();
    this.stopTimer();
  }

  // Resume Timer
  private resumeTimer(): void {
    this.startTimer();
  }

  // Stop Timer
  private stopTimer(): void {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = undefined; }
  }

  // Update Timer
  private updateTimer(): void {
    if (!this.startTime) return;
    const diff = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    this.time = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  get isPlayer1(): boolean { return this.currentUid === this.player1.id; }
  get opponentName(): string {
    return this.isPlayer1 ? this.player2.username : this.player1.username;
  }
  get myName(): string {
    return this.isPlayer1 ? this.player1.username : this.player2.username;
  }

  private cleanup(): void {
    this.stopTimer();
    if (this.sessionUnsub) this.sessionUnsub();
    if (this.gameEndUnsub) this.gameEndUnsub();
  }
}
