const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  FieldValue,
  getDb,
  requireAuth,
  requireCompanyAdmin,
  requireCompanyMember,
} = require("./admin");

function sanitizeColumns(columns) {
  if (!Array.isArray(columns)) return [];
  return columns
    .filter(
      (column) =>
        column &&
        typeof column.label === "string" &&
        typeof column.field === "string",
    )
    .slice(0, 50)
    .map((column) => ({
      label: column.label.trim().slice(0, 120),
      field: column.field.trim().slice(0, 160),
    }))
    .filter((column) => column.label && column.field);
}

/** Reads company inventory after server-side membership validation. */
exports.getInventoryServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const companyId = request.data?.companyId;
  if (!companyId)
    throw new HttpsError("invalid-argument", "companyId is required.");
  await requireCompanyMember(companyId, userId);
  const snapshots = await getDb()
    .collection("inventoryItems")
    .where("companyId", "==", companyId)
    .get();
  const company = await getDb().doc(`companies/${companyId}`).get();
  return {
    rows: snapshots.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })),
    columns: sanitizeColumns(company.data()?.inventoryColumns),
  };
});

/** Publishes inventory through the Admin SDK after validating company membership. */
exports.saveInventoryServer = onCall(async (request) => {
  console.log(
    `[saveInventoryServer] started - uid=${request.auth?.uid || "anonymous"}`,
  );
  const userId = requireAuth(request);
  const { companyId, rows, columns } = request.data || {};
  if (!companyId || !Array.isArray(rows))
    throw new HttpsError(
      "invalid-argument",
      "Company and inventory rows are required.",
    );
  await requireCompanyAdmin(companyId, userId);
  console.log(
    `[saveInventoryServer] membership validated - companyId=${companyId}, rows=${rows.length}`,
  );
  const batch = getDb().batch();
  const inventoryColumns = sanitizeColumns(columns);
  for (const row of rows) {
    if (!row || !row.itemCode)
      throw new HttpsError(
        "invalid-argument",
        "Every inventory row requires an itemCode.",
      );
    const ref = getDb().doc(
      `inventoryItems/${companyId}_${encodeURIComponent(String(row.itemCode).trim())}`,
    );
    batch.set(
      ref,
      {
        ...row,
        companyId,
        itemCode: String(row.itemCode).trim(),
        createdAt: row.createdAt || FieldValue.serverTimestamp(),
        createdBy: row.createdBy || userId,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
        lastEditedAt: FieldValue.serverTimestamp(),
        lastEditedBy: userId,
      },
      { merge: true },
    );
  }
  batch.set(
    getDb().doc(`companies/${companyId}`),
    {
      inventoryColumns,
      inventoryColumnsUpdatedAt: FieldValue.serverTimestamp(),
      inventoryColumnsUpdatedBy: userId,
    },
    { merge: true },
  );
  const versionRef = getDb().collection("inventoryVersions").doc();
  batch.create(versionRef, {
    companyId,
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    rowCount: rows.length,
    rows,
    columns: inventoryColumns,
    source: "adminPublish",
  });
  await batch.commit();
  console.log(
    `[saveInventoryServer] inventory batch committed - companyId=${companyId}`,
  );
  console.log(`[saveInventoryServer] completed - companyId=${companyId}`);
  return { savedCount: rows.length, versionId: versionRef.id };
});
