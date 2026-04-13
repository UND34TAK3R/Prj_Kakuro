import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'register', renderMode: RenderMode.Client },
  { path: 'homepage', renderMode: RenderMode.Client },
  { path: 'social', renderMode: RenderMode.Client },
  { path: 'rankings', renderMode: RenderMode.Client },
  { path: 'matchmaking', renderMode: RenderMode.Client },
  { path: 'multiplayerGame', renderMode: RenderMode.Client },
  { path: 'localGame', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client },
];
