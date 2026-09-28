const { sendInventoryEmail } = require("./email");
const { writeAuditEventServer, getAuditHistoryServer } = require("./audit");
const { getInventoryServer, saveInventoryServer } = require("./inventory");
const {
  getInventoryVersionsServer,
  submitInventoryForApprovalServer,
  getPendingInventoryApprovalsServer,
  reviewInventoryApprovalServer,
} = require("./inventoryVersions");
const {
  createCompanyServer,
  getCompanyMembersServer,
  removeCompanyMemberServer,
  updateAccountProfileServer,
  getCompanySettingsServer,
  updateCompanySettingsServer,
} = require("./companies");
const {
  deleteExpiredJoinCodes,
  generateJoinCodeServer,
  revokeJoinCode,
  validateJoinCodeServer,
} = require("./joinCodes");

// Export only callable entry points. secureAuditLogWrite remains internal.
exports.sendInventoryEmail = sendInventoryEmail;
exports.writeAuditEventServer = writeAuditEventServer;
exports.getAuditHistoryServer = getAuditHistoryServer;
exports.getInventoryServer = getInventoryServer;
exports.saveInventoryServer = saveInventoryServer;
exports.getInventoryVersionsServer = getInventoryVersionsServer;
exports.submitInventoryForApprovalServer = submitInventoryForApprovalServer;
exports.getPendingInventoryApprovalsServer = getPendingInventoryApprovalsServer;
exports.reviewInventoryApprovalServer = reviewInventoryApprovalServer;
exports.createCompanyServer = createCompanyServer;
exports.getCompanyMembersServer = getCompanyMembersServer;
exports.removeCompanyMemberServer = removeCompanyMemberServer;
exports.updateAccountProfileServer = updateAccountProfileServer;
exports.getCompanySettingsServer = getCompanySettingsServer;
exports.updateCompanySettingsServer = updateCompanySettingsServer;
exports.generateJoinCodeServer = generateJoinCodeServer;
exports.revokeJoinCode = revokeJoinCode;
exports.validateJoinCodeServer = validateJoinCodeServer;
exports.deleteExpiredJoinCodes = deleteExpiredJoinCodes;
