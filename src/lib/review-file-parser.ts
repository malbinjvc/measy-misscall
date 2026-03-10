import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedReviewRow {
  serialNumber?: number;
  customerName: string;
  rating: number;
  relativeDate: string;
  comment: string | null;
  photoUrls: string[];
}

export interface ParseError {
  row: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedReviewRow[];
  errors: ParseError[];
  totalRawRows: number;
}

// Flexible header mapping
const HEADER_MAP: Record<string, string> = {
  // Serial / row number
  "s.no": "serialNumber",
  "sno": "serialNumber",
  "serial": "serialNumber",
  "serial number": "serialNumber",
  "#": "serialNumber",
  "no": "serialNumber",
  "number": "serialNumber",
  // Customer name
  "name": "customerName",
  "customer name": "customerName",
  "customer": "customerName",
  "reviewer": "customerName",
  "reviewer name": "customerName",
  // Rating
  "rating": "rating",
  "star rating": "rating",
  "stars": "rating",
  "star": "rating",
  "score": "rating",
  // Date
  "date": "relativeDate",
  "review date": "relativeDate",
  "posted": "relativeDate",
  "posted date": "relativeDate",
  "time": "relativeDate",
  "when": "relativeDate",
  // Comment
  "comment": "comment",
  "review": "comment",
  "review text": "comment",
  "text": "comment",
  "feedback": "comment",
  "description": "comment",
};

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "") // strip BOM
    .trim()
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, " ") // strip parenthesized content e.g. "Rating (Stars)" → "Rating"
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPhotoColumn(header: string): boolean {
  const h = normalizeHeader(header);
  return /^photo\s*(url)?\s*\d*$/.test(h) || /^image\s*(url)?\s*\d*$/.test(h);
}

function parseRawRows(rawRows: Record<string, string>[]): ParseResult {
  const rows: ParsedReviewRow[] = [];
  const errors: ParseError[] = [];

  if (rawRows.length === 0) {
    return { rows: [], errors: [{ row: 0, message: "File contains no data rows" }], totalRawRows: 0 };
  }

  // Map headers from first row's keys
  const originalHeaders = Object.keys(rawRows[0]);
  const headerMapping: Record<string, string> = {};
  const photoColumns: string[] = [];

  for (const header of originalHeaders) {
    const normalized = normalizeHeader(header);
    if (HEADER_MAP[normalized]) {
      headerMapping[header] = HEADER_MAP[normalized];
    } else if (isPhotoColumn(header)) {
      photoColumns.push(header);
    }
  }

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Map to normalized keys
    const mapped: Record<string, string> = {};
    for (const [origKey, value] of Object.entries(raw)) {
      const mappedKey = headerMapping[origKey];
      if (mappedKey) {
        mapped[mappedKey] = value?.trim() ?? "";
      }
    }

    // Collect photo URLs
    const photoUrls: string[] = [];
    for (const col of photoColumns) {
      const url = raw[col]?.trim();
      if (url) photoUrls.push(url);
    }

    // Validate required fields
    if (!mapped.customerName) {
      errors.push({ row: rowNum, message: "Missing customer name" });
      continue;
    }

    const ratingStr = mapped.rating;
    const rating = ratingStr ? Math.round(parseFloat(ratingStr)) : NaN;
    if (isNaN(rating) || rating < 1 || rating > 5) {
      errors.push({ row: rowNum, message: `Invalid rating "${ratingStr}" (must be 1-5)` });
      continue;
    }

    if (!mapped.relativeDate) {
      errors.push({ row: rowNum, message: "Missing date" });
      continue;
    }

    rows.push({
      serialNumber: mapped.serialNumber ? parseInt(mapped.serialNumber, 10) || undefined : undefined,
      customerName: mapped.customerName,
      rating,
      relativeDate: mapped.relativeDate,
      comment: mapped.comment || null,
      photoUrls,
    });
  }

  return { rows, errors, totalRawRows: rawRows.length };
}

/**
 * Parse a CSV or Excel file into normalized review rows.
 * Auto-detects format by file extension.
 */
export async function parseReviewFile(file: File): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    return parseCSV(file);
  } else if (ext === "xlsx" || ext === "xls") {
    return parseExcel(file);
  } else {
    return {
      rows: [],
      errors: [{ row: 0, message: `Unsupported file format ".${ext}". Use .csv, .xlsx, or .xls` }],
      totalRawRows: 0,
    };
  }
}

function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        resolve(parseRawRows(results.data));
      },
      error() {
        resolve({
          rows: [],
          errors: [{ row: 0, message: "Failed to parse CSV file" }],
          totalRawRows: 0,
        });
      },
    });
  });
}

async function parseExcel(file: File): Promise<ParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { rows: [], errors: [{ row: 0, message: "Excel file has no sheets" }], totalRawRows: 0 };
    }
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
    return parseRawRows(rawRows);
  } catch {
    return {
      rows: [],
      errors: [{ row: 0, message: "Failed to parse Excel file" }],
      totalRawRows: 0,
    };
  }
}
