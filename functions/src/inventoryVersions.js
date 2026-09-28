const { onCall } = require("firebase-functions/v2/https");
const {
  FieldValue,
  adminAuth,
  getDb,
  requireAuth,
  requireCompanyMember,
} = require("./admin");
const { secureAuditLogWrite } = require("./audit");

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

function rowKey(row, index) {
  return String(row?.itemCode || row?.id || `row-${index}`);
}

function flattenRow(value, prefix = "", target = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, child]) => {
      if (
        [
          "id",
          "companyId",
          "createdAt",
          "createdBy",
          "updatedAt",
          "updatedBy",
          "lastEditedAt",
          "lastEditedBy",
        ].includes(key)
      ) {
        return;
      }
      flattenRow(child, prefix ? `${prefix}.${key}` : key, target);
    });
  } else {
    target[prefix] = value ?? "";
  }
  return target;
}

function formatFieldLabel(field) {
  return field
    .replace(/^customFields\./, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}

function getChangedFields(current, previous) {
  const currentValues = flattenRow(current);
  const previousValues = flattenRow(previous);
  const fields = new Set([
    ...Object.keys(currentValues),
    ...Object.keys(previousValues),
  ]);
  return [...fields]
    .filter(
      (field) =>
        JSON.stringify(currentValues[field] ?? "") !==
        JSON.stringify(previousValues[field] ?? ""),
    )
    .slice(0, 20)
    .map((field) => ({
      field: formatFieldLabel(field),
      before: String(previousValues[field] ?? "") || "Empty",
      after: String(currentValues[field] ?? "") || "Empty",
    }));
}

function getRowValue(row, field) {
  if (field.startsWith("customFields.")) {
    return row?.customFields?.[field.slice("customFields.".length)] ?? "";
  }
  return row?.[field] ?? "";
}

function getRequiredDetails(row, requiredFields, columns) {
  return requiredFields
    .map((field) => ({
      field,
      label: columns.find((column) => column.field === field)?.label || field,
      value: String(getRowValue(row, field)).trim(),
    }))
    .filter((detail) => detail.value)
    .slice(0, 10);
}

function compareVersions(
  currentRows = [],
  previousRows = [],
  requiredFields = [],
  columns = [],
) {
  const previousByKey = new Map(
    previousRows.map((row, index) => [rowKey(row, index), row]),
  );
  const currentByKey = new Map(
    currentRows.map((row, index) => [rowKey(row, index), row]),
  );
  const changes = [];

  currentByKey.forEach((row, key) => {
    const previous = previousByKey.get(key);
    if (!previous) {
      changes.push({
        type: "added",
        itemCode: key,
        name: row.name || "",
        row,
        requiredDetails: getRequiredDetails(row, requiredFields, columns),
      });
    } else {
      const fields = getChangedFields(row, previous);
      if (fields.length > 0) {
        changes.push({
          type: "edited",
          itemCode: key,
          name: row.name || "",
          row,
          fields,
          requiredDetails: getRequiredDetails(row, requiredFields, columns),
        });
      }
    }
  });
  previousByKey.forEach((row, key) => {
    if (!currentByKey.has(key)) {
      changes.push({
        type: "removed",
        itemCode: key,
        name: row.name || "",
        row,
        requiredDetails: getRequiredDetails(row, requiredFields, columns),
      });
    }
  });
  return changes;
}

async function getPerson(userId) {
  if (!userId) return { name: "", email: "" };
  try {
    const user = await adminAuth.getUser(userId);
    return { name: user.displayName || "", email: user.email || "" };
  } catch {
    return { name: "", email: "" };
  }
}

/** Returns immutable inventory snapshots for an authorized company member. */
exports.getInventoryVersionsServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const companyId = request.data?.companyId;
  if (!companyId) throw new Error("companyId is required.");
  await requireCompanyMember(companyId, userId);
  const company = await getDb().doc(`companies/${companyId}`).get();
  const requiredFields = Array.isArray(
    company.data()?.settings?.requiredColumnFields,
  )
    ? company.data().settings.requiredColumnFields
    : [];
  const snapshots = await getDb()
    .collection("inventoryVersions")
    .where("companyId", "==", companyId)
    .get();
  const versions = snapshots.docs
    .sort(
      (left, right) =>
        timestampMillis(right.data().createdAt) -
        timestampMillis(left.data().createdAt),
    )
    .slice(0, 50)
    .map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    }));
  return Promise.all(
    versions.map(async (version, index) => {
      const creator = await getPerson(version.createdBy);
      const submitter = await getPerson(version.submittedBy);
      const reviewer = await getPerson(version.reviewedBy);
      const previousVersion = versions[index + 1];
      const changes = previousVersion
        ? compareVersions(
            version.rows,
            previousVersion.rows,
            requiredFields,
            sanitizeColumns(version.columns || previousVersion.columns),
          )
        : [];
      const { rows, ...versionSummary } = version;
      return {
        ...versionSummary,
        createdAt: timestampIso(version.createdAt),
        submittedAt: timestampIso(version.submittedAt),
        reviewedAt: timestampIso(version.reviewedAt),
        creatorName: creator.name,
        creatorEmail: creator.email,
        submitterName: submitter.name,
        submitterEmail: submitter.email,
        reviewerName: reviewer.name,
        reviewerEmail: reviewer.email,
        changes,
        isBaseline: !previousVersion,
        changeSummary: {
          added: changes.filter((change) => change.type === "added").length,
          removed: changes.filter((change) => change.type === "removed").length,
          edited: changes.filter((change) => change.type === "edited").length,
        },
      };
    }),
  );
});

