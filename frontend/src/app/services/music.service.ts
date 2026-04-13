import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MusicService {
  private audio: HTMLAudioElement | null = null;
  private musicFiles: Record<string, string> = {
    lofi: 'assets/music/lofi.mp3',
    jazz: 'assets/music/jazz.mp3',
    nature: 'assets/music/nature.mp3',
    none: ''
  };

  playMusic(track: string): void {
    console.log('playMusic called with:', track);  // ← add this
    console.log('audio src will be:', this.musicFiles[track]);  // ← add this
    this.stopMusic();  // always stop current before starting new
    if (track === 'none' || !this.musicFiles[track]) {
      return;
    }

    this.audio = new Audio(this.musicFiles[track]);
    this.audio.loop = true;   // loop continuously
    this.audio.volume = 0.4;    // comfortable background volume
    this.audio.play().catch(err => {
      console.warn('Autoplay blocked:', err);
    });
  }

  stopMusic(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
  }

  // Adjust volume (0.0 to 1.0)
  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = Math.min(1, Math.max(0, volume));
    }
  }

  isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused;
  }

  getCurrentTrack(): string {
    if (!this.audio) return 'none';
    const current = this.audio.src;
    // Find which track key matches the current src
    return Object.keys(this.musicFiles).find(
      key => current.includes(this.musicFiles[key])
    ) ?? 'none';
  }
}
