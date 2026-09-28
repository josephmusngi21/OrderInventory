import {
    EmailAuthProvider,
    createUserWithEmailAndPassword,
    reauthenticateWithCredential,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut,
    updateEmail,
    updatePassword,
    updateProfile,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";

/**
 * Creates the Firebase Auth account only. Company profiles and memberships
 * are created by the next company/join workflow, so signup is not blocked by
 * a second Firestore request.
 */
export async function signup(email, password, displayName) {
  console.log(
    `[auth signup ${new Date().toISOString()}] creating Firebase account`,
  );
  const credentials = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  await updateProfile(credentials.user, { displayName: displayName.trim() });
  console.log(
    `[auth signup ${new Date().toISOString()}] completed - uid=${credentials.user.uid}`,
  );
  return credentials;
}

/** Signs an existing user in with Firebase Authentication. */
export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

/** Signs the current user out. */
export async function logout() {
  return signOut(auth);
}

/** Returns the synchronously available Firebase user, or null when signed out. */
export function getCurrentUser() {
  return auth.currentUser;
}

/** Reauthenticates before applying sensitive email or password changes. */
export async function updateAccountCredentials({
  currentPassword,
  email,
  password,
}) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Sign in again to update your account.");
  const nextEmail = email.trim();
  const emailChanged = nextEmail && nextEmail !== user.email;
  const passwordChanged = Boolean(password);
  if (!emailChanged && !passwordChanged) return user;
  if (!currentPassword) {
    throw new Error("Enter your current password to update email or password.");
  }

  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, currentPassword),
  );
  if (emailChanged) {
    await updateEmail(user, nextEmail);
    await sendEmailVerification(user);
  }
  if (passwordChanged) await updatePassword(user, password);
  return user;
}

/** Reads the application role and company context for the signed-in user. */
export async function getUserAccess(userUid) {
  const profile = await getDoc(doc(db, "users", userUid));
  return profile.exists() ? profile.data() : null;
}
