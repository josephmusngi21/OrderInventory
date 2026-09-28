const {
  FieldValue,
  getDb,
  requireCompanyMember,
  adminAuth,
} = require("./admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return new Date(value).getTime() || 0;
}

function timestampIso(value) {
  const milliseconds = timestampMillis(value);
  return milliseconds ? new Date(milliseconds).toISOString() : null;
}

const VALID_ACTIONS = new Set([
  "open",
  "edit",
  "download",
  "share",
  "submit",
  "import",
  "login",
  "signup",
  "companyCreated",
  "joinAttempt",
  "joinSuccess",
  "joinCodeGenerated",
  "joinCodeRevoked",
  "memberRemoved",
  "companySettingsUpdated",
  "inventorySubmittedForApproval",
  "inventoryApproved",
  "inventoryRejected",
  "inventoryAutoApproved",
  "memberRemoved",
  "companySettingsUpdated",
]);

const INVENTORY_CHANGE_ACTIONS = new Set([
  "edit",
  "import",
  "inventoryApproved",
  "inventoryAutoApproved",
]);

const HIDDEN_AUDIT_ACTIONS = new Set(["joinCodeGenerated", "joinCodeRevoked"]);

/** Removes secrets and limits untrusted metadata before it reaches an audit log. */
function sanitizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const blockedKey = /(password|token|secret|rawcode|codehash|authorization)/i;
  return Object.entries(metadata).reduce((result, [key, value]) => {
    if (blockedKey.test(key)) return result;
    if (["string", "number", "boolean"].includes(typeof value)) {
      result[key.slice(0, 80)] = String(value).slice(0, 500);
    }
    return result;
  }, {});
}

/** Writes an immutable audit record using Admin SDK credentials only. */
async function secureAuditLogWrite({
  companyId = null,
  userId = null,
  action,
  metadata = {},
  success = true,
}) {
  if (!VALID_ACTIONS.has(action)) {
    throw new Error("Unsupported audit action.");
  }
  if (companyId !== null && typeof companyId !== "string") {
    throw new Error("Invalid audit company ID.");
  }
  if (companyId !== null && userId) {
    await requireCompanyMember(companyId, userId);
  }

  const db = getDb();
  const eventRef = db.collection("auditLogs").doc();
  let actor = null;
  if (userId) {
    try {
      actor = await adminAuth.getUser(userId);
    } catch {
      actor = null;
    }
  }
  await eventRef.create({
    companyId,
    actorId: userId,
    actorEmail: actor?.email || null,
    actorName: actor?.displayName || null,
    action,
    success: Boolean(success),
    metadata: sanitizeMetadata(metadata),
    createdAt: FieldValue.serverTimestamp(),
  });
  return eventRef.id;
}

/** Accepts approved client activity and writes it through the trusted audit path. */
exports.writeAuditEventServer = onCall(async (request) => {
  if (!request.auth?.uid)
    throw new HttpsError("unauthenticated", "Authentication is required.");
  const {
    companyId = null,
    action,
    metadata = {},
    success = true,
  } = request.data || {};
  try {
    const eventId = await secureAuditLogWrite({
      companyId,
      userId: request.auth.uid,
      action,
      metadata,
      success,
    });
    return { eventId };
  } catch (error) {
    throw new HttpsError(
      "permission-denied",
      error instanceof Error ? error.message : "Audit event rejected.",
    );
  }
});

/** Returns company audit history after enforcing the administrator role server-side. */
exports.getAuditHistoryServer = onCall(async (request) => {
  if (!request.auth?.uid)
    throw new HttpsError("unauthenticated", "Authentication is required.");
  const companyId = request.data?.companyId;
  if (!companyId)
    throw new HttpsError("invalid-argument", "companyId is required.");
  const membership = await getDb()
    .doc(`companies/${companyId}/memberships/${request.auth.uid}`)
    .get();
  if (
    !membership.exists ||
    membership.data().status !== "active" ||
    membership.data().role !== "admin"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only company administrators can view audit history.",
    );
  }
  const snapshots = await getDb()
    .collection("auditLogs")
    .where("companyId", "==", companyId)
    .get();
  const events = snapshots.docs
    .filter(
      (snapshot) =>
        !INVENTORY_CHANGE_ACTIONS.has(snapshot.data().action) &&
        !HIDDEN_AUDIT_ACTIONS.has(snapshot.data().action),
    )
    .sort(
      (left, right) =>
        timestampMillis(right.data().createdAt) -
        timestampMillis(left.data().createdAt),
    )
    .slice(0, 200)
    .map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        ...data,
        createdAt: timestampIso(data.createdAt),
      };
    });
  return Promise.all(
    events.map(async (event) => {
      if (!event.actorId) return event;
      let actorName = event.actorName || "";
      let actorEmail = event.actorEmail || "";
      try {
        const member = await getDb()
          .doc(`companies/${companyId}/memberships/${event.actorId}`)
          .get();
        actorName = actorName || member.data()?.displayName || "";
        actorEmail = actorEmail || member.data()?.email || "";
      } catch {}
      if (!actorName || !actorEmail) {
        try {
          const actor = await adminAuth.getUser(event.actorId);
          actorName = actorName || actor.displayName || "";
          actorEmail = actorEmail || actor.email || "";
        } catch {}
      }
      return {
        ...event,
        actorName: actorName || null,
        actorEmail: actorEmail || null,
      };
    }),
  );
});

module.exports = {
  secureAuditLogWrite,
  sanitizeMetadata,
  timestampMillis,
  timestampIso,
  VALID_ACTIONS,
  INVENTORY_CHANGE_ACTIONS,
  HIDDEN_AUDIT_ACTIONS,
  writeAuditEventServer: exports.writeAuditEventServer,
  getAuditHistoryServer: exports.getAuditHistoryServer,
};
