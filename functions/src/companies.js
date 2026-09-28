const crypto = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue, getDb, requireAuth, adminAuth } = require("./admin");
const { secureAuditLogWrite } = require("./audit");

const JOIN_CODE_TTL_MS = 60 * 1000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Creates a cryptographically strong invite code for a new company. */
function createJoinCode() {
  return Array.from(
    crypto.randomBytes(12),
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join("");
}

/** Hashes the invite code before it is stored. */
function hashJoinCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Atomically creates a company, its admin membership, profile, invite code, and audit record. */
exports.createCompanyServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const companyName = request.data?.companyName?.trim();
  const displayName = String(request.data?.displayName || "")
    .trim()
    .slice(0, 80);
  if (!companyName)
    throw new HttpsError("invalid-argument", "A company name is required.");

  const db = getDb();
  const companyRef = db.collection("companies").doc();
  const membershipRef = db.doc(
    `companies/${companyRef.id}/memberships/${userId}`,
  );
  const userRef = db.doc(`users/${userId}`);
  const joinCodeRef = db.collection("joinCodes").doc();
  const auditRef = db.collection("auditLogs").doc();
  const rawCode = createJoinCode();
  const expiresAt = new Date(Date.now() + JOIN_CODE_TTL_MS);
  const batch = db.batch();

  batch.create(companyRef, {
    name: companyName,
    normalizedName: companyName.toLowerCase(),
    status: "active",
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    memberCount: 1,
    settings: { inventorySchemaVersion: "1" },
  });
  batch.create(membershipRef, {
    userId,
    companyId: companyRef.id,
    role: "admin",
    status: "active",
    joinedAt: FieldValue.serverTimestamp(),
    joinedVia: "companyCreation",
    joinedWithJoinCodeId: null,
    createdBy: userId,
    updatedAt: FieldValue.serverTimestamp(),
    email: request.auth.token.email || "",
    displayName,
  });
  batch.set(
    userRef,
    {
      companyId: companyRef.id,
      role: "admin",
      displayName,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.create(joinCodeRef, {
    companyId: companyRef.id,
    codeHash: hashJoinCode(rawCode),
    codePrefix: rawCode.slice(0, 4),
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    createdBy: userId,
    useCount: 0,
  });
  batch.create(auditRef, {
    companyId: companyRef.id,
    actorId: userId,
    actorEmail: request.auth.token.email || null,
    action: "companyCreated",
    success: true,
    metadata: { companyName },
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return {
    companyId: companyRef.id,
    joinCode: {
      joinCodeId: joinCodeRef.id,
      companyId: companyRef.id,
      code: rawCode,
      expiresAt: expiresAt.toISOString(),
    },
  };
});

/** Lists company members for an administrator without exposing other tenants. */
exports.getCompanyMembersServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const companyId = request.data?.companyId;
  if (!companyId)
    throw new HttpsError("invalid-argument", "companyId is required.");
  const membership = await getDb()
    .doc(`companies/${companyId}/memberships/${userId}`)
    .get();
  if (
    !membership.exists ||
    membership.data().role !== "admin" ||
    membership.data().status !== "active"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only company administrators can list members.",
    );
  }
  const snapshots = await getDb()
    .collection(`companies/${companyId}/memberships`)
    .orderBy("joinedAt", "desc")
    .get();
  return Promise.all(
    snapshots.docs.map(async (snapshot) => {
      const member = snapshot.data();
      try {
        const user = await adminAuth.getUser(snapshot.id);
        return {
          id: snapshot.id,
          ...member,
          email: member.email || user.email || "",
          displayName: member.displayName || user.displayName || "",
        };
      } catch {
        return { id: snapshot.id, ...member };
      }
    }),
  );
});

