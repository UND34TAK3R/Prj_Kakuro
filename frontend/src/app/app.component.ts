import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {KakuroLocalComponent} from './kakuro-local/kakuro-local.component';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, KakuroLocalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'frontend';
}
