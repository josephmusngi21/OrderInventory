import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase/config";

/**
 * Creates the client-side submission contract without sending email yet.
 * A trusted API or Firebase Function should implement the actual delivery.
 */
export async function sendInventoryEmail({
  companyId,
  rows,
  recipients,
  subject,
  message,
}) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication is required to submit inventory.");
  }
  if (
    !companyId ||
    !Array.isArray(rows) ||
    !Array.isArray(recipients) ||
    recipients.length === 0
  ) {
    throw new Error(
      "Company, inventory rows, and at least one recipient are required.",
    );
  }

  const call = httpsCallable(functions, "sendInventoryEmail");
  const result = await call({
    companyId,
    inventory: rows,
    recipients,
    subject: subject || "Inventory submission",
    message: message || "",
  });
  return result.data;
}
