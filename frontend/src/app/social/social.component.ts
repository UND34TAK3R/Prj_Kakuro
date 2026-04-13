import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';
import { Subscription } from 'rxjs';


interface Friend {
  id: string;
  uid: string;
  username: string;
  isOnline: boolean;
}

interface FriendRequest {
  uid: string; // sender id
  username: string;
}

interface SearchUser {
  uid: string;
  username: string;
  isOnline: boolean;
  requestSent: boolean;
}

interface DuelInvite {
  inviteId: string;
  senderUid: string;
  senderUsername: string;
  grid: string;
  gameMode: string;
  accepting?: boolean;
  refusing?: boolean;
}

@Component({
  selector: 'app-social',
  imports: [CommonModule, FormsModule],
  templateUrl: './social.component.html',
  styleUrl: './social.component.css'
})

export class SocialHubComponent implements OnInit, OnDestroy {
  private firebaseService = inject(FirebaseService);
  private router = inject(Router);

  currentUserId: string = '';

  onlineFriends:  Friend[] = [];
  offlineFriends: Friend[] = [];
  pendingRequests: FriendRequest[] = [];

  // Duel notifications
  duelInvites: DuelInvite[] = [];

  searchQuery:   string       = '';
  searchLoading: boolean      = false;
  searchResults: SearchUser[] = [];

  private subscriptions: Subscription[] = [];
  private statusListeners: (() => void)[] = [];
  private friendRequestUnsubscribe: (() => void) | null = null;
  private duelInviteUnsubscribe: (() => void) | null = null;
  private searchDebounce: any;

  private friendsMap = new Map<string, Friend>();

