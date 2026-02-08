import { Component } from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
// Revision history:
//
// DEVELOPER DATE COMMENTS
// Kieu Cong Huy    2026-01-31  Created Kakuro local game components with difficulty and grid selection
// Kieu Cong Huy    2026-02-07  generate grid based on size ex:4x4 (not auto generated random black space yet)
// Kieu Cong Huy    2026-02-07  Implemented ngModel so that it ensures the value is properly synced
// Kieu Cong Huy    2026-02-07  Added getter/setter for selectedGridSize to auto-regenerate grid on change


@Component({
  selector: 'app-kakuro-local',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './kakuro-local.component.html',
  styleUrl: './kakuro-local.component.css'
})
export class KakuroLocalComponent {
  time = '00:00';

  //going to use later on to create the table and generate number
  difficulties = ['Easy', 'Medium', 'Hard'];
  gridSizes = ['4x4', '6x6', '8x8', '9x11', '9x17'];

  // default setup
  private _selectedDifficulty = 'Easy'; // the underscored is for naming convention for private field when using get/set
  private _selectedGridSize = '4x4';

  //default row(because the default grid is 4x4 and that it always have 1 extra row/col)
  rows = 0;
  cols = 0;

  // Generate initial grid
  grid: any[][] = [];
  isGridReady = false;

  constructor() {
    this.onGridSizeChange(this._selectedGridSize);
    this.isGridReady = true;
  }

  // help keeping elements instead of destroying it all and recreating them (improve performance)
  trackByIndex(index: number): number {
    return index;
  }

  onGridSizeChange(value: string) {
    console.log('Setting grid size to:', value);
    this._selectedGridSize = value;
    this.parseGridSize(value);
    this.generateGrid();
  }


  //get/set will automatically triggers parseGridSize() and generateGrid() whenever selectedGridSize changes
  get selectedDifficulty(): string {
    return this._selectedDifficulty;
  }

  set selectedDifficulty(value: string) {
    this._selectedDifficulty = value;
    // add logic later on
  }

  get selectedGridSize(): string {
    return this._selectedGridSize;
  }

  set selectedGridSize(value: string) {
    this._selectedGridSize = value;
    this.parseGridSize(value);
    console.log('New grid:', this.rows - 1, 'x', this.cols - 1);
  }

  parseGridSize(size: string) {
    const [rowStr, colStr] = size.split('x');
    // Add 1 for the clue row/column
    this.rows = parseInt(rowStr) + 1;
    this.cols = parseInt(colStr) + 1;
  }

  generateGrid() {
    const currentGrid: any[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row = [];
      for (let j = 0; j < this.cols; j++) {
        row.push({
          value: '',
          isBlack: i === 0 || j === 0, // first col/row is always black
          row: i,
          col: j
        });
      }
      currentGrid.push(row);
    }
    this.grid = currentGrid;
    console.log('Generated grid:', this.grid.length, 'rows');
  }
}
