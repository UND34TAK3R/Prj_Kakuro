import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Kieu Cong Huy    2026-01-31  Created Kakuro local game components with difficulty and grid selection
// Kieu Cong Huy    2026-02-07  generate grid based on size ex:4x4 (not auto generated random black space yet)
// Kieu Cong Huy    2026-02-07  Added getter/setter for selectedGridSize to auto-regenerate grid on change
// Kieu Cong Huy    2026-02-10  Integrated backtracking solver with timeout fallback for large grids
// Kieu Cong Huy    2026-02-10  Implemented dynamic clue calculation (across and down)
// Kieu Cong Huy    2026-02-11  Added game timer system with start/stop/reset logic
// Kieu Cong Huy    2026-02-11  Implemented puzzle completion validation and solution checking

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

interface KakuroGrid {
  grid: Cell[][];
  size: number;
}

@Component({
  selector: 'app-kakuro-local',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kakuro-local.component.html',
  styleUrl: './kakuro-local.component.css'
})
export class KakuroLocalComponent implements OnInit, OnDestroy {
  time = '00:00';
  private timerInterval?: any;
  private startTime?: Date;

  difficulties = ['Easy', 'Medium', 'Hard'];
  gridSizes = ['4x4', '6x6', '8x8'];

  private _selectedDifficulty = 'Easy';
  private _selectedGridSize = '4x4';

  grid: Cell[][] = [];
  isGameComplete = false;
  isGridReady = false;
  isLoading = false;

  private currentPuzzle?: KakuroGrid;

  constructor() {}

