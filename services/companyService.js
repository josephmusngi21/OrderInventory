import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase/config";

/** @typedef {{ companyId: string, joinCode: { joinCodeId: string, companyId: string, code: string, expiresAt: string } }} CompanyCreationResult */
/** @typedef {{ joinCodeId: string, companyId: string, code: string, expiresAt: string }} JoinCodeResult */
/** @typedef {{ joinCodeId: string, companyId: string, expiresAt: string }} JoinValidationResult */

/** Creates a company through the trusted server-side provisioning function. */
/** @returns {Promise<CompanyCreationResult>} */
export async function createCompany(companyName, adminUid, displayName) {
  if (!auth.currentUser || auth.currentUser.uid !== adminUid) {
    throw new Error("The authenticated user could not be verified.");
  }
  const call = httpsCallable(functions, "createCompanyServer");
  try {
    const result = await call({ companyName, displayName });
    return /** @type {CompanyCreationResult} */ (result.data);
  } catch (error) {
    if (error?.code === "functions/not-found" || error?.code === "not-found") {
      throw new Error(
        "Company setup is not deployed yet. Run firebase login, then firebase deploy --only functions.",
      );
    }
    throw error;
  }
}

/** Generates a join code through the admin-only trusted Function. */
/** @returns {Promise<JoinCodeResult>} */
export async function generateJoinCode(adminUid) {
  if (!auth.currentUser || auth.currentUser.uid !== adminUid) {
    throw new Error("The authenticated administrator could not be verified.");
  }
  const call = httpsCallable(functions, "generateJoinCodeServer");
  const result = await call({});
  return /** @type {JoinCodeResult} */ (result.data);
}

/** Validates a join code through the trusted Function without client-side reads. */
/** @returns {Promise<JoinValidationResult>} */
export async function validateJoinCode(code, displayName) {
  if (!code || !code.trim()) {
    throw new Error("A join code is required.");
  }
  const call = httpsCallable(functions, "validateJoinCodeServer");
  const result = await call({ code, displayName });
  return /** @type {JoinValidationResult} */ (result.data);
}

/** Returns company members to the authenticated company's administrator. */
export async function getCompanyMembers(companyId) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication is required to view company members.");
  }
  const call = httpsCallable(functions, "getCompanyMembersServer");
  const result = await call({ companyId });
  return result.data;
}

/** Removes a member through the admin-only server operation. */
export async function removeCompanyMember(companyId, memberId) {
  const call = httpsCallable(functions, "removeCompanyMemberServer");
  const result = await call({ companyId, memberId });
  return result.data;
}

/** Updates the current user's name in Firebase Auth and company profile records. */
export async function updateAccountProfile(displayName) {
  const call = httpsCallable(functions, "updateAccountProfileServer");
  const result = await call({ displayName });
  return result.data;
}

/** Reads company-wide settings for the current member. */
export async function getCompanySettings(companyId) {
  const call = httpsCallable(functions, "getCompanySettingsServer");
  const result = await call({ companyId });
  return result.data;
}

/** Updates company-wide settings through the admin-only server operation. */
export async function updateCompanySettings(companyId, settings) {
  const call = httpsCallable(functions, "updateCompanySettingsServer");
  const result = await call({ companyId, settings });
  return result.data;
}
