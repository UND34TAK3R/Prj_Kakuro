import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

@Component({
  selector: 'app-social',
  imports: [CommonModule, FormsModule],
  templateUrl: './social.component.html',
  styleUrl: './social.component.css'
})

export class SocialHubComponent implements OnInit, OnDestroy {
  private firebaseService = inject(FirebaseService);
 
  currentUserId: string = '';
 
  onlineFriends:  Friend[] = [];
  offlineFriends: Friend[] = [];
  pendingRequests: FriendRequest[] = [];
 
  searchQuery:   string      = '';
  searchLoading: boolean     = false;
  searchResults: SearchUser[] = [];
 
  private subscriptions: Subscription[] = [];
  private statusListeners: (() => void)[] = []; // store unsubscribe callbacks
  private friendRequestUnsubscribe: (() => void) | null = null;
  private searchDebounce: any;
 
  ngOnInit(): void {
    // Get current user then bootstrap everything
    const authSub = this.firebaseService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
        this.loadFriends();
        this.listenForRequests();
      }
    });
    this.subscriptions.push(authSub);
  }
 
  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.statusListeners.forEach(unsub => unsub());
    if (this.friendRequestUnsubscribe) this.friendRequestUnsubscribe();
  }
 
  // ─── Friends ────────────────────────────────────────────────
 
 private friendsMap = new Map<string, Friend>();

  private loadFriends(): void {
    const friendsSub = this.firebaseService
      .getFriends(this.currentUserId)
      .subscribe((friendEntries) => {

        // Clear previous status listeners and friend state on each refresh
        this.statusListeners.forEach(unsub => unsub());
        this.statusListeners = [];
        this.friendsMap.clear();

        for (const entry of friendEntries) {
          const friendId = entry.friendId ?? entry.id;

          // Fetch the friend's Firestore profile to get their username
          const profileSub = this.firebaseService.getUser(friendId).subscribe(profile => {
            if (!profile) return;

            // Build the friend object and store it in the map
            const friend: Friend = {
              id:       friendId,
              uid:      friendId,
              username: profile.username ?? profile.email ?? 'Unknown',
              isOnline: false,
            };
            this.friendsMap.set(friendId, friend);

            // Listen for real-time online/offline status changes
            this.firebaseService.listenToUserStatus(friendId, (statusData) => {
              // Mutate the stored object directly so bucketFriends always sees current state
              friend.isOnline = statusData?.state === 'online';
              this.bucketFriends();
            });
          });

          this.subscriptions.push(profileSub);
        }
      });

    this.subscriptions.push(friendsSub);
  }

// Re-splits friendsMap into online / offline arrays for the template
private bucketFriends(): void {
  const all = Array.from(this.friendsMap.values());
  this.onlineFriends  = all.filter(f => f.isOnline);
  this.offlineFriends = all.filter(f => !f.isOnline);
}
 
  // ─── Friend Requests ────────────────────────────────────────
 
  private listenForRequests(): void {
    this.firebaseService.listenForFriendRequests(
      this.currentUserId,
      async (requestsData) => {
        if (!requestsData) {
          this.pendingRequests = [];
          return;
        }
 
        const requests: FriendRequest[] = [];
 
        for (const [senderUid, data] of Object.entries(requestsData) as [string, any][]) {
          if (data?.status !== 'pending') continue;
 
          // Fetch sender profile
          const profileSub = this.firebaseService.getUser(senderUid).subscribe(profile => {
            if (!profile) return;
 
            const alreadyExists = requests.some(r => r.uid === senderUid);
            if (!alreadyExists) {
              requests.push({
                uid:      senderUid,
                username: profile.username ?? profile.email ?? 'Unknown',
              });
            }
            this.pendingRequests = [...requests];
          });
 
          this.subscriptions.push(profileSub);
        }
 
        if (Object.keys(requestsData).length === 0) {
          this.pendingRequests = [];
        }
      }
    );
  }
 
  async acceptRequest(req: FriendRequest): Promise<void> {
    try {
      await this.firebaseService.acceptFriendRequest(req.uid, this.currentUserId);
      this.pendingRequests = this.pendingRequests.filter(r => r.uid !== req.uid);
      this.loadFriends(); // Refresh friends list
    } catch (err) {
      console.error('Error accepting friend request:', err);
    }
  }
 
  async declineRequest(req: FriendRequest): Promise<void> {
    try {
      await this.firebaseService.denyFriendRequest(req.uid, this.currentUserId);
      this.pendingRequests = this.pendingRequests.filter(r => r.uid !== req.uid);
    } catch (err) {
      console.error('Error declining friend request:', err);
    }
  }
 
  // ─── Search ─────────────────────────────────────────────────
 
  onSearch(): void {
    clearTimeout(this.searchDebounce);
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      this.searchLoading = false;
      return;
    }
    this.searchLoading = true;
    this.searchDebounce = setTimeout(() => this.runSearch(), 400);
  }
 
  private runSearch(): void {
    const allUsersSub = this.firebaseService.getUsers().subscribe(users => {
      const query = this.searchQuery.trim().toLowerCase();
 
      const results: SearchUser[] = users
      .filter(u =>
        u.id !== this.currentUserId &&
        u.username?.toLowerCase().includes(query) &&
        !this.friendsMap.has(u.id) // exclude existing friends
      )
      .map(u => ({
        uid: u.id,
        username: u.username ?? u.email ?? 'Unknown',
        isOnline: false,
        requestSent: false,
      }));
 
      // Attach live online status to each result
      results.forEach(user => {
        this.firebaseService.listenToUserStatus(user.uid, (statusData) => {
          user.isOnline = statusData?.state === 'online';
        });
      });
 
      this.searchResults = results;
      this.searchLoading = false;
    });
 
    // Only keep it alive for this search cycle
    setTimeout(() => allUsersSub.unsubscribe(), 5000);
  }
 
  clearSearch(): void {
    this.searchQuery   = '';
    this.searchResults = [];
    this.searchLoading = false;
  }
 
  async sendRequest(user: SearchUser): Promise<void> {
    if (user.requestSent) return;
    try {
      await this.firebaseService.sendFriendRequest(user.uid, this.currentUserId);
      user.requestSent = true;
    } catch (err) {
      console.error('Error sending friend request:', err);
    }
  }
}
 