  ngOnInit() {
    // Don't start game automatically - let the page load first
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  // Getters and setters
  get selectedDifficulty(): string {
    return this._selectedDifficulty;
  }

  set selectedDifficulty(value: string) {
    this._selectedDifficulty = value;
  }

  get selectedGridSize(): string {
    return this._selectedGridSize;
  }

  set selectedGridSize(value: string) {
    this._selectedGridSize = value;
  }

  onGridSizeChange(value: string) {
    this._selectedGridSize = value;
  }

  // Track by function for performance
  trackByIndex(index: number): number {
    return index;
  }

  // Start a new game(because it created some issue when generating the grid on startup)
  startGame() {
    this.isLoading = true;

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const [rowStr, colStr] = this._selectedGridSize.split('x');
      const rows = parseInt(rowStr);
      const cols = parseInt(colStr);
      this.currentPuzzle = this.generateKakuroPuzzle(rows, cols);
      this.grid = this.currentPuzzle.grid;
      this.isGameComplete = false;
      this.isGridReady = true;
      this.isLoading = false;
      this.startTimer();
    }, 10);
  }

  // Reset current game
  resetGame() {
    if (this.currentPuzzle) {
      for (let row = 0; row < this.currentPuzzle.size; row++) {
        for (let col = 0; col < this.currentPuzzle.size; col++) {
          const cell = this.currentPuzzle.grid[row][col];
          if (cell.type === 'playable') {
            cell.value = undefined;
          }
        }
      }
      this.grid = this.currentPuzzle.grid;
      this.isGameComplete = false;
      this.startTimer();
    }
  }


  // Show solution(DEBUG WILL REMOVE LATER)
  showSolution() {
    if (!this.currentPuzzle) return;

    for (const row of this.currentPuzzle.grid) {
      for (const cell of row) {
        if (cell.type === 'playable') {
          cell.value = cell.solution;
        }
      }
    }
    this.isGameComplete = true;
    this.stopTimer();
  }

  // Handle cell changes
  onCellChange(cell: Cell) {
    if (cell.type !== 'playable' || cell.isFixed) return;

    // Validate input
    if (cell.value !== undefined) {
      const numValue = Number(cell.value);
      if (isNaN(numValue) || numValue < 1 || numValue > 9) {
        cell.value = undefined;
        return;
      }
      cell.value = numValue;
    }

    this.checkCompletion();
  }

  // Check if cell is correct
  isCellCorrect(cell: Cell): boolean {
    if (cell.type !== 'playable' || cell.value === undefined) return false;
    return cell.value === cell.solution;
  }

  // Check if puzzle is complete
  private checkCompletion() {
    if (!this.currentPuzzle) return;

    const isComplete = this.isPuzzleComplete(this.currentPuzzle.grid);
    if (isComplete && !this.isGameComplete) {
      this.isGameComplete = true;
      this.stopTimer();
    }
  }

  // Timer functions
  private startTimer() {
    this.stopTimer();
    this.startTime = new Date();
    this.timerInterval = setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  private updateTimer() {
    if (!this.startTime) return;
    const now = new Date();
    const diff = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    this.time = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  generateKakuroPuzzle(rows: number = 6, cols: number = 6): KakuroGrid {
    // Ensure minimum size of 4x4
    if (rows < 4) rows = 4;
    if (cols < 4) cols = 4;

    const grid: Cell[][] = [];

    // Create the grid with empty cells
    for (let row = 0; row < rows; row++) {
      grid[row] = [];
      for (let col = 0; col < cols; col++) {
        grid[row][col] = {
          type: 'empty',
          row,
          col,
          isBlack: false,
          isClue: false
        };
      }
    }

    // Create a simpler pattern for larger grids to improve performance
    const isLargeGrid = rows * cols > 80;
    const clueFrequency = isLargeGrid ? 2 : 3;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (row === 0 || col === 0) {
          grid[row][col].type = 'clue';
          grid[row][col].isBlack = true;
          grid[row][col].isClue = true;
        } else if ((row + col) % clueFrequency === 0) { // pattern to put clue cells
          // For large grids, use deterministic pattern instead of random
          if (isLargeGrid || Math.random() > 0.5) {
            grid[row][col].type = 'clue';
            grid[row][col].isBlack = true;
            grid[row][col].isClue = true;
          } else {
            grid[row][col].type = 'playable';
            grid[row][col].isBlack = false;
            grid[row][col].isClue = false;
          }
        } else {
          grid[row][col].type = 'playable';
          grid[row][col].isBlack = false;
          grid[row][col].isClue = false;
        }
      }
    }

    // Use faster solution generation for large grids
    if (isLargeGrid) {
      this.fillGridSimple(grid, rows, cols);
    } else {
      // Try backtracking with a timeout
      const startTime = Date.now();
      const solved = this.solvePuzzle(grid, 2000); // 2 second timeout

      if (!solved || Date.now() - startTime > 2000) {
        // Fallback to simple generation if solving takes too long
        return this.generateSimplePuzzle(rows, cols);
      }
    }

    // Calculate the clues based on the solution
    this.calculateClues(grid);

    // Clear all user values
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = grid[row][col];
        if (cell.type === 'playable') {
          cell.value = undefined;
          cell.isFixed = false;
        }
      }
    }

    return { grid, size: Math.max(rows, cols) };
  }
  //guarantee work but less variety
  private generateSimplePuzzle(rows: number, cols: number): KakuroGrid {
    const grid: Cell[][] = [];

    for (let row = 0; row < rows; row++) {
      grid[row] = [];
      for (let col = 0; col < cols; col++) {
        if (row === 0 && col === 0) {
          grid[row][col] = { type: 'empty', row, col, isBlack: true, isClue: false };
        } else if (row === 0 || col === 0) {
          grid[row][col] = { type: 'clue', row, col, isBlack: true, isClue: true };
        } else {
          grid[row][col] = { type: 'playable', row, col, isBlack: false, isClue: false };
        }
      }
    }

    // Fill with valid numbers
    for (let row = 1; row < rows; row++) {
      for (let col = 1; col < cols; col++) {
        grid[row][col].solution = ((row + col - 1) % 9) + 1;
      }
    }

    this.calculateClues(grid);

    // Clear user values
    for (let row = 1; row < rows; row++) {
      for (let col = 1; col < cols; col++) {
        const cell = grid[row][col];
        cell.value = undefined;
        cell.isFixed = false;
      }
    }

    return { grid, size: Math.max(rows, cols) };
  }


  private solvePuzzle(grid: Cell[][], timeoutMs: number): boolean {
    const playableCells = grid.flat().filter(cell => cell.type === 'playable');
    const startTime = Date.now();
    return this.backtrack(grid, playableCells, 0, startTime, timeoutMs);
  }

  private fillGridSimple(grid: Cell[][], rows: number, cols: number): void {
    // Fast deterministic filling for large grids
    let counter = 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col].type === 'playable') {
          // Use a pattern that varies but stays within 1-9
          grid[row][col].solution = ((row * 3 + col * 2 + counter) % 9) + 1;
          counter++;
        }
      }
    }
  }

  private backtrack(grid: Cell[][], cells: Cell[], index: number, startTime: number, timeoutMs: number): boolean {
    // Check timeout every 100 iterations
    if (index % 100 === 0 && Date.now() - startTime > timeoutMs) {
      return false;
    }

    if (index === cells.length) {
      return true;
    }

    const cell = cells[index];
    const usedInRow = this.getUsedNumbersInRow(grid, cell.row, cell.col);
    const usedInCol = this.getUsedNumbersInColumn(grid, cell.row, cell.col);
    const used = new Set([...usedInRow, ...usedInCol]);

    // Randomize order to get different puzzles
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);

    for (const num of numbers) {
      if (!used.has(num)) {
        cell.solution = num;
        if (this.backtrack(grid, cells, index + 1, startTime, timeoutMs)) {
          return true;
        }
        cell.solution = undefined;
      }
    }

    return false;
  }

  private getUsedNumbersInRow(grid: Cell[][], row: number, beforeCol: number): Set<number> {
    const used = new Set<number>();
    for (let col = beforeCol - 1; col >= 0; col--) {
      const cell = grid[row][col];
      if (cell.type === 'clue' || cell.type === 'empty') break;
      if (cell.solution !== undefined) {
        used.add(cell.solution);
      }
    }
    return used;
  }

  private getUsedNumbersInColumn(grid: Cell[][], beforeRow: number, col: number): Set<number> {
    const used = new Set<number>();
    for (let row = beforeRow - 1; row >= 0; row--) {
      const cell = grid[row][col];
      if (cell.type === 'clue' || cell.type === 'empty') break;
      if (cell.solution !== undefined) {
        used.add(cell.solution);
      }
    }
    return used;
  }

  private calculateClues(grid: Cell[][]) {
    const size = grid.length;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = grid[row][col];
        if (cell.type === 'clue') {
          // Calculate across clue
          let acrossSum = 0;
          let acrossCount = 0;
          for (let c = col + 1; c < size && grid[row][c].type === 'playable'; c++) {
            acrossSum += grid[row][c].solution || 0;
            acrossCount++;
          }
          if (acrossCount > 0) {
            cell.clueAcross = acrossSum;
          }

          // Calculate down clue
          let downSum = 0;
          let downCount = 0;
          for (let r = row + 1; r < size && grid[r][col].type === 'playable'; r++) {
            downSum += grid[r][col].solution || 0;
            downCount++;
          }
          if (downCount > 0) {
            cell.clueDown = downSum;
          }
        }
      }
    }
  }

  private isPuzzleComplete(grid: Cell[][]): boolean {
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'playable' && cell.value !== cell.solution) {
          return false;
        }
      }
    }
    return true;
  }

}