/** Submits a member's inventory draft for administrator review. */
exports.submitInventoryForApprovalServer = onCall(async (request) => {
  console.log(
    `[submitInventoryForApprovalServer] started - uid=${request.auth?.uid || "anonymous"}`,
  );
  const userId = requireAuth(request);
  const { companyId, rows, columns } = request.data || {};
  if (!companyId || !Array.isArray(rows))
    throw new Error("Company and inventory rows are required.");
  await requireCompanyMember(companyId, userId);
  console.log(
    `[submitInventoryForApprovalServer] membership validated - companyId=${companyId}, rows=${rows.length}`,
  );
  const ref = getDb().collection("inventoryApprovals").doc();
  await ref.create({
    companyId,
    submittedBy: userId,
    submittedAt: FieldValue.serverTimestamp(),
    status: "pending",
    rows,
    columns: sanitizeColumns(columns),
    rowCount: rows.length,
  });
  console.log(
    `[submitInventoryForApprovalServer] approval created - approvalId=${ref.id}`,
  );
  await secureAuditLogWrite({
    companyId,
    userId,
    action: "inventorySubmittedForApproval",
    metadata: { approvalId: ref.id, rowCount: rows.length },
  });
  console.log(
    `[submitInventoryForApprovalServer] completed - approvalId=${ref.id}`,
  );
  return { approvalId: ref.id, status: "pending" };
});

