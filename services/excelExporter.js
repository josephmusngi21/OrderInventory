import XLSX from "xlsx";
import { INVENTORY_COLUMNS } from "./excelParser";

/**
 * Converts structured inventory rows into an XLSX workbook while preserving
 * the predetermined column order.
 */
export function exportToExcel(rows = [], fileName = "inventory.xlsx") {
  const orderedRows = rows.map((row) => {
    return INVENTORY_COLUMNS.reduce((orderedRow, column) => {
      orderedRow[column] = row[column] ?? "";
      return orderedRow;
    }, {});
  });

  const worksheet = XLSX.utils.json_to_sheet(orderedRows, {
    header: INVENTORY_COLUMNS,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return {
    data: output,
    fileName: fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
