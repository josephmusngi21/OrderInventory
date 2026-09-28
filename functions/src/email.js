const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { requireAuth, requireCompanyMember } = require("./admin");
const { secureAuditLogWrite } = require("./audit");

/**
 * Queues an inventory email request and records submission activity.
 * Actual provider delivery is intentionally deferred until secrets are supplied.
 */
exports.sendInventoryEmail = onCall(async (request) => {
  const userId = requireAuth(request);
  const { companyId, inventory, recipients, subject, message, attachmentUrl } =
    request.data || {};
  if (
    !companyId ||
    !Array.isArray(inventory) ||
    !Array.isArray(recipients) ||
    recipients.length === 0
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Company, inventory, and recipients are required.",
    );
  }
  await requireCompanyMember(companyId, userId);

  const submissionId = `pending-${Date.now()}-${userId.slice(0, 8)}`;
  await secureAuditLogWrite({
    companyId,
    userId,
    action: "submit",
    metadata: {
      submissionId,
      rowCount: inventory.length,
      recipientCount: recipients.length,
      subject: subject || "Inventory submission",
      attachmentUrl: attachmentUrl || "",
      message: message || "",
    },
  });

  return {
    submissionId,
    status: "queued",
    provider: "placeholder",
    message: "Inventory email queued; provider delivery is not configured yet.",
  };
});
