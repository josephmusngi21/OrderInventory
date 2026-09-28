const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (getApps().length === 0) {
  initializeApp();
}

const adminAuth = getAuth();
const adminDb = getFirestore();

/** Returns the Admin SDK Firestore instance used by every function. */
function getDb() {
  return adminDb;
}

/** Verifies a callable request has an authenticated Firebase user. */
function requireAuth(request) {
  if (!request.auth?.uid) {
    const error = new Error("Authentication is required.");
    error.code = "unauthenticated";
    throw error;
  }
  return request.auth.uid;
}

/** Reads a company membership and requires an active administrator role. */
async function requireCompanyAdmin(companyId, userId) {
  const membership = await adminDb
    .doc(`companies/${companyId}/memberships/${userId}`)
    .get();
  const data = membership.exists ? membership.data() : null;
  if (!data || data.status !== "active" || data.role !== "admin") {
    const error = new Error(
      "Only an active company administrator can perform this action.",
    );
    error.code = "permission-denied";
    throw error;
  }
  return data;
}

/** Reads an active company membership for ordinary member authorization. */
async function requireCompanyMember(companyId, userId) {
  const membership = await adminDb
    .doc(`companies/${companyId}/memberships/${userId}`)
    .get();
  const data = membership.exists ? membership.data() : null;
  if (!data || data.status !== "active") {
    const error = new Error("The user is not an active company member.");
    error.code = "permission-denied";
    throw error;
  }
  return data;
}

/** Returns the authenticated user's profile without trusting client fields. */
async function getUserProfile(userId) {
  const snapshot = await adminDb.doc(`users/${userId}`).get();
  return snapshot.exists ? snapshot.data() : null;
}

module.exports = {
  FieldValue,
  adminAuth,
  getDb,
  getUserProfile,
  requireAuth,
  requireCompanyAdmin,
  requireCompanyMember,
};