  ngOnInit(): void {
    const authSub = this.firebaseService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.loadFriends();
        this.listenForRequests();
        this.listenForDuelInvites();
      }
    });
    this.subscriptions.push(authSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.statusListeners.forEach(unsub => unsub());
    if (this.friendRequestUnsubscribe) this.friendRequestUnsubscribe();
    if (this.duelInviteUnsubscribe) this.duelInviteUnsubscribe();
  }

  // ─── Friends ────────────────────────────────────────────────

  private loadFriends(): void {
    const friendsSub = this.firebaseService.getFriends(this.currentUserId).subscribe((friendEntries) => {
      this.statusListeners.forEach(unsub => unsub());
      this.statusListeners = [];
      this.friendsMap.clear();

      for (const entry of friendEntries) {
        const friendId = entry.friendId ?? entry.id;
        const profileSub = this.firebaseService.getUser(friendId).subscribe(profile => {
          if (!profile) return;
          const friend: Friend = {
            id: friendId, uid: friendId,
            username: profile.username ?? profile.email ?? 'Unknown',
            isOnline: false,
          };
          this.friendsMap.set(friendId, friend);
          this.firebaseService.listenToUserStatus(friendId, (statusData) => {
            friend.isOnline = statusData?.state === 'online';
            this.bucketFriends();
          });
        });
        this.subscriptions.push(profileSub);
      }
    });
    this.subscriptions.push(friendsSub);
  }

  private bucketFriends(): void {
    const all = Array.from(this.friendsMap.values());
    this.onlineFriends  = all.filter(f => f.isOnline);
    this.offlineFriends = all.filter(f => !f.isOnline);
  }

  // ─── Friend Requests ────────────────────────────────────────

  private listenForRequests(): void {
    this.firebaseService.listenForFriendRequests(this.currentUserId, async (requestsData) => {
      if (!requestsData) { this.pendingRequests = []; return; }
      const requests: FriendRequest[] = [];
      for (const [senderUid, data] of Object.entries(requestsData) as [string, any][]) {
        if (data?.status !== 'pending') continue;
        const profileSub = this.firebaseService.getUser(senderUid).subscribe(profile => {
          if (!profile) return;
          if (!requests.some(r => r.uid === senderUid)) {
            requests.push({ uid: senderUid, username: profile.username ?? profile.email ?? 'Unknown' });
          }
          this.pendingRequests = [...requests];
        });
        this.subscriptions.push(profileSub);
      }
      if (Object.keys(requestsData).length === 0) this.pendingRequests = [];
    });
  }

  async acceptRequest(req: FriendRequest): Promise<void> {
    try {
      await this.firebaseService.acceptFriendRequest(req.uid, this.currentUserId);
      this.pendingRequests = this.pendingRequests.filter(r => r.uid !== req.uid);
      this.loadFriends();
    } catch (err) { console.error('Error accepting friend request:', err); }
  }

  async declineRequest(req: FriendRequest): Promise<void> {
    try {
      await this.firebaseService.denyFriendRequest(req.uid, this.currentUserId);
      this.pendingRequests = this.pendingRequests.filter(r => r.uid !== req.uid);
    } catch (err) { console.error('Error declining friend request:', err); }
  }

  // ─── Duel Invite Notifications ──────────────────────────────

  private listenForDuelInvites(): void {
    this.duelInviteUnsubscribe = this.firebaseService.listenForDuelInvites(
      this.currentUserId,
      async (invitesData) => {
        if (!invitesData) { this.duelInvites = []; return; }

        const invites: DuelInvite[] = [];
        for (const [inviteId, data] of Object.entries(invitesData) as [string, any][]) {
          const senderUid = data?.sender;
          if (!senderUid) continue;
          const profileSub = this.firebaseService.getUser(senderUid).subscribe(profile => {
            if (!profile) return;
            if (!invites.some(i => i.inviteId === inviteId)) {
              invites.push({
                inviteId,
                senderUid,
                senderUsername: profile.username ?? profile.email ?? 'Unknown',
                grid: data.grid ?? '6x6',
                gameMode: data.gameMode ?? 'Multiplayer',
              });
            }
            this.duelInvites = [...invites];
          });
          this.subscriptions.push(profileSub);
        }
        if (Object.keys(invitesData).length === 0) this.duelInvites = [];
      }
    );
  }

  // isd Accept Invitation
  async acceptDuel(invite: DuelInvite): Promise<void> {
    invite.accepting = true;
    try {
      const sessionId = await this.firebaseService.acceptDuelInvitation(invite.inviteId, this.currentUserId);
      this.duelInvites = this.duelInvites.filter(i => i.inviteId !== invite.inviteId);
      // Small delay so user sees the accept action, then navigate
      setTimeout(() => {
        this.router.navigate(['/multiplayerGame'], { queryParams: { sessionId } });
      }, 1500);
    } catch (err) {
      invite.accepting = false;
      console.error('Error accepting duel:', err);
    }
  }

  // isd Refuse Invitation (MISMATCH FROM DIAGRAM, BUT INPUT REQUIRED OR ELSE IT DOESN'T WORK)
  async refuseDuel(invite: DuelInvite): Promise<void> {
    invite.refusing = true;
    try {
      await this.firebaseService.refuseDuelInvitation(invite.inviteId, this.currentUserId);
      this.duelInvites = this.duelInvites.filter(i => i.inviteId !== invite.inviteId);
    } catch (err) {
      invite.refusing = false;
      console.error('Error refusing duel:', err);
    }
  }

  // ─── Search ─────────────────────────────────────────────────

  onSearch(): void {
    clearTimeout(this.searchDebounce);
    if (!this.searchQuery.trim()) { this.searchResults = []; this.searchLoading = false; return; }
    this.searchLoading = true;
    this.searchDebounce = setTimeout(() => this.runSearch(), 400);
  }

  private runSearch(): void {
    const allUsersSub = this.firebaseService.getUsers().subscribe(users => {
      const query = this.searchQuery.trim().toLowerCase();
      const results: SearchUser[] = users
        .filter(u => u.id !== this.currentUserId && u.username?.toLowerCase().includes(query) && !this.friendsMap.has(u.id))
        .map(u => ({ uid: u.id, username: u.username ?? u.email ?? 'Unknown', isOnline: false, requestSent: false }));
      results.forEach(user => {
        this.firebaseService.listenToUserStatus(user.uid, (statusData) => { user.isOnline = statusData?.state === 'online'; });
      });
      this.searchResults = results;
      this.searchLoading = false;
    });
    setTimeout(() => allUsersSub.unsubscribe(), 5000);
  }

  clearSearch(): void { this.searchQuery = ''; this.searchResults = []; this.searchLoading = false; }

  async sendRequest(user: SearchUser): Promise<void> {
    if (user.requestSent) return;
    try {
      await this.firebaseService.sendFriendRequest(user.uid, this.currentUserId);
      user.requestSent = true;
    } catch (err) { console.error('Error sending friend request:', err); }
  }
}
