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
import { getDatabase, ref, onDisconnect, set, serverTimestamp, onValue, remove } from "firebase/database";
import { UserPreferences } from '../account-preferences/account-preferences.component';
// Revision history:
//
// DEVELOPER          DATE                            COMMENTS
// Derrick Mangari 2026-03-14       Created the FirebaseService to handle all interactions with Firebase Auth and Firestore, including user registration, login, logout, and CRUD operations for user data. Also implemented error handling for authentication methods.
// Derrick Mangari 2026-03-15       Created functionialites for SocialHub (send Friend requests, Accept/Deny a friend Request, Retrieve Friend List, Listen to Friend Requests and Friends Status)
// Justin P.       2026-04-12       Added functionalities required for matchmaking / multiplayer play

@Injectable({ providedIn: 'root' })
export class FirebaseService {
    private firestore = inject(Firestore);
    private auth = inject(Auth);
    private database = getDatabase();

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

  getUserPreferences(uid: string): Observable<any> {
    const ref = doc(this.firestore, `users/${uid}`);
    return docData(ref, { idField: 'id' });
  }
}
