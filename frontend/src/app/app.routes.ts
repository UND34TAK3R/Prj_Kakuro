import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { KakuroLocalComponent } from './kakuro-local/kakuro-local.component';
import { GameConfigurationComponent } from './homepage/gameconfiguraton.component';
import { SocialHubComponent } from './social/social.component';
import { RankingComponent } from './ranking/ranking.component';
import {MatchmakingComponent} from './matchmaking/matchmaking.component';
import {KakuroMultiplayerComponent} from './kakuro-multiplayer/kakuro-multiplayer.component';
import { AccountPreferencesComponent } from './account-preferences/account-preferences.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'gameConfig', component: GameConfigurationComponent },
    { path: 'social', component: SocialHubComponent },
    { path: 'rankings', component: RankingComponent },
    { path: 'localGame', component: KakuroLocalComponent },
    { path: 'matchmaking', component: MatchmakingComponent },
    { path: 'multiplayerGame', component: KakuroMultiplayerComponent },
    { path: 'preferences', component: AccountPreferencesComponent },
    { path: 'reset-password', component: ResetPasswordComponent },
];
