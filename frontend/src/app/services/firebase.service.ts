import { Injectable, inject } from "@angular/core";
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDocs,
  where,
  query,
  getDoc
} from "@angular/fire/firestore";
import { Auth, signInWithEmailAndPassword, signOut, user, createUserWithEmailAndPassword, UserCredential, getAuth } from '@angular/fire/auth';
import {Observable, switchMap, of, queue} from 'rxjs';
import { Database, ref, onDisconnect, set, serverTimestamp, onValue, remove } from "@angular/fire/database";
import {get, off} from '@angular/fire/database';
import { UserPreferences } from '../account-preferences/account-preferences.component';
// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Derrick Mangari 2026-03-14       Created the FirebaseService to handle all interactions with Firebase Auth and Firestore, including user registration, login, logout, and CRUD operations for user data. Also implemented error handling for authentication methods.
// Derrick Mangari 2026-03-15       Created functionialites for SocialHub (send Friend requests, Accept/Deny a friend Request, Retrieve Friend List, Listen to Friend Requests and Friends Status)
// Justin P.       2026-04-12       Added functionalities required for matchmaking / multiplayer play
// Justin P.       2026-04-12       Fixed imports due to issues with Login / Register pages

@Injectable({ providedIn: 'root' })
export class FirebaseService {
    private firestore = inject(Firestore);
    private auth = inject(Auth);
    private database = inject(Database);

    // Auth
    currentUser$ = user(this.auth);

