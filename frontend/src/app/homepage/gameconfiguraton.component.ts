import {Component, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';
import { Subscription } from 'rxjs';
import { Database, ref, onValue, off } from '@angular/fire/database';

interface Friend {
  id: string;
  username: string;
}

type InviteStatus = 'idle' | 'sending' | 'not-received' | 'received' | 'ready' | 'refused' | 'error';

@Component({
  selector: 'app-gameconfiguration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gameconfiguration.component.html',
  styleUrl: './gameconfiguration.component.css'
})



// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Derrick Mangari 2026-03-14       Created the Homepage Component
// Justin P.       2026-04-12       Added game to Homepage Component
// Justin P.       2026-04-12       Added 1v1 friends
// Justin P.       2026-04-12       Changed homepage => GameConfiguration

export class GameConfigurationComponent {
  private router = inject(Router);
  private firebase = inject(FirebaseService);
  private database = inject(Database);

  // Game config
  selectedGameMode: "Singleplayer" | "Multiplayer" = "Singleplayer";
  selectedGridSize: "4x4" | "6x6" | "8x8" = "6x6";
  gameModes: Array<"Singleplayer" | "Multiplayer"> = ["Singleplayer", "Multiplayer"];
  gridSizes: Array<"4x4" | "6x6" | "8x8"> = ["4x4", "6x6", "8x8"];

  currentUserId = '';
  friends: Friend[] = [];
  selectedFriend: Friend | null = null;
  inviteStatus: InviteStatus = 'idle';
  currentInviteId = '';

  private subscriptions: Subscription[] = [];
  private inviteStatusUnsub?: () => void;
  private sessionUnsub?: () => void;

  ngOnInit(): void {
    const authSub = this.firebase.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.loadFriends();
      }
    });
    this.subscriptions.push(authSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.inviteStatusUnsub?.();
    this.sessionUnsub?.();
  }

  // C1
  selectGameMode(mode: "Singleplayer" | "Multiplayer"): void {
    this.selectedGameMode = mode;
  }

  // C2
  selectGridSize(size: "4x4" | "6x6" | "8x8"): void {
    this.selectedGridSize = size;
  }

  private loadFriends(): void {
    const friendsSub = this.firebase.getFriends(this.currentUserId).subscribe(entries => {
      const loaded: Friend[] = [];
      for (const entry of entries) {
        const friendId = entry.friendId ?? entry.id;
        const profileSub = this.firebase.getUser(friendId).subscribe(profile => {
          if (!profile) return;
          if (!loaded.find(f => f.id === friendId)) {
            loaded.push({ id: friendId, username: profile.username ?? profile.email ?? 'Unknown' });
          }
          this.friends = [...loaded];
        });
        this.subscriptions.push(profileSub);
      }
      if (entries.length === 0) this.friends = [];
    });
    this.subscriptions.push(friendsSub);
  }

  selectFriendToDuel(friend: Friend): void {
    if (this.selectedFriend?.id === friend.id) {
      this.selectedFriend = null;
      this.resetInviteState();
    } else {
      this.selectedFriend = friend;
      this.resetInviteState();
    }
  }

  // isd Send Duel Invitation: sendInvitation(friend, player, size)
  async sendDuelInvite(): Promise<void> {
    if (!this.selectedFriend || !this.currentUserId) return;
    this.inviteStatus    = 'sending';
    this.currentInviteId = '';
    this.inviteStatusUnsub?.();
    this.sessionUnsub?.();

    try {
      // 1.1 createDuelInvitation, 1.2 setReceiver, 1.3 setSender, 1.4 setGridSize => 1.4.1 setInvitationStatus("Pending"), 1.4.2 saveInvitation
      const inviteId = await this.firebase.sendDuelInvitation(
        this.currentUserId, this.selectedFriend.id, 'Multiplayer', this.selectedGridSize
      );
      this.currentInviteId = inviteId;
      this.inviteStatus    = 'not-received';
      this.listenForInviteStatus(inviteId);
    } catch {
      this.inviteStatus = 'error';
    }
  }

  private listenForInviteStatus(inviteId: string): void {
    // Green: receiver accepted — our playerSession is created
    const sessionRef = ref(this.database, `playerSessions/${this.currentUserId}`);
    onValue(sessionRef, (snap) => {
      if (snap.exists() && snap.val()?.sessionId) {
        this.inviteStatus = 'ready';
        const sessionId = snap.val().sessionId;
        setTimeout(() => {
          this.router.navigate(['/multiplayerGame'], { queryParams: { sessionId } });
        }, 2500);
      }
    });
    this.sessionUnsub = () => off(sessionRef);

    // Red (refused): receiver refused
    const refusedRef = ref(this.database, `inviteRefused/${this.currentUserId}/${inviteId}`);
    onValue(refusedRef, (snap) => {
      if (snap.exists()) this.inviteStatus = 'refused';
    });
    this.inviteStatusUnsub = () => off(refusedRef);

    // Yellow after ~4 s: invite seen but no action yet
    setTimeout(() => {
      if (this.inviteStatus === 'not-received') this.inviteStatus = 'received';
    }, 4000);
  }

  resetInviteState(): void {
    this.inviteStatus = 'idle';
    this.currentInviteId = '';
    this.inviteStatusUnsub?.();
    this.sessionUnsub?.();
    this.inviteStatusUnsub = undefined;
    this.sessionUnsub = undefined;
  }

  get inviteStatusLabel(): string {
    switch (this.inviteStatus) {
      case 'sending': return 'Sending invite…';
      case 'not-received': return 'Invite sent — waiting for response';
      case 'received': return 'Invite received — awaiting decision';
      case 'ready': return 'Accepted! Starting game…';
      case 'refused': return 'Invite was declined.';
      case 'error': return 'Failed to send invite. Please try again.';
      default: return '';
    }
  }

  get inviteStatusColor(): 'red' | 'yellow' | 'green' | '' {
    switch (this.inviteStatus) {
      case 'not-received': return 'red';
      case 'received': return 'yellow';
      case 'ready': return 'green';
      case 'refused': return 'red';
      case 'error': return 'red';
      default: return '';
    }
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