/** Updates the authenticated user's name across Auth, profile, and membership records. */
exports.updateAccountProfileServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const displayName = String(request.data?.displayName || "")
    .trim()
    .slice(0, 80);
  if (!displayName) {
    throw new HttpsError("invalid-argument", "A profile name is required.");
  }

  const user = await adminAuth.updateUser(userId, { displayName });
  const db = getDb();
  const userRef = db.doc(`users/${userId}`);
  const profile = await userRef.get();
  const companyId = profile.exists ? profile.data().companyId : null;
  const batch = db.batch();
  batch.set(
    userRef,
    {
      displayName,
      email: user.email || "",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  if (companyId) {
    const membershipRef = db.doc(
      `companies/${companyId}/memberships/${userId}`,
    );
    const membership = await membershipRef.get();
    if (membership.exists) {
      batch.update(membershipRef, {
        displayName,
        email: user.email || "",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
  await batch.commit();
  return { displayName, email: user.email || "" };
});

/** Removes a member while preserving the membership record for auditability. */
exports.removeCompanyMemberServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const { companyId, memberId } = request.data || {};
  if (!companyId || !memberId || memberId === userId)
    throw new HttpsError("invalid-argument", "A removable member is required.");
  const adminMembership = await getDb()
    .doc(`companies/${companyId}/memberships/${userId}`)
    .get();
  if (
    !adminMembership.exists ||
    adminMembership.data().role !== "admin" ||
    adminMembership.data().status !== "active"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only company administrators can remove members.",
    );
  }
  const memberRef = getDb().doc(
    `companies/${companyId}/memberships/${memberId}`,
  );
  const member = await memberRef.get();
  if (!member.exists) throw new HttpsError("not-found", "Member not found.");
  await memberRef.update({
    status: "removed",
    updatedAt: FieldValue.serverTimestamp(),
    removedBy: userId,
  });
  await secureAuditLogWrite({
    companyId,
    userId,
    action: "memberRemoved",
    metadata: { memberId },
  });
  return { memberId, status: "removed" };
});

/** Reads company settings for any active company member. */
exports.getCompanySettingsServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const companyId = request.data?.companyId;
  if (!companyId)
    throw new HttpsError("invalid-argument", "companyId is required.");
  const membership = await getDb()
    .doc(`companies/${companyId}/memberships/${userId}`)
    .get();
  if (!membership.exists || membership.data().status !== "active")
    throw new HttpsError("permission-denied", "Active membership is required.");
  const company = await getDb().doc(`companies/${companyId}`).get();
  if (!company.exists) return {};
  const companyData = company.data();
  return {
    ...(companyData.settings || {}),
    companyName: companyData.name || "",
  };
});

/** Updates barcode and inventory behavior settings for an administrator. */
exports.updateCompanySettingsServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const { companyId, settings } = request.data || {};
  if (
    !companyId ||
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  )
    throw new HttpsError("invalid-argument", "Company settings are required.");
  const membership = await getDb()
    .doc(`companies/${companyId}/memberships/${userId}`)
    .get();
  if (
    !membership.exists ||
    membership.data().role !== "admin" ||
    membership.data().status !== "active"
  )
    throw new HttpsError(
      "permission-denied",
      "Only company administrators can update settings.",
    );
  const quantityColumnName = String(settings.quantityColumnName || "").trim();
  const defaultLocation = String(settings.defaultLocation || "")
    .trim()
    .slice(0, 120);
  const requiredColumnFields = Array.isArray(settings.requiredColumnFields)
    ? settings.requiredColumnFields
        .filter((field) => typeof field === "string")
        .map((field) => field.trim().slice(0, 160))
        .filter(Boolean)
        .slice(0, 50)
    : [];
  const allowed = {
    allowBarcodeScanning: Boolean(settings.allowBarcodeScanning),
    quantityColumnName: Boolean(settings.hasQuantityColumn)
      ? quantityColumnName.slice(0, 120)
      : "",
    defaultLocation,
    requiredColumnFields,
  };
  await getDb()
    .doc(`companies/${companyId}`)
    .update({ settings: allowed, updatedAt: FieldValue.serverTimestamp() });
  await secureAuditLogWrite({
    companyId,
    userId,
    action: "companySettingsUpdated",
    metadata: allowed,
  });
  return allowed;
});
