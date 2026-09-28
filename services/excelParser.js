import XLSX from "xlsx";

// The import/export order is part of the application contract.
export const INVENTORY_COLUMNS = [
  "itemCode",
  "name",
  "description",
  "category",
  "quantity",
  "unit",
  "location",
  "status",
];

const HEADER_ALIASES = {
  itemCode: [
    "itemcode",
    "itemnumber",
    "itemno",
    "sku",
    "productcode",
    "productid",
    "partnumber",
    "partno",
    "reference",
    "referenceid",
    "ref",
    "refid",
    "code",
    "id",
  ],
  name: [
    "name",
    "itemname",
    "productname",
    "product",
    "item",
    "description",
    "title",
  ],
  description: ["description", "details", "notes", "itemdescription"],
  category: ["category", "type", "group", "class"],
  quantity: [
    "quantity",
    "qty",
    "count",
    "stock",
    "onhand",
    "inventory",
    "amount",
  ],
  unit: ["unit", "uom", "unitofmeasure", "measure"],
  location: ["location", "warehouse", "bin", "shelf", "site"],
  status: ["status", "state", "condition"],
};

/** Converts spreadsheet headers into stable camelCase field names. */
function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, character) => character.toUpperCase());
}

/** Matches a flexible spreadsheet header to one of the app's known fields. */
function getInventoryColumn(header) {
  const normalizedHeader = normalizeHeader(header).toLowerCase();
  const exactMatch = Object.entries(HEADER_ALIASES).find(([, aliases]) =>
    aliases.includes(normalizedHeader),
  );
  if (exactMatch) return exactMatch[0];

  return Object.entries(HEADER_ALIASES).find(([, aliases]) =>
    aliases.some(
      (alias) =>
        normalizedHeader.includes(alias) || alias.includes(normalizedHeader),
    ),
  )?.[0];
}

/** Converts a cell value into the expected inventory representation. */
function normalizeValue(column, value) {
  if (value === undefined || value === null) {
    return column === "quantity" ? 0 : "";
  }

  if (column === "quantity") {
    const quantity = Number(value);
    if (!Number.isFinite(quantity)) {
      throw new Error("Quantity must be a number.");
    }
    return quantity;
  }

  return String(value).trim();
}

/** Reads a File, Blob, URI, ArrayBuffer, or typed array into binary data. */
async function readExcelData(file) {
  if (!file) {
    throw new Error("An Excel file is required.");
  }

  if (file instanceof ArrayBuffer || ArrayBuffer.isView(file)) {
    return file;
  }

  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }

  if (typeof file === "string") {
    const response = await fetch(file);
    if (!response.ok) {
      throw new Error(`Unable to read Excel file: ${response.status}`);
    }
    return response.arrayBuffer();
  }

  if (file.uri) {
    return readExcelData(file.uri);
  }

  throw new Error("Unsupported Excel file input.");
}

/** Reads the first worksheet and returns validated, normalized inventory rows. */
export async function parseExcel(file, options = {}) {
  const binaryData = await readExcelData(file);
  const workbook = XLSX.read(binaryData, { type: "array", cellDates: true });
  const worksheetName = workbook.SheetNames[0];

  if (!worksheetName) {
    throw new Error("The Excel workbook does not contain a worksheet.");
  }

  const worksheet = workbook.Sheets[worksheetName];
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  const headerIndex = matrix.findIndex(
    (row) =>
      Array.isArray(row) && row.some((value) => String(value).trim() !== ""),
  );

  if (headerIndex < 0) {
    return { worksheetName, columns: [], rows: [] };
  }

  const headers = matrix[headerIndex];
  const configuredQuantityHeader = String(options.quantityColumnName || "")
    .trim()
    .toLowerCase();
  const defaultLocation = String(options.defaultLocation || "").trim();
  const columnMap = headers.map((header, columnIndex) => ({
    header: String(header || `column${columnIndex + 1}`).trim(),
    column: getInventoryColumn(header),
    columnIndex,
  }));
  const columns = columnMap.map(({ header, column }) => ({
    label: header,
    field: column || `customFields.${normalizeHeader(header)}`,
  }));
  const dataRows = matrix.slice(headerIndex + 1);
  const configuredQuantityColumn = columnMap.find(
    ({ header }) => header.toLowerCase() === configuredQuantityHeader,
  );

  const normalizedRows = dataRows.map((rawRow, rowIndex) => {
    const values = columnMap.map(({ header, columnIndex }) => ({
      header,
      value: rawRow[columnIndex],
    }));
    const source = values.reduce((result, entry) => {
      result[entry.header] = entry.value;
      return result;
    }, {});
    const knownValues = columnMap.reduce((result, entry) => {
      if (entry.column && result[entry.column] === undefined) {
        result[entry.column] = rawRow[entry.columnIndex];
      }
      return result;
    }, {});
    const firstValue = values.find(
      ({ value }) => String(value ?? "").trim() !== "",
    )?.value;
    const row = INVENTORY_COLUMNS.reduce((result, column) => {
      const fallback =
        column === "itemCode"
          ? firstValue || `ROW-${rowIndex + headerIndex + 2}`
          : column === "name"
            ? firstValue || `Inventory item ${rowIndex + 1}`
            : column === "quantity"
              ? configuredQuantityColumn
                ? rawRow[configuredQuantityColumn.columnIndex]
                : 1
              : column === "location"
                ? defaultLocation
                : "";
      result[column] = normalizeValue(
        column,
        column === "quantity" ? fallback : (knownValues[column] ?? fallback),
      );
      if (column === "location" && !String(knownValues.location || "").trim()) {
        result.location = defaultLocation;
      }
      return result;
    }, {});

    row.customFields = Object.entries(source).reduce(
      (result, [header, value]) => {
        if (!getInventoryColumn(header) && String(value ?? "").trim() !== "") {
          result[normalizeHeader(header)] = value;
        }
        return result;
      },
      {},
    );

    return row;
  });

  return { worksheetName, columns, rows: normalizedRows };
}
