import { useEffect, useState } from "react";
import {
    Alert,
    LayoutChangeEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export type InventoryRow = {
  id?: string;
  itemCode: string;
  name: string;
  description?: string;
  category?: string;
  quantity: number;
  unit?: string;
  location?: string;
  status?: string;
  customFields?: Record<string, unknown>;
  lastEditedBy?: string;
  lastEditedAt?: { toDate?: () => Date } | Date | string | null;
};

type InventoryTableProps = {
  rows: InventoryRow[];
  onChange: (rows: InventoryRow[]) => void;
  columns?: { label: string; field: string }[];
  editMode?: boolean;
  onDeleteRow?: (index: number) => void;
  onMoveColumn?: (index: number, direction: "left" | "right") => void;
  onDeleteColumn?: (index: number) => void;
  fullBleed?: boolean;
  selectedValue?: string | null;
  rowChangeTypes?: Record<string, "added" | "removed" | "edited">;
  selectableRows?: boolean;
};

export const DEFAULT_INVENTORY_COLUMNS = [
  { label: "Item", field: "itemCode" },
  { label: "Name", field: "name" },
  { label: "Quantity", field: "quantity" },
  { label: "Location", field: "location" },
];

function formatEditedAt(value: InventoryRow["lastEditedAt"]) {
  if (!value) return "Not edited yet";
  const date =
    typeof value === "object" && "toDate" in value && value.toDate
      ? value.toDate()
      : value;
  return date instanceof Date ? date.toLocaleString() : String(date);
}

/** Reads either a normalized inventory field or a preserved custom field. */
function getCellValue(row: InventoryRow, field: string) {
  if (field.startsWith("customFields.")) {
    return row.customFields?.[field.slice("customFields.".length)] ?? "";
  }
  return (row as unknown as Record<string, unknown>)[field] ?? "";
}

/** Renders editable inventory rows and highlights rows changed in this session. */
export function InventoryTable({
  rows,
  onChange,
  columns = DEFAULT_INVENTORY_COLUMNS,
  editMode = false,
  onDeleteRow,
  onMoveColumn,
  onDeleteColumn,
  fullBleed = false,
  selectedValue = null,
  rowChangeTypes = {},
  selectableRows = true,
}: InventoryTableProps) {
  const [modifiedIds, setModifiedIds] = useState<string[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const safeRows = rows.filter((row): row is InventoryRow => Boolean(row));
  const displayedColumnCount =
    columns.length +
    1 +
    (editMode ? 1 : 0) +
    (selectableRows && selectedRowId ? 1 : 0);
  const minimumColumnWidth = editMode ? 140 : 96;
  const tableWidth = fullBleed
    ? Math.max(viewportWidth, displayedColumnCount * minimumColumnWidth)
    : 900;
  const columnWidth = fullBleed ? tableWidth / displayedColumnCount : 180;

  function handleTableLayout(event: LayoutChangeEvent) {
    setViewportWidth(event.nativeEvent.layout.width);
  }

  useEffect(() => {
    if (!selectedValue) return;
    const normalizedValue = selectedValue.trim().toLowerCase();
    const matchedIndex = safeRows.findIndex((row) =>
      [row.itemCode, ...Object.values(row.customFields || {})].some(
        (value) => String(value).trim().toLowerCase() === normalizedValue,
      ),
    );
    if (matchedIndex < 0) return setSelectedRowId(null);
    const matchedRow = safeRows[matchedIndex];
    const rowId =
      matchedRow.id || matchedRow.itemCode || `inventory-row-${matchedIndex}`;
    setSelectedRowId(`${rowId}-${matchedIndex}`);
  }, [rows, selectedValue]);

  function updateRow(row: InventoryRow, field: string, value: string) {
    const sourceIndex = rows.indexOf(row);
    if (sourceIndex < 0) return;
    const nextRows = rows.map((row, rowIndex) => {
      if (rowIndex !== sourceIndex) return row;
      if (field.startsWith("customFields.")) {
        const customField = field.slice("customFields.".length);
        return {
          ...row,
          customFields: { ...row.customFields, [customField]: value },
        };
      }
      return {
        ...row,
        [field]: field === "quantity" ? Number(value) || 0 : value,
      };
    });
    const rowId = `${row.id || row.itemCode || `inventory-row-${sourceIndex}`}-${sourceIndex}`;
    setModifiedIds((current) =>
      current.includes(rowId) ? current : [...current, rowId],
    );
    onChange(nextRows);
  }

  function confirmDeleteRow(row: InventoryRow) {
    const sourceIndex = rows.indexOf(row);
    if (sourceIndex < 0 || !onDeleteRow) return;
    Alert.alert(
      "Remove inventory row",
      `Remove ${row.name || row.itemCode || "this item"} from this proposed inventory?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onDeleteRow(sourceIndex),
        },
      ],
    );
  }

  if (safeRows.length === 0) {
    return (
      <View className="rounded-3xl border border-slate-200 bg-white px-6 py-12">
        <Text className="text-center text-base font-semibold text-slate-900">
          No inventory yet
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Import an Excel workbook to start editing your stock list.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      contentContainerStyle={{ flexGrow: 1 }}
      onLayout={handleTableLayout}
      showsHorizontalScrollIndicator={false}
    >
      <View
        className={
          fullBleed
            ? "overflow-hidden rounded-xl border-2 border-[#829ab1] bg-white"
            : "min-w-[900px] flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white"
        }
        style={fullBleed ? { width: tableWidth } : undefined}
      >
        <View
          className="flex-row bg-slate-900 px-4 py-3"
          style={fullBleed ? styles.fullBleedRow : undefined}
        >
          {[...columns, { label: "Last edited", field: "__lastEdited" }].map(
            ({ label, field }, columnIndex) => (
              <View key={field} style={{ width: columnWidth }}>
                <Text className="text-xs font-bold uppercase tracking-wider text-white">
                  {label}
                </Text>
                {editMode && field !== "__lastEdited" && (
                  <View className="mt-2 flex-row gap-1">
                    <Pressable
                      disabled={columnIndex === 0}
                      onPress={() => onMoveColumn?.(columnIndex, "left")}
                    >
                      <Text className="text-xs text-emerald-200">←</Text>
                    </Pressable>
                    <Pressable
                      disabled={columnIndex === columns.length - 1}
                      onPress={() => onMoveColumn?.(columnIndex, "right")}
                    >
                      <Text className="text-xs text-emerald-200">→</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteColumn?.(columnIndex)}>
                      <Text className="text-xs text-rose-300">×</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ),
          )}
          {editMode && (
            <View style={{ width: columnWidth }}>
              <Text className="text-xs font-bold uppercase tracking-wider text-white">
                Remove
              </Text>
            </View>
          )}
        </View>
        {safeRows.map((row, index) => {
          const rowId = row.id || row.itemCode || `inventory-row-${index}`;
          const stableRowId = `${rowId}-${index}`;
          const modified = modifiedIds.includes(stableRowId);
          const changeType = rowChangeTypes[String(row.itemCode)];
          return (
            <Pressable
              key={stableRowId}
              disabled={editMode || !selectableRows}
              onPress={
                selectableRows ? () => setSelectedRowId(stableRowId) : undefined
              }
              style={[
                styles.row,
                fullBleed && styles.fullBleedRow,
                modified && styles.modifiedRow,
                changeType === "added" && styles.addedRow,
                changeType === "removed" && styles.removedRow,
                changeType === "edited" && styles.editedRow,
                selectableRows &&
                  !editMode &&
                  selectedRowId === stableRowId &&
                  styles.selectedRow,
              ]}
            >
              {columns.map(({ field }) =>
                editMode ? (
                  <TextInput
                    key={field}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    keyboardType={field === "quantity" ? "numeric" : "default"}
                    placeholderTextColor="#64748b"
                    style={{
                      color: "#0f172a",
                      marginRight: fullBleed ? 0 : 8,
                      width: fullBleed ? columnWidth : 178,
                    }}
                    value={String(getCellValue(row, field))}
                    onChangeText={(value) => updateRow(row, field, value)}
                  />
                ) : (
                  <View
                    key={field}
                    className="min-h-[42px] justify-center rounded-xl bg-slate-50 px-3 py-2"
                    style={{
                      marginRight: fullBleed ? 0 : 8,
                      width: fullBleed ? columnWidth : 178,
                    }}
                  >
                    <Text className="text-sm text-slate-900">
                      {String(getCellValue(row, field))}
                    </Text>
                  </View>
                ),
              )}
              <View
                className="justify-center"
                style={{ width: fullBleed ? columnWidth : 178 }}
              >
                <Text className="text-xs font-semibold text-slate-700">
                  {row.lastEditedBy || "New import"}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {formatEditedAt(row.lastEditedAt)}
                </Text>
              </View>
              {selectableRows && !editMode && selectedRowId === stableRowId && (
                <View
                  className="justify-center"
                  style={{ width: fullBleed ? columnWidth : 90 }}
                >
                  <Text className="text-xs font-bold text-[#d95d39]">
                    Selected
                  </Text>
                </View>
              )}
              {editMode && onDeleteRow && (
                <View
                  className="justify-center"
                  style={{ width: fullBleed ? columnWidth : 80 }}
                >
                  <Pressable
                    accessibilityLabel={`Remove ${row.name || row.itemCode || "inventory row"}`}
                    className="self-start rounded-md border border-rose-200 bg-rose-50 px-3 py-2 active:bg-rose-100"
                    onPress={() => confirmDeleteRow(row)}
                  >
                    <Text className="text-xs font-bold text-rose-700">
                      Remove
                    </Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modifiedRow: {
    backgroundColor: "#fffbeb",
  },
  selectedRow: {
    backgroundColor: "#dcefe8",
    borderLeftWidth: 4,
    borderLeftColor: "#d95d39",
  },
  addedRow: {
    backgroundColor: "#dcfce7",
    borderLeftWidth: 4,
    borderLeftColor: "#16a34a",
  },
  removedRow: {
    backgroundColor: "#fee2e2",
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
  },
  editedRow: {
    backgroundColor: "#fff3cd",
    borderLeftWidth: 4,
    borderLeftColor: "#d95d39",
  },
  fullBleedRow: {
    paddingHorizontal: 0,
  },
});
