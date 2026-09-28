import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    User,
} from "firebase/auth";
import { auth } from "./config";

// Creates a new user account with email and password
// Returns: Promise with user credentials
export async function signUp(email: string, password: string) {
  return await createUserWithEmailAndPassword(auth, email, password);
}

// Signs in an existing user with email and password
// Returns: Promise with user credentials
export async function signIn(email: string, password: string) {
  return await signInWithEmailAndPassword(auth, email, password);
}

// Signs out the current user
// Returns: Promise that resolves when sign out is complete
export async function logOut() {
  return await signOut(auth);
}

// Listen for authentication state changes and call the callback with the user or null.
export function subscribeToAuthChanges(callback: (user: any) => void) {
  return onAuthStateChanged(auth, callback);
}

// Gets the currently signed-in user
// Returns: User object or null if no user is signed in
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

// Gets the ID token for the current user (for API authentication)
// This token can be sent to your backend to verify the user's identity
// Returns: Promise with the ID token string, or null if no user is signed in
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (user) {
    try {
      // Force refresh = true ensures you get a fresh token
      return await user.getIdToken(true);
    } catch (error) {
      console.error("Error getting ID token:", error);
      return null;
    }
  }
  return null;
}

// Gets the user's UID (unique identifier) for use with MongoDB
// This UID should be used as the user reference in your MongoDB documents
// Returns: User UID string or null if no user is signed in
export function getUserId(): string | null {
  const user = auth.currentUser;
  return user ? user.uid : null;
}

// Gets comprehensive user information
// Returns: Object with user details or null if no user is signed in
export function getUserInfo() {
  const user = auth.currentUser;
  if (user) {
    return {
      uid: user.uid, // This is for MongoDB
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      photoURL: user.photoURL,
      phoneNumber: user.phoneNumber,
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime,
    };
  }
  return null;
}

// Checks if a user is currently authenticated
// Returns: boolean - true if user is signed in, false otherwise
export function isAuthenticated(): boolean {
  return auth.currentUser !== null;
}