/** Lists pending inventory drafts for an administrator. */
exports.getPendingInventoryApprovalsServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const companyId = request.data?.companyId;
  if (!companyId) throw new Error("companyId is required.");
  const membership = await getDb()
    .doc(`companies/${companyId}/memberships/${userId}`)
    .get();
  if (
    !membership.exists ||
    membership.data().status !== "active" ||
    membership.data().role !== "admin"
  )
    throw new Error("Only company administrators can review inventory.");
  const company = await getDb().doc(`companies/${companyId}`).get();
  const requiredFields = Array.isArray(
    company.data()?.settings?.requiredColumnFields,
  )
    ? company.data().settings.requiredColumnFields
    : [];
  const currentInventory = await getDb()
    .collection("inventoryItems")
    .where("companyId", "==", companyId)
    .get();
  const currentRows = currentInventory.docs.map((snapshot) => snapshot.data());
  const snapshots = await getDb()
    .collection("inventoryApprovals")
    .where("companyId", "==", companyId)
    .get();
  return Promise.all(
    snapshots.docs
      .filter((snapshot) => snapshot.data().status === "pending")
      .sort(
        (left, right) =>
          timestampMillis(right.data().submittedAt) -
          timestampMillis(left.data().submittedAt),
      )
      .slice(0, 25)
      .map(async (snapshot) => {
        const approval = snapshot.data();
        const submitter = await getPerson(approval.submittedBy);
        const columns = sanitizeColumns(approval.columns);
        const changes = compareVersions(
          approval.rows,
          currentRows,
          requiredFields,
          columns,
        );
        return {
          id: snapshot.id,
          ...approval,
          columns,
          submitterName: submitter.name,
          submitterEmail: submitter.email,
          changes,
          changeSummary: {
            added: changes.filter((change) => change.type === "added").length,
            removed: changes.filter((change) => change.type === "removed")
              .length,
            edited: changes.filter((change) => change.type === "edited").length,
          },
        };
      }),
  );
});

/** Approves or rejects a pending inventory draft; approval publishes it. */
exports.reviewInventoryApprovalServer = onCall(async (request) => {
  const userId = requireAuth(request);
  const { companyId, approvalId, decision, note = "" } = request.data || {};
  if (!companyId || !approvalId || !["approved", "rejected"].includes(decision))
    throw new Error("A valid approval decision is required.");
  const membership = await getDb()
    .doc(`companies/${companyId}/memberships/${userId}`)
    .get();
  if (
    !membership.exists ||
    membership.data().status !== "active" ||
    membership.data().role !== "admin"
  )
    throw new Error("Only company administrators can review inventory.");
  const approvalRef = getDb().doc(`inventoryApprovals/${approvalId}`);
  const approval = await approvalRef.get();
  if (
    !approval.exists ||
    approval.data().companyId !== companyId ||
    approval.data().status !== "pending"
  )
    throw new Error("Pending inventory submission not found.");
  const data = approval.data();
  const batch = getDb().batch();
  if (decision === "approved") {
    for (const row of data.rows) {
      if (!row.itemCode) continue;
      batch.set(
        getDb().doc(
          `inventoryItems/${companyId}_${encodeURIComponent(String(row.itemCode).trim())}`,
        ),
        {
          ...row,
          companyId,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: data.submittedBy,
          lastEditedAt: FieldValue.serverTimestamp(),
          lastEditedBy: data.submittedBy,
        },
        { merge: true },
      );
    }
    batch.set(
      getDb().doc(`companies/${companyId}`),
      {
        inventoryColumns: sanitizeColumns(data.columns),
        inventoryColumnsUpdatedAt: FieldValue.serverTimestamp(),
        inventoryColumnsUpdatedBy: data.submittedBy,
      },
      { merge: true },
    );
    const versionRef = getDb().collection("inventoryVersions").doc();
    batch.create(versionRef, {
      companyId,
      createdBy: data.submittedBy,
      createdAt: FieldValue.serverTimestamp(),
      rowCount: data.rows.length,
      rows: data.rows,
      columns: sanitizeColumns(data.columns),
      source: "memberApproval",
      submittedBy: data.submittedBy,
      submittedAt: data.submittedAt || FieldValue.serverTimestamp(),
      reviewedBy: userId,
      reviewedAt: FieldValue.serverTimestamp(),
    });
  }
  batch.update(approvalRef, {
    status: decision,
    reviewedBy: userId,
    reviewedAt: FieldValue.serverTimestamp(),
    reviewNote: String(note).slice(0, 500),
  });
  await batch.commit();
  await secureAuditLogWrite({
    companyId,
    userId,
    action: decision === "approved" ? "inventoryApproved" : "inventoryRejected",
    metadata: { approvalId, note },
  });
  return { approvalId, status: decision };
});