    async register(username: string, email: string, password: string): Promise<UserCredential> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
        // Use the Auth UID as the Firestore document ID
        const ref = doc(this.firestore, `users/${credential.user.uid}`);
        await setDoc(ref, {
            username,
            email,
            pb: {
                "4x4": null,
                "6x6": null,
                "8x8": null
            }
        });
        // Set user online status in Realtime Database
        await this.setUserOnline(credential.user.uid);
        return credential;
}

    async login(email: string, password: string): Promise<import('@angular/fire/auth').UserCredential> {
        const credentials = await signInWithEmailAndPassword(this.auth, email, password);
        // Set user online status in Realtime Database
        await this.setUserOnline(credentials.user.uid);
        return credentials;
    }

    async logout(): Promise<void> {
        const auth = this.auth;
        const user = auth.currentUser;
        // Set user offline status in Realtime Database before signing out
        if(user){
            const statusRef = ref(this.database, `status/${user.uid}`);
            await set(statusRef, {
                state: 'offline',
                last_changed: serverTimestamp()
            });
        }
        // Sign out from Firebase Auth
        return signOut(this.auth);
    }

    async isUsernameTaken(username: string): Promise<boolean> {
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('username', '==', username));
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    }

    authenticateUser(): Observable<any> {
    // This method combines the Auth user observable with a Firestore query to fetch the user's profile data based on their UID.
        return user(this.auth).pipe(
            switchMap(authUser => {
                if (!authUser) return of(null);           // not logged in
                return this.getUser(authUser.uid);        // fetch from Firestore by UID
            })
        );
    }


    // Firestore
    getUsers(): Observable<any[]> {
        const ref = collection(this.firestore, 'users');
        return collectionData(ref, { idField: 'id' });
    }

    getUser(id: string): Observable<any> {
        const ref = doc(this.firestore, `users/${id}`);
        return docData(ref, { idField: 'id' });
    }

    async getUserSnapshot(id: String): Promise<any> {
      const ref = doc(this.firestore, `users/${id}`);
      const snap = await getDoc(ref);
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    }

    addUser(user: any): Promise<any> {
        const ref = collection(this.firestore, 'users');
        return addDoc(ref, user);
    }

    updateUser(id: string, user: any): Promise<void> {
        const ref = doc(this.firestore, `users/${id}`);
        return updateDoc(ref, user);
    }

    deleteUser(id: string): Promise<void> {
        const ref = doc(this.firestore, `users/${id}`);
        return deleteDoc(ref);
    }

    // Friend Management
        async addFriend(userId: string, friendId: string): Promise<void> {
        const friendRef = doc(this.firestore, `users/${userId}/friends/${friendId}`);
        // Add friend to user friend list
        await setDoc(friendRef, { friendId });
    }

    async deleteFriend(userId: string, friendId: string): Promise<void> {
        const userRef = doc(this.firestore, `users/${userId}`);
        // Remove friendId from user's friends list
        return deleteDoc(doc(userRef, `friends/${friendId}`));
    }

    async removeFriend(userId: string, friendId: string): Promise<void> {
        // Remove friendId from user's friends list
        await this.deleteFriend(userId, friendId);
        // Also remove userId from friend's friends list
        await this.deleteFriend(friendId, userId);
    }

    getFriends(userId: string): Observable<any[]> {
        const ref = collection(this.firestore, `users/${userId}/friends`);
        return collectionData(ref, { idField: 'id' });
    }

    // Helper method to get user ID by username (for searching friends by username)
    async getUserIdByUsername(username: string, currentId: string): Promise<string | null> {
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('username', '==', username));
        const snapshot = await getDocs(q);
        //check if empty
        if (snapshot.empty) {
            return null;
        }
        //cannot add yourself
        if(snapshot.docs[0].id == currentId){
            return null
        }
        //return friend id
        return snapshot.docs[0].id;
    }




    // Real-time Database Methods

    // User Status (Online/Offline) Tracking

    async setUserOnline(uid: string) {
        const statusRef = ref(this.database, `status/${uid}`);
        // Set up onDisconnect to set user offline when they disconnect
        const offlineStatus = {
            state: 'offline',
            last_changed: serverTimestamp()
        }
        // When the user connects, update their status to online
        const onlineStatus = {
            state: 'online',
            last_changed: serverTimestamp()
        }

        await onDisconnect(statusRef).set(offlineStatus);
        await set(statusRef, onlineStatus);
    }

    async setUserOffline(uid: string): Promise<void> {
        const statusRef = ref(this.database, `status/${uid}`);
        await set(statusRef, {
            state: 'offline',
            last_changed: serverTimestamp()
        });
    }

    // Listen to changes in a user's online status
    listenToUserStatus(uid: string, callback: (status: any) => void) {
        const statusRef = ref(this.database, `status/${uid}`);
        onValue(statusRef, (snapshot) => {
            callback(snapshot.val());
        });
    }

    // Listen for Friend Requests
    listenForFriendRequests(uid: string, callback: (requests: any) => void) {
        const requestsRef = ref(this.database, `friendRequests/${uid}`);
        onValue(requestsRef, (snapshot) => {
            callback(snapshot.val());
        });
    }


    // Friend Requests and Social Features can be implemented here as needed, using Firestore for persistent data and Realtime Database for real-time updates.

    async sendFriendRequest(friendUid: string, currentUid: string) {
        if(friendUid === currentUid){
            throw new Error("Cannot add yourself");
        }
        //Create a friend request entry in Realtime Database under "friendRequests/{friendUid}/{currentUid}" with status "pending"
        const requestRef = ref(this.database, `friendRequests/${friendUid}/${currentUid}`);

        await set(requestRef, {
            from: currentUid,
            status: 'pending',
            timestamp: serverTimestamp()
        });
    }

    async acceptFriendRequest(friendUid: string, currentUid: string) {
        // Update the friend request status to "accepted" and add each other to their respective friend lists in Firestore
        const requestRef = ref(this.database, `friendRequests/${currentUid}/${friendUid}`);
        await set(requestRef, {
            from: friendUid,
            status: 'accepted',
            timestamp: serverTimestamp()
        });
        await this.addFriend(currentUid, friendUid); // Add friend to current user's friend list
        await this.addFriend(friendUid, currentUid); // Add current user to friend's friend list
        await remove(requestRef); // Remove the friend request from Realtime Database after accepting
    }

    async denyFriendRequest(friendUid: string, currentUid: string) {
        // Update the friend request status to "denied"
        const requestRef = ref(this.database, `friendRequests/${currentUid}/${friendUid}`);
        await set(requestRef, {
            from: friendUid,
            status: 'denied',
            timestamp: serverTimestamp()
        });
        await remove(requestRef); // Remove the friend request from Realtime Database after denying
    }

    // Rankings
    async updatePersonalBest(uid: string, cube: string, time: number): Promise<void> {
        const userRef = doc(this.firestore, `users/${uid}`);
        await updateDoc(userRef, {
            [`pb.${cube}`]: time
        });
    }

  //user preference
  async saveUserPreferences(uid: string, preferences: UserPreferences): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    await updateDoc(userRef, {
      preferences: {
        theme: preferences.theme,
        backgroundMusic: preferences.backgroundMusic,
        profilePicture: preferences.profilePicture
      }
    });
  }

  async createGameSession(player1Id: String, player2Id: String, gameMode: String, gridSize: String): Promise<string> {
      const player1Data = await this.getUserSnapshot(player1Id);
      const player2Data = await this.getUserSnapshot(player2Id);

      // Create KakuroGame instance (kg)
      const kgRef = await addDoc(collection(this.firestore, "kakuroGames"), {
        gridSize,
        state: "active",
        createdAt: new Date()
      });

      // Create GameSession instance (gs)
      const gsRef = await addDoc(collection(this.firestore, "gameSessions"), {
        gameMode,
        player1: { id: player1Id, username: player1Data?.username ?? "" },
        player2: { id: player2Id, username: player2Data?.username ?? "" },
        state: "active",
        kakuroGameId: kgRef.id,
        gridSize,
        createdAt: new Date()
      });

      // Set both players with same game session
      await set(ref(this.database, `playerSessions/${player1Id}`), { sessionId: gsRef.id });
      await set(ref(this.database, `playerSessions/${player2Id}`), { sessionId: gsRef.id });

      // Remove players from matchmaking queue
      await this.leaveMatchmakingQueue(player1Id);
      await this.leaveMatchmakingQueue(player2Id);

      return gsRef.id;
  }

  getGameSession(sessionId: string): Observable<any> {
      const ref = doc(this.firestore, `gameSessions/${sessionId}`);
      return docData(ref, { idField: "id" });
  }

  // Pause game
  async pauseGame(sessionId: String): Promise<void> {
      const sessionRef = doc(this.firestore, `gameSessions/${sessionId}`);
      await updateDoc(sessionRef, { state: "paused" });
  }

  // Resume game
  async resumeGame(sessionId: String): Promise<void> {
      const sessionRef = doc(this.firestore, `gameSessions/${sessionId}`);
      await updateDoc(sessionRef, { state: "active" });
  }

  // Quit game
  async quitGame(sessionId: String, quittingPlayerId: String, isMultiplayer: Boolean): Promise<void> {
    const sessionRef = doc(this.firestore, `gameSessions/${sessionId}`);

    if (isMultiplayer) {
      // Notify players game has ended, then kick everyone out
      const snap = await getDoc(sessionRef);
      if (snap.exists()) {
        const data = snap.data();
        const p1 = data["player1"]?.id;
        const p2 = data["player2"]?.id;

        // Remove both players from playerSessions
        if (p1) await remove (ref(this.database, `playerSessions/${p1}`));
        if (p2) await remove (ref(this.database, `playerSessions/${p2}`));

        // Notify game end
        await set(ref(this.database, `gameEnded/${sessionId}`), {
          reason: "player_quit",
          quittingPlayer: quittingPlayerId,
          timestamp: serverTimestamp()
        });
      }
    } else {
      // Single player
      await remove(ref(this.database, `playerSessions/${quittingPlayerId}`));
    }

    // Terminate game instance
    await deleteDoc(sessionRef);
  }

  listenForGameEnd(sessionId: String, callback: (data: any) => void): () => void {
      const endRef = ref(this.database, `gameEnded/${sessionId}`);
      onValue(endRef, (snapshot) => {
        if (snapshot.exists()) callback(snapshot.val());
      });
      return () => off(endRef);
  }

  // SendInvitation (duels)
  async sendDuelInvitation(userId: String, friendId: String, gameMode: String, gridSize: String): Promise<string> {
      const invitesRef = collection(this.firestore, "duelInvitations");
      const inviteDoc = await addDoc(invitesRef, {
        sender: userId,
        receiver: friendId,
        status: "pending",
        grid: gridSize,
        gameMode,
        createdAt: new Date()
      });

      // Notify receiver in realtime DB
      const rtInvitedRef = ref(this.database, `duelInvites/${friendId}/${inviteDoc.id}`);
      await set(rtInvitedRef, {
        inviteId: inviteDoc.id,
        sender: userId,
        grid: gridSize,
        gameMode,
        timestamp: serverTimestamp()
      });

      return inviteDoc.id;
  }

  listenForDuelInvites(uid: string, callback: (invites: any) => void): () => void {
      const invitesRef = ref(this.database, `duelInvites/${uid}`);
      onValue(invitesRef, (snapshot) => callback(snapshot.val()));
      return () => off(invitesRef);
  }

  // Accept Invitation
  async acceptDuelInvitation(inviteId: String, receiverId: String): Promise<string> {
      const inviteRef = doc(this.firestore, `duelInvitations/${inviteId}`);
      const inviteSnap = await getDoc(inviteRef);

      if (!inviteSnap.exists()) throw new Error("Invite not found");
      const invite = inviteSnap.data();

      // Validate: receiver must be the current user
      if (invite["receiver"] !== receiverId) throw new Error("Not the invite receiver");

      // Update status
      await updateDoc(inviteRef, { status: "accepted" });

      // Fetch player data
      const senderData = await this.getUserSnapshot(invite["sender"]);
      const receiverData = await this.getUserSnapshot(receiverId);

      // Create KakuroGame instance
      const kgRef = await addDoc(collection(this.firestore, "kakuroGames"), {
        gridSize: invite["grid"],
        state: "active",
        createdAt: new Date()
      });

      // Create GameSession instance
      const gsRef = await addDoc(collection(this.firestore, "gameSessions"), {
        gameMode: invite["gameMode"] ?? "Multiplayer",
        player1: { id: invite["sender"], username: senderData?.username ?? "" },
        player2: { id: receiverId, username: receiverData?.username ?? ""},
        state: "active",
        kakuroGameId: kgRef.id,
        gridSize: invite["grid"],
        createdAt: new Date()
      });

      // Associate players with session
      await set(ref(this.database, `playerSessions/${invite["sender"]}`), { sessionId: gsRef.id });
      await set(ref(this.database, `playerSessions/${receiverId}`), { sessionId: gsRef.id });

      // Delete DuelInvitation
      await deleteDoc(inviteRef);
      await remove(ref(this.database, `duelInvites/${receiverId}/${inviteId}`));

      return gsRef.id;
  }

  // Refuse Invitation
  async refuseDuelInvitation(inviteId: String, receiverId: String): Promise<void> {
      const inviteRef = doc(this.firestore, `duelInvitations/${inviteId}`);
      const inviteSnap = await getDoc(inviteRef);

      if (!inviteSnap.exists()) return;
      const invite = inviteSnap.data();

      // Set status to refused
      await updateDoc(inviteRef, {status : "refused"});

      // Notify sender in Realtime DB
      await remove(ref(this.database, `duelInvites/${receiverId}/${inviteId}`));
      await set(ref(this.database, `inviteRefused/${invite["sender"]}/${inviteId}`), {
        inviteId,
        timestamp: serverTimestamp()
      });

      // Delete DuelInvitation automatically after 1 minute of elapsed time
      setTimeout(async () => {
        try { await deleteDoc(inviteRef); } catch { }
      }, 60_000);
  getUserPreferences(uid: string): Observable<any> {
    const ref = doc(this.firestore, `users/${uid}`);
    return docData(ref, { idField: 'id' });
  }
}
