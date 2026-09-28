const crypto = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  FieldValue,
  getDb,
  getUserProfile,
  requireAuth,
  requireCompanyAdmin,
} = require("./admin");
const { secureAuditLogWrite } = require("./audit");

const JOIN_CODE_TTL_MS = 60 * 1000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Creates a cryptographically strong, human-readable invite code. */
function createJoinCode() {
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/** Hashes an invite code so the usable value is never stored. */
function hashJoinCode(code) {
  return crypto
    .createHash("sha256")
    .update(code.trim().toUpperCase())
    .digest("hex");
}

/** Generates an invite code after verifying the caller is a company admin. */
exports.generateJoinCodeServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const companyId =
    request.data?.companyId || (await getUserProfile(userId))?.companyId;
  if (!companyId)
    throw new HttpsError("failed-precondition", "A company is required.");
  await requireCompanyAdmin(companyId, userId);

  const rawCode = createJoinCode();
  const joinCodeRef = getDb().collection("joinCodes").doc();
  const expiresAt = new Date(Date.now() + JOIN_CODE_TTL_MS);
  await joinCodeRef.create({
    companyId,
    codeHash: hashJoinCode(rawCode),
    codePrefix: rawCode.slice(0, 4),
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    createdBy: userId,
    useCount: 0,
  });
  await secureAuditLogWrite({
    companyId,
    userId,
    action: "joinCodeGenerated",
    metadata: { joinCodeId: joinCodeRef.id },
  });
  return {
    joinCodeId: joinCodeRef.id,
    companyId,
    code: rawCode,
    expiresAt: expiresAt.toISOString(),
  };
});

/** Revokes an active invite code after verifying the caller is its company admin. */
exports.revokeJoinCode = onCall(async (request) => {
  const userId = requireAuth(request);
  const joinCodeId = request.data?.joinCodeId;
  if (!joinCodeId)
    throw new HttpsError("invalid-argument", "joinCodeId is required.");

  const ref = getDb().doc(`joinCodes/${joinCodeId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists)
    throw new HttpsError("not-found", "Join code not found.");
  const data = snapshot.data();
  await requireCompanyAdmin(data.companyId, userId);
  await ref.update({
    status: "revoked",
    revokedAt: FieldValue.serverTimestamp(),
    revokedBy: userId,
  });
  await secureAuditLogWrite({
    companyId: data.companyId,
    userId,
    action: "joinCodeRevoked",
    metadata: { joinCodeId },
  });
  return { joinCodeId, status: "revoked" };
});

/** Validates an invite code without exposing join-code documents to clients. */
exports.validateJoinCodeServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const code = request.data?.code;
  const displayName = String(request.data?.displayName || "")
    .trim()
    .slice(0, 80);
  if (typeof code !== "string" || !code.trim())
    throw new HttpsError("invalid-argument", "A join code is required.");

  const codeHash = hashJoinCode(code);
  const matches = await getDb()
    .collection("joinCodes")
    .where("codeHash", "==", codeHash)
    .where("status", "==", "active")
    .limit(1)
    .get();
  if (matches.empty) {
    await secureAuditLogWrite({
      userId,
      action: "joinAttempt",
      success: false,
      metadata: { reason: "invalidCode" },
    });
    throw new HttpsError("not-found", "The join code is invalid or expired.");
  }

  const snapshot = matches.docs[0];
  const data = snapshot.data();
  if (!data.expiresAt || data.expiresAt.toDate() <= new Date()) {
    await snapshot.ref.delete();
    await secureAuditLogWrite({
      userId,
      action: "joinAttempt",
      success: false,
      metadata: { reason: "expiredCode", companyId: data.companyId },
    });
    throw new HttpsError("deadline-exceeded", "The join code is expired.");
  }

  const membershipRef = getDb().doc(
    `companies/${data.companyId}/memberships/${userId}`,
  );
  const userRef = getDb().doc(`users/${userId}`);
  const batch = getDb().batch();
  batch.set(membershipRef, {
    userId,
    companyId: data.companyId,
    role: "member",
    status: "active",
    joinedAt: FieldValue.serverTimestamp(),
    joinedVia: "joinCode",
    joinedWithJoinCodeId: snapshot.id,
    createdBy: userId,
    updatedAt: FieldValue.serverTimestamp(),
    email: request.auth.token.email || "",
    displayName,
  });
  batch.set(
    userRef,
    {
      companyId: data.companyId,
      role: "member",
      displayName,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.update(snapshot.ref, {
    useCount: FieldValue.increment(1),
    lastUsedAt: FieldValue.serverTimestamp(),
    lastUsedBy: userId,
  });
  await batch.commit();

  await secureAuditLogWrite({
    companyId: data.companyId,
    userId,
    action: "joinAttempt",
    metadata: { joinCodeId: snapshot.id, result: "valid" },
  });
  await secureAuditLogWrite({
    companyId: data.companyId,
    userId,
    action: "joinSuccess",
    metadata: { joinCodeId: snapshot.id },
  });
  return {
    joinCodeId: snapshot.id,
    companyId: data.companyId,
    expiresAt: data.expiresAt.toDate().toISOString(),
  };
});

/** Removes expired join-code hashes so they cannot accumulate in Firestore. */
exports.deleteExpiredJoinCodes = onSchedule("every 1 minutes", async () => {
  const expiredCodes = await getDb()
    .collection("joinCodes")
    .where("expiresAt", "<=", new Date())
    .limit(500)
    .get();
  if (expiredCodes.empty) return;

  const batch = getDb().batch();
  expiredCodes.docs.forEach((snapshot) => batch.delete(snapshot.ref));
  await batch.commit();
});

module.exports = exports;
