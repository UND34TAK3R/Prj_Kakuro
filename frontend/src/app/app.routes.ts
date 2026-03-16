import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { KakuroLocalComponent } from './kakuro-local/kakuro-local.component';
import { HomepageComponent } from './homepage/homepage.component';
import { SocialHubComponent } from './social/social.component';
import { RankingComponent } from './ranking/ranking.component';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'homepage', component: HomepageComponent },
    { path: 'social', component: SocialHubComponent },
    { path: 'rankings', component: RankingComponent },
    { path: 'localGame', component: KakuroLocalComponent }
];
