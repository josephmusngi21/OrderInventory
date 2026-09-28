import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase/config";
import { exportToExcel } from "./excelExporter";
import { parseExcel } from "./excelParser";

/** Refreshes the callable Auth token before a protected Functions request. */
async function ensureCallableAuth() {
  const user = auth.currentUser;
  if (!user)
    throw new Error("Authentication is required for this inventory action.");
  await user.getIdToken(true);
  return user;
}

/** Reads and normalizes an Excel file locally before it is published. */
export async function importExcel(file, options) {
  return parseExcel(file, options);
}

/** Publishes inventory through the Admin SDK-backed callable Function. */
export async function saveInventory(companyId, rows, columns, userUid) {
  const currentUser = await ensureCallableAuth();
  if (!currentUser || currentUser.uid !== userUid) {
    throw new Error("The authenticated user could not be verified.");
  }
  if (!companyId || !Array.isArray(rows)) {
    throw new Error("A company and inventory rows are required.");
  }
  const call = httpsCallable(functions, "saveInventoryServer");
  console.log(
    `[inventory service ${new Date().toISOString()}] invoking saveInventoryServer - companyId=${companyId}, rows=${rows.length}`,
  );
  const result = await call({ companyId, rows, columns });
  console.log(
    `[inventory service ${new Date().toISOString()}] saveInventoryServer completed`,
  );
  return result.data;
}

/** Reads company inventory through the Admin SDK-backed callable Function. */
export async function getInventory(companyId) {
  await ensureCallableAuth();
  if (!companyId) throw new Error("A company is required to read inventory.");
  const call = httpsCallable(functions, "getInventoryServer");
  const result = await call({ companyId });
  return result.data;
}

/** Creates an XLSX payload from structured inventory rows. */
export async function exportInventoryToExcel(rows) {
  if (!auth.currentUser) {
    throw new Error("Authentication is required to export inventory.");
  }
  return exportToExcel(rows);
}

/** Loads immutable inventory snapshots through the authorized Function. */
export async function getInventoryVersions(companyId) {
  await ensureCallableAuth();
  const call = httpsCallable(functions, "getInventoryVersionsServer");
  const result = await call({ companyId });
  return result.data;
}

/** Submits member inventory and its original column schema for administrator approval. */
export async function submitInventoryForApproval(companyId, rows, columns) {
  await ensureCallableAuth();
  const call = httpsCallable(functions, "submitInventoryForApprovalServer");
  console.log(
    `[inventory service ${new Date().toISOString()}] invoking submitInventoryForApprovalServer - companyId=${companyId}, rows=${rows.length}`,
  );
  const result = await call({ companyId, rows, columns });
  console.log(
    `[inventory service ${new Date().toISOString()}] submitInventoryForApprovalServer completed`,
  );
  return result.data;
}

/** Loads pending admin inventory approvals. */
export async function getPendingInventoryApprovals(companyId) {
  await ensureCallableAuth();
  const call = httpsCallable(functions, "getPendingInventoryApprovalsServer");
  const result = await call({ companyId });
  return result.data;
}

/** Approves or rejects a pending inventory submission. */
export async function reviewInventoryApproval(companyId, approvalId, decision) {
  await ensureCallableAuth();
  const call = httpsCallable(functions, "reviewInventoryApprovalServer");
  const result = await call({ companyId, approvalId, decision });
  return result.data;
}
