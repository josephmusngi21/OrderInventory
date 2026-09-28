import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase/config";

/** Writes an append-only audit event for an authenticated company user. */
export async function logEvent(companyId, userUid, action, metadata = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userUid)
    throw new Error("An authenticated user is required to log an event.");
  const call = httpsCallable(functions, "writeAuditEventServer");
  const result = await call({
    companyId: companyId || null,
    action,
    metadata,
    success: metadata.success !== false,
  });
  return result.data;
}

/** Returns chronological audit history for an administrator of the company. */
export async function getHistory(companyId) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication is required to view history.");
  }
  const call = httpsCallable(functions, "getAuditHistoryServer");
  const result = await call({ companyId });
  return result.data;
}
