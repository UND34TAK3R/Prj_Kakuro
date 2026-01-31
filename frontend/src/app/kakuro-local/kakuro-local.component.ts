import { Component } from '@angular/core';
import {CommonModule} from '@angular/common';
// Revision history:
//
// DEVELOPER DATE COMMENTS
// Kieu Cong Huy    2026-01-31  Created Kakuro local game components with difficulty and grid selection

@Component({
  selector: 'app-kakuro-local',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kakuro-local.component.html',
  styleUrl: './kakuro-local.component.css'
})
export class KakuroLocalComponent {
  time = '00:00';

  //going to use later on to create the table and generate number
  difficulties = ['Easy', 'Medium', 'Hard'];
  gridSizes = ['4x4', '6x6', '8x8', '9x11', '9x17'];

  // default setup
  selectedDifficulty = 'Easy';
  selectedGridSize = '4x4';


  onDifficultyChange(value: string) {
    this.selectedDifficulty = value;
  }


  onGridSizeChange(value: string) {
    this.selectedGridSize = value;
  }
}
