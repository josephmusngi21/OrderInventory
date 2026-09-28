import { CameraView, useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Sharing from "expo-sharing";
import { SymbolView } from "expo-symbols";
import { onAuthStateChanged } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth } from "@/../firebase/config";
import { logEvent } from "@/../services/auditService";
import { getCurrentUser, getUserAccess } from "@/../services/authService";
import { getCompanySettings } from "@/../services/companyService";
import {
  exportInventoryToExcel,
  getInventory,
  importExcel,
  saveInventory,
  submitInventoryForApproval,
} from "@/../services/inventoryService";
import { sendInventoryEmail } from "@/../services/submissionService";
import { FileUploader } from "@/components/file-uploader";
import {
  DEFAULT_INVENTORY_COLUMNS,
  InventoryRow,
  InventoryTable,
} from "@/components/inventory-table";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";

type ImportResult = {
  worksheetName: string;
  columns?: InventoryColumn[];
  rows: InventoryRow[];
};
type InventoryColumn = { label: string; field: string };
type InventoryResult = { rows: InventoryRow[]; columns?: InventoryColumn[] };

/** Provides the company inventory import, edit, save, and export workflow. */
export default function InventoryPage() {
  const { companyId } = useLocalSearchParams<{ companyId?: string }>();
  const navigation = useNavigation();
  const [activeCompanyId, setActiveCompanyId] = useState<string | undefined>(
    companyId,
  );
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recipients, setRecipients] = useState("");
  const [columns, setColumns] = useState<InventoryColumn[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [tableViewerOpen, setTableViewerOpen] = useState(false);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [visibleColumnFields, setVisibleColumnFields] = useState<string[]>([]);
  const [allowBarcodeScanning, setAllowBarcodeScanning] = useState(false);
  const [quantityColumnName, setQuantityColumnName] = useState("");
  const [defaultLocation, setDefaultLocation] = useState("");
  const [requiredColumnFields, setRequiredColumnFields] = useState<string[]>(
    [],
  );
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedValue, setScannedValue] = useState<string | null>(null);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [scannedMatch, setScannedMatch] = useState<InventoryRow | null>(null);
  const [newScannedValues, setNewScannedValues] = useState<
    Record<string, string>
  >({});
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannerLocked = useRef(false);
  const tableColumns = columns.length > 0 ? columns : DEFAULT_INVENTORY_COLUMNS;
  const requiredBarcodeColumns = tableColumns.filter((column) =>
    requiredColumnFields.includes(column.field),
  );
  const missingRequiredBarcodeColumns = requiredBarcodeColumns.filter(
    (column) => !String(newScannedValues[column.field] || "").trim(),
  );
  const visibleColumns =
    visibleColumnFields.length === 0
      ? tableColumns
      : tableColumns.filter((column) =>
          visibleColumnFields.includes(column.field),
        );

  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      ).catch(() => undefined);
      return () => {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => undefined);
      };
    }, []),
  );

  async function withSubmitTimeout<T>(operation: Promise<T>) {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error(
              "Inventory submission timed out after 20 seconds. Check the Functions deployment and connection.",
            ),
          ),
        20000,
      );
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setIsAdmin(false);
        setActiveCompanyId(undefined);
        setLoadingInventory(false);
        return;
      }
      setIsAdmin(false);
      getUserAccess(user.uid)
        .then((access) => {
          setIsAdmin(access?.role === "admin");
          const nextCompanyId = companyId || access?.companyId;
          setActiveCompanyId(nextCompanyId);
          if (!nextCompanyId) setLoadingInventory(false);
        })
        .catch(() => {
          setIsAdmin(false);
          setLoadingInventory(false);
        });
    });
  }, [companyId]);

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoadingInventory(true);
    getInventory(activeCompanyId)
      .then((inventory) => {
        const loaded = inventory as InventoryResult | InventoryRow[];
        if (Array.isArray(loaded)) {
          setRows(loaded);
          return;
        }
        setRows(loaded.rows || []);
        setColumns(loaded.columns || []);
      })
      .catch((error) =>
        setLoadError(
          error instanceof Error ? error.message : "Unable to load inventory.",
        ),
      )
      .finally(() => setLoadingInventory(false));
  }, [activeCompanyId]);

  const isInitialInventoryLoading = loadingInventory && !loadError;

  useEffect(() => {
    if (!activeCompanyId) return;
    getCompanySettings(activeCompanyId)
      .then((settings) => {
        setAllowBarcodeScanning(
          Boolean(
            (settings as { allowBarcodeScanning?: boolean })
              .allowBarcodeScanning,
          ),
        );
        setQuantityColumnName(
          String(
            (settings as { quantityColumnName?: string }).quantityColumnName ||
              "",
          ),
        );
        setDefaultLocation(
          String(
            (settings as { defaultLocation?: string }).defaultLocation ||
              (settings as { companyName?: string }).companyName ||
              "",
          ),
        );
        setRequiredColumnFields(
          Array.isArray(
            (settings as { requiredColumnFields?: unknown })
              .requiredColumnFields,
          )
            ? (settings as { requiredColumnFields: string[] })
                .requiredColumnFields
            : [],
        );
      })
      .catch(() => {
        setAllowBarcodeScanning(false);
        setQuantityColumnName("");
        setDefaultLocation("");
        setRequiredColumnFields([]);
      });
  }, [activeCompanyId]);

  useEffect(() => {
    setVisibleColumnFields((current) =>
      current.length === 0
        ? current
        : current.filter((field) =>
            tableColumns.some((column) => column.field === field),
          ),
    );
  }, [columns]);

  useEffect(() => {
    if (!isAdmin) setColumnPickerOpen(false);
  }, [isAdmin]);

  async function handleFile(file: { uri: string; name: string }) {
    setBusy(true);
    setImportError(null);
    setLoadError(null);
    setMessage(null);
    try {
      const result = (await importExcel(file, {
        quantityColumnName,
        defaultLocation,
      })) as ImportResult;
      setRows(result.rows);
      setColumns(result.columns || []);
      setImportOpen(false);
      setMessage(
        `${result.rows.length} rows loaded from ${result.worksheetName}.`,
      );
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Unable to read this workbook.",
      );
    } finally {
      setBusy(false);
    }
  }

  function addInventoryRow() {
    setRows((current) => [
      ...current,
      {
        itemCode: `NEW-${Date.now()}`,
        name: "",
        quantity: 0,
        customFields: {},
      },
    ]);
    setEditMode(true);
  }

  function addInventoryColumn() {
    const label = newColumnName.trim();
    if (!label) return;
    const field = `customFields.${label.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, character) => character.toUpperCase())}`;
    if (!columns.some((column) => column.field === field)) {
      setColumns((current) => [...current, { label, field }]);
    }
    setNewColumnName("");
    setEditMode(true);
  }

  function deleteInventoryRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function moveInventoryColumn(index: number, direction: "left" | "right") {
    setColumns((current) => {
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length)
        return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function deleteInventoryColumn(index: number) {
    setColumns((current) =>
      current.filter((_, columnIndex) => columnIndex !== index),
    );
  }

  async function handleSave() {
    const user = getCurrentUser();
    if (!user || !activeCompanyId)
      return setImportError(
        "A signed-in company member is required to save inventory.",
      );
    setBusy(true);
    console.log(
      `[inventory submit ${new Date().toISOString()}] started - role=${isAdmin ? "admin" : "member"}, companyId=${activeCompanyId}, rows=${rows.length}`,
    );
    try {
      if (isAdmin) {
        console.log(
          `[inventory submit ${new Date().toISOString()}] calling saveInventoryServer`,
        );
        const result = (await withSubmitTimeout(
          saveInventory(activeCompanyId, rows, tableColumns, user.uid),
        )) as {
          savedCount: number;
        };
        console.log(
          `[inventory submit ${new Date().toISOString()}] company inventory saved - rows=${result.savedCount}`,
        );
        console.log(
          `[inventory submit ${new Date().toISOString()}] auto-approved publish completed`,
        );
        setMessage(
          `${result.savedCount} inventory rows published to the company.`,
        );
      } else {
        console.log(
          `[inventory submit ${new Date().toISOString()}] calling submitInventoryForApprovalServer`,
        );
        const result = (await withSubmitTimeout(
          submitInventoryForApproval(activeCompanyId, rows, tableColumns),
        )) as {
          approvalId: string;
        };
        console.log(
          `[inventory submit ${new Date().toISOString()}] approval submitted - approvalId=${result.approvalId}`,
        );
        setMessage(
          `Inventory submitted for admin approval (${result.approvalId}).`,
        );
      }
    } catch (error) {
      console.error(
        `[inventory submit ${new Date().toISOString()}] failed`,
        error,
      );
      setImportError(
        error instanceof Error ? error.message : "Unable to save inventory.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    try {
      const result = await exportInventoryToExcel(rows);
      let auditAction: "download" | "share" = "download";
      if (Platform.OS === "web") {
        const blob = new Blob([result.data], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.fileName;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, result.fileName);
        file.write(result.data as Uint8Array);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: result.mimeType });
          auditAction = "share";
        }
      }
      const user = getCurrentUser();
      if (user && activeCompanyId) {
        await logEvent(activeCompanyId, user.uid, auditAction, {
          fileName: result.fileName,
          rowCount: rows.length,
        }).catch(() => undefined);
      }
      setMessage(`${result.fileName} is ready to download.`);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Unable to export inventory.",
      );
    }
  }

  async function handleSubmit() {
    if (!activeCompanyId)
      return setImportError("A company is required to submit inventory.");
    const recipientList = recipients
      .split(",")
      .map((recipient) => recipient.trim())
      .filter(Boolean);
    try {
      const result = (await sendInventoryEmail({
        companyId: activeCompanyId,
        rows,
        recipients: recipientList,
        subject: "Inventory submission",
        message: "Inventory submission from OrderInventory.",
      })) as { message?: string; status?: string };
      setMessage(result.message || "Inventory submission queued.");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Unable to submit inventory.",
      );
    }
  }

  async function openBarcodeScanner() {
    if (!allowBarcodeScanning) {
      setMessage("Barcode scanning is disabled in this company's settings.");
      return;
    }

    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();
    if (!permission.granted) {
      setMessage(
        permission.canAskAgain
          ? "Camera access is required to scan a barcode."
          : "Camera access is blocked. Enable it for OrderInventory in your device settings.",
      );
      return;
    }

    scannerLocked.current = false;
    setScannerOpen(true);
  }

  function handleBarcodeScanned(value: string) {
    if (scannerLocked.current) return;
    scannerLocked.current = true;
    const normalizedValue = value.trim().toLowerCase();
    const matchedRow = rows.find((row) =>
      [
        row.itemCode,
        ...Object.entries(row.customFields || {})
          .filter(([field]) => /barcode|ref|reference|id/i.test(field))
          .map(([, cell]) => cell),
      ].some((cell) => String(cell).trim().toLowerCase() === normalizedValue),
    );
    setScannerOpen(false);
    if (matchedRow) {
      setPendingBarcode(null);
      setScannedMatch(matchedRow);
      setMessage("Review the scanned inventory item before opening it.");
    } else {
      setScannedMatch(null);
      setPendingBarcode(value);
      setNewScannedValues(
        tableColumns.reduce<Record<string, string>>((result, column) => {
          result[column.field] = column.field === "itemCode" ? value : "";
          return result;
        }, {}),
      );
      setMessage(`Scanned ${value}. Complete and review the new item.`);
    }
  }

  function closeBarcodeScanner() {
    scannerLocked.current = false;
    setScannerOpen(false);
  }

  function openScannedMatch() {
    if (!scannedMatch) return;
    setScannedValue(scannedMatch.itemCode);
    setMessage(
      `${scannedMatch.name || scannedMatch.itemCode} is highlighted in the table.`,
    );
    setScannedMatch(null);
    setTableViewerOpen(true);
  }

  function formatItemName(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  function updateNewScannedValue(field: string, value: string) {
    setNewScannedValues((current) => ({ ...current, [field]: value }));
  }

  function addScannedItem() {
    if (!pendingBarcode) return;
    const name = formatItemName(newScannedValues.name || "");
    const missingRequiredColumn = tableColumns.find(
      (column) =>
        requiredColumnFields.includes(column.field) &&
        !String(newScannedValues[column.field] || "").trim(),
    );
    if (missingRequiredColumn) {
      setImportError(
        `Enter ${missingRequiredColumn.label} before adding this item.`,
      );
      return;
    }
    const newRow: InventoryRow = {
      itemCode: String(newScannedValues.itemCode || pendingBarcode).trim(),
      name: name || "Unnamed inventory item",
      quantity: Number(newScannedValues.quantity) || 1,
      location: String(newScannedValues.location || defaultLocation).trim(),
      customFields: {},
    };
    tableColumns.forEach((column) => {
      const value = String(newScannedValues[column.field] || "").trim();
      if (column.field.startsWith("customFields.")) {
        newRow.customFields![column.field.slice("customFields.".length)] =
          value;
      } else if (
        column.field !== "itemCode" &&
        column.field !== "name" &&
        column.field !== "quantity"
      ) {
        (newRow as unknown as Record<string, unknown>)[column.field] = value;
      }
    });
    setRows((current) => [...current, newRow]);
    setScannedValue(newRow.itemCode);
    setPendingBarcode(null);
    setNewScannedValues({});
    setImportError(null);
    setMessage(`${name} was added with a quantity of 1. Publish to save it.`);
  }

  function toggleVisibleColumn(field: string) {
    setVisibleColumnFields((current) => {
      const selected =
        current.length === 0
          ? tableColumns.map((column) => column.field)
          : current;
      if (selected.includes(field)) {
        return selected.length === 1
          ? selected
          : selected.filter((selectedField) => selectedField !== field);
      }
      return [...selected, field];
    });
  }

  function renderInventoryTable(fullBleed = false) {
    function getSourceColumnIndex(visibleIndex: number) {
      const field = visibleColumns[visibleIndex]?.field;
      return tableColumns.findIndex((column) => column.field === field);
    }

    return (
      <InventoryTable
        columns={visibleColumns}
        editMode={editMode}
        fullBleed={fullBleed}
        onChange={setRows}
        onDeleteColumn={
          isAdmin
            ? (visibleIndex) => {
                const sourceIndex = getSourceColumnIndex(visibleIndex);
                if (sourceIndex >= 0) deleteInventoryColumn(sourceIndex);
              }
            : undefined
        }
        onDeleteRow={deleteInventoryRow}
        onMoveColumn={
          isAdmin
            ? (visibleIndex, direction) => {
                const sourceIndex = getSourceColumnIndex(visibleIndex);
                if (sourceIndex >= 0)
                  moveInventoryColumn(sourceIndex, direction);
              }
            : undefined
        }
        rows={rows}
        selectedValue={scannedValue}
      />
    );
  }

  function openTableViewer() {
    setTableViewerOpen(true);
  }

  function closeTableViewer() {
    setTableViewerOpen(false);
  }

  useEffect(() => {
    if (!tableViewerOpen) return;
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    ).catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      ).catch(() => undefined);
    };
  }, [tableViewerOpen]);

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: tableViewerOpen ? { display: "none" } : undefined,
    });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [navigation, tableViewerOpen]);

  if (scannerOpen) {
    return (
      <RoleGuard role="member">
        <SafeAreaView className="flex-1 bg-[#102a43]" edges={["top", "bottom"]}>
          <View className="h-14 flex-row items-center justify-between px-4">
            <Text className="text-base font-black text-white">
              Scan barcode
            </Text>
            <Pressable
              accessibilityLabel="Close barcode scanner"
              className="h-9 flex-row items-center gap-1 rounded-lg border border-white/50 px-3"
              onPress={closeBarcodeScanner}
            >
              <SymbolView
                name={{ ios: "xmark", android: "close", web: "close" }}
                size={16}
                tintColor="#ffffff"
              />
              <Text className="text-xs font-bold text-white">Close</Text>
            </Pressable>
          </View>
          <CameraView
            barcodeScannerSettings={{
              barcodeTypes: [
                "ean13",
                "ean8",
                "upc_a",
                "upc_e",
                "code128",
                "code39",
                "qr",
              ],
            }}
            facing="back"
            onBarcodeScanned={({ data }) => handleBarcodeScanned(data)}
            style={{ flex: 1 }}
          />
          <View className="bg-[#102a43] px-5 py-4">
            <Text className="text-center text-sm font-semibold text-white">
              Align a product barcode within the camera view.
            </Text>
          </View>
        </SafeAreaView>
      </RoleGuard>
    );
  }

  if (tableViewerOpen) {
    return (
      <RoleGuard role="member">
        <SafeAreaView
          className="flex-1 bg-[#f4f1ea]"
          edges={["top", "bottom", "left"]}
        >
          <View className="h-14 flex-row items-center justify-between border-b border-[#d9d4ca] px-4">
            <Text className="text-base font-black text-[#102a43]">
              Inventory
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                accessibilityLabel="Exit table"
                className="h-9 flex-row items-center justify-center gap-1 rounded-lg border border-[#bcccdc] bg-[#fffdf8] px-3 active:bg-[#e8e2d7]"
                onPress={closeTableViewer}
              >
                <SymbolView
                  name={{ ios: "xmark", android: "close", web: "close" }}
                  size={16}
                  tintColor="#102a43"
                />
                <Text className="text-xs font-bold text-[#102a43]">Exit</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={
                  editMode ? "View rows" : "Edit proposed rows"
                }
                className="h-9 flex-row items-center justify-center gap-1 rounded-lg border border-[#bcccdc] bg-[#fffdf8] px-3 active:bg-[#e8e2d7]"
                onPress={() => setEditMode((current) => !current)}
              >
                <SymbolView
                  name={{ ios: "pencil", android: "edit", web: "edit" }}
                  size={16}
                  tintColor="#102a43"
                />
                <Text className="text-xs font-bold text-[#102a43]">
                  {editMode ? "View" : "Edit"}
                </Text>
              </Pressable>
              {isAdmin && (
                <Pressable
                  accessibilityLabel="Choose visible columns"
                  className="h-9 flex-row items-center justify-center gap-1 rounded-lg border border-[#bcccdc] bg-[#fffdf8] px-3 active:bg-[#e8e2d7]"
                  onPress={() => setColumnPickerOpen((current) => !current)}
                >
                  <SymbolView
                    name={{
                      ios: "rectangle.grid.2x2",
                      android: "view_column",
                      web: "view_column",
                    }}
                    size={16}
                    tintColor="#102a43"
                  />
                  <Text className="text-xs font-bold text-[#102a43]">
                    Columns
                  </Text>
                </Pressable>
              )}
              <Pressable
                accessibilityLabel={
                  isAdmin ? "Publish inventory" : "Send inventory to admin"
                }
                className={`h-9 flex-row items-center justify-center gap-1 rounded-lg bg-[#102a43] px-3 active:bg-[#243b53] ${!activeCompanyId || rows.length === 0 || busy ? "opacity-50" : ""}`}
                disabled={!activeCompanyId || rows.length === 0 || busy}
                onPress={handleSave}
              >
                <SymbolView
                  name={{
                    ios: isAdmin
                      ? "arrow.up.circle.fill"
                      : "checkmark.circle.fill",
                    android: isAdmin ? "publish" : "fact_check",
                    web: isAdmin ? "publish" : "fact_check",
                  }}
                  size={16}
                  tintColor="#ffffff"
                />
                <Text className="text-xs font-bold text-white">
                  {busy ? "Saving" : isAdmin ? "Publish" : "Review"}
                </Text>
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingRight: 12 }}>
            {isAdmin && columnPickerOpen && (
              <View className="mx-3 gap-2 rounded-lg border border-[#bcccdc] bg-[#fffdf8] p-3">
                <Text className="text-xs font-bold uppercase tracking-wider text-[#52606d]">
                  Visible columns
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {tableColumns.map((column) => {
                    const checked = visibleColumns.some(
                      (visibleColumn) => visibleColumn.field === column.field,
                    );
                    return (
                      <Pressable
                        key={column.field}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        className={`h-9 flex-row items-center gap-2 rounded-md border px-3 ${checked ? "border-[#102a43] bg-[#dcefe8]" : "border-[#bcccdc] bg-white"}`}
                        disabled={checked && visibleColumns.length === 1}
                        onPress={() => toggleVisibleColumn(column.field)}
                      >
                        <SymbolView
                          name={{
                            ios: checked ? "checkmark.square.fill" : "square",
                            android: checked
                              ? "check_box"
                              : "check_box_outline_blank",
                            web: checked
                              ? "check_box"
                              : "check_box_outline_blank",
                          }}
                          size={17}
                          tintColor={checked ? "#102a43" : "#52606d"}
                        />
                        <Text className="text-xs font-semibold text-[#102a43]">
                          {column.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {isAdmin && editMode && (
              <View className="gap-3 px-3">
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button onPress={addInventoryRow}>Add row</Button>
                  </View>
                  <TextInput
                    className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950"
                    onChangeText={setNewColumnName}
                    placeholder="New column name"
                    placeholderTextColor="#64748b"
                    style={{ color: "#0f172a" }}
                    value={newColumnName}
                  />
                  <Button variant="secondary" onPress={addInventoryColumn}>
                    Add column
                  </Button>
                </View>
              </View>
            )}
            {renderInventoryTable(true)}
          </ScrollView>
        </SafeAreaView>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard role="member">
      <Screen
        eyebrow="Inventory workspace"
        title="Keep stock moving"
        description="Import a workbook, make focused edits, and save a clear record of who changed each row."
      >
        {!activeCompanyId && !loadingInventory && (
          <View className="rounded-2xl bg-amber-50 p-4">
            <Text className="text-sm text-amber-900">
              Open this screen with a company ID after joining or signing in.
            </Text>
          </View>
        )}
        {loadError && (
          <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm font-semibold text-amber-900">
              Company inventory could not be loaded
            </Text>
            <Text className="mt-1 text-sm text-amber-800">{loadError}</Text>
          </View>
        )}
        {pendingBarcode && (
          <View className="gap-4 rounded-xl border border-emerald-400 bg-emerald-50 p-4">
            <Text className="text-sm font-bold text-[#102a43]">
              Review new inventory item
            </Text>
            <Text className="text-xs text-[#627d98]">
              Reference ID: {pendingBarcode}
            </Text>
            <View className="rounded-lg border border-emerald-200 bg-white p-3">
              {requiredBarcodeColumns.length === 0 ? (
                <Text className="text-sm text-[#52606d]">
                  All fields are optional for this company. The scanned
                  reference will be saved as the item ID.
                </Text>
              ) : missingRequiredBarcodeColumns.length === 0 ? (
                <Text className="text-sm font-semibold text-emerald-800">
                  Required details complete.
                </Text>
              ) : (
                <Text className="text-sm font-semibold text-amber-800">
                  Required before adding:{" "}
                  {missingRequiredBarcodeColumns
                    .map((column) => column.label)
                    .join(", ")}
                </Text>
              )}
              <Text className="mt-1 text-xs text-[#627d98]">
                Fields marked Required are set by your company administrator.
              </Text>
            </View>
            {tableColumns.map((column) => (
              <View key={column.field}>
                <Text className="mb-1 text-xs font-bold text-[#52606d]">
                  {column.label}
                  {requiredColumnFields.includes(column.field)
                    ? " Required"
                    : " Optional"}
                </Text>
                <TextInput
                  autoCapitalize={column.field === "name" ? "words" : "none"}
                  className={`rounded-xl border bg-white px-4 py-3 text-sm text-slate-950 ${requiredColumnFields.includes(column.field) && !String(newScannedValues[column.field] || "").trim() ? "border-amber-400" : "border-[#d9d4ca]"}`}
                  keyboardType={
                    column.field === "quantity" ? "numeric" : "default"
                  }
                  onChangeText={(value) =>
                    updateNewScannedValue(column.field, value)
                  }
                  onEndEditing={
                    column.field === "name"
                      ? () =>
                          updateNewScannedValue(
                            "name",
                            formatItemName(newScannedValues.name || ""),
                          )
                      : undefined
                  }
                  placeholder={
                    column.field === "itemCode"
                      ? pendingBarcode
                      : `Enter ${column.label}`
                  }
                  placeholderTextColor="#64748b"
                  style={{ color: "#0f172a" }}
                  value={newScannedValues[column.field] || ""}
                />
              </View>
            ))}
            <View className="gap-1 rounded-lg border border-emerald-200 bg-white p-3">
              <Text className="text-xs font-bold uppercase tracking-wider text-[#627d98]">
                New item preview
              </Text>
              <Text className="text-sm font-semibold text-[#102a43]">
                {formatItemName(newScannedValues.name || "") ||
                  "Unnamed inventory item"}
              </Text>
              <Text className="text-sm text-[#52606d]">
                Scanned reference: {pendingBarcode}
              </Text>
              {tableColumns.map((column) => (
                <Text key={column.field} className="text-sm text-[#52606d]">
                  {column.label}:{" "}
                  {column.field === "name"
                    ? formatItemName(newScannedValues.name || "") ||
                      "Not entered"
                    : newScannedValues[column.field] || "Not entered"}
                </Text>
              ))}
              {!tableColumns.some((column) => column.field === "quantity") && (
                <Text className="text-sm text-[#52606d]">Quantity: 1</Text>
              )}
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  disabled={missingRequiredBarcodeColumns.length > 0}
                  onPress={addScannedItem}
                >
                  Add item
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  onPress={() => setPendingBarcode(null)}
                  variant="secondary"
                >
                  Cancel
                </Button>
              </View>
            </View>
          </View>
        )}
        {scannedMatch && (
          <View className="gap-3 rounded-xl border border-emerald-400 bg-emerald-50 p-4">
            <Text className="text-sm font-bold text-[#102a43]">
              Scanned item found
            </Text>
            <View className="gap-1 rounded-lg border border-emerald-200 bg-white p-3">
              <Text className="text-sm font-semibold text-[#102a43]">
                {scannedMatch.name || "Unnamed inventory item"}
              </Text>
              <Text className="text-sm text-[#52606d]">
                Reference ID: {scannedMatch.itemCode}
              </Text>
              <Text className="text-sm text-[#52606d]">
                Quantity: {scannedMatch.quantity}
              </Text>
              {scannedMatch.location && (
                <Text className="text-sm text-[#52606d]">
                  Location: {scannedMatch.location}
                </Text>
              )}
              {scannedMatch.status && (
                <Text className="text-sm text-[#52606d]">
                  Status: {scannedMatch.status}
                </Text>
              )}
              {Object.entries(scannedMatch.customFields || {}).map(
                ([label, value]) => (
                  <Text key={label} className="text-sm text-[#52606d]">
                    {label}: {String(value)}
                  </Text>
                ),
              )}
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button onPress={openScannedMatch}>Open item</Button>
              </View>
              <View className="flex-1">
                <Button
                  onPress={() => setScannedMatch(null)}
                  variant="secondary"
                >
                  Cancel
                </Button>
              </View>
            </View>
          </View>
        )}
        <View className="gap-3 rounded-xl border border-[#d9d4ca] bg-[#fffdf8] p-4">
          <Text className="text-sm font-bold text-[#102a43]">
            Inventory overview
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[100px] flex-1 border-l-4 border-[#d95d39] pl-3">
              {isInitialInventoryLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <Text className="text-xl font-black text-[#102a43]">
                  {rows.length}
                </Text>
              )}
              <Text className="text-xs font-semibold text-[#627d98]">
                Items
              </Text>
            </View>
            <View className="min-w-[100px] flex-1 border-l-4 border-emerald-500 pl-3">
              {isInitialInventoryLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <Text className="text-xl font-black text-[#102a43]">
                  {rows.reduce(
                    (total, row) => total + (Number(row.quantity) || 0),
                    0,
                  )}
                </Text>
              )}
              <Text className="text-xs font-semibold text-[#627d98]">
                Units
              </Text>
            </View>
            <View className="min-w-[100px] flex-1 border-l-4 border-[#829ab1] pl-3">
              {isInitialInventoryLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <Text className="text-xl font-black text-[#102a43]">
                  {
                    new Set(rows.map((row) => row.location).filter(Boolean))
                      .size
                  }
                </Text>
              )}
              <Text className="text-xs font-semibold text-[#627d98]">
                Locations
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-3 border-t border-[#d9d4ca] pt-3">
            <View className="flex-1">
              <Text className="text-sm font-bold text-[#102a43]">
                Barcode lookup
              </Text>
              <Text className="mt-1 text-xs text-[#627d98]">
                {allowBarcodeScanning
                  ? scannedValue || "Scan an item to locate it in the table."
                  : "Ask an administrator to enable scanning in company settings."}
              </Text>
            </View>
            <Button
              disabled={!allowBarcodeScanning || isInitialInventoryLoading}
              onPress={openBarcodeScanner}
              variant="secondary"
            >
              Scan barcode
            </Button>
          </View>
        </View>
        <View className="gap-3">
          <View className="gap-4 md:flex-row md:items-center md:justify-between">
            <View>
              <Text className="text-sm font-bold uppercase tracking-wider text-[#52606d]">
                Inventory actions
              </Text>
              <Text className="mt-1 text-xs text-[#829ab1]">
                Manage the current company inventory below.
              </Text>
            </View>
          </View>
          <View className="rounded-xl border border-[#d9d4ca] bg-[#fffdf8] px-4 py-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-sm font-bold text-[#102a43]">
                  Import workbook
                </Text>
                {importOpen && (
                  <Text className="mt-1 text-xs text-[#627d98]">
                    Replace or add inventory rows from Excel.
                  </Text>
                )}
              </View>
              <Button
                variant="secondary"
                disabled={isInitialInventoryLoading}
                onPress={() => setImportOpen((current) => !current)}
              >
                {importOpen ? "Close" : "Import XLSX"}
              </Button>
            </View>
            {importOpen && (
              <View className="mt-3 gap-3">
                <FileUploader
                  busy={busy}
                  error={importError}
                  onFileSelected={handleFile}
                />
                <Button variant="secondary" onPress={handleExport}>
                  Export current XLSX
                </Button>
              </View>
            )}
          </View>
          {message && (
            <Text className="text-sm font-semibold text-emerald-700">
              {message}
            </Text>
          )}
          <View className="gap-3 border-t border-slate-100 pt-4">
            <Text className="text-sm font-semibold text-slate-700">
              Email inventory to selected people
            </Text>
            <TextInput
              className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950"
              keyboardType="email-address"
              onChangeText={setRecipients}
              placeholder="Recipients, separated by commas"
              placeholderTextColor="#64748b"
              style={{ color: "#0f172a" }}
              value={recipients}
            />
            <Button
              disabled={isInitialInventoryLoading}
              variant="secondary"
              onPress={handleSubmit}
            >
              Email selected people
            </Button>
          </View>
        </View>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-950">
              Inventory rows
            </Text>
            <Button
              disabled={isInitialInventoryLoading}
              onPress={openTableViewer}
            >
              View table
            </Button>
          </View>
        </View>
      </Screen>
    </RoleGuard>
  );
}
