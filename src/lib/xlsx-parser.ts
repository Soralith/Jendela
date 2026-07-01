import * as XLSX from 'xlsx';

export interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedData> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
    header: 1,
    defval: '',
  });

  if (jsonData.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  let headerRow = 0;
  let headers: string[] = [];

  const potentialHeaders: string[][] = [];
  for (let i = 0; i < Math.min(5, jsonData.length); i++) {
    const row = jsonData[i] as (string | number)[];
    const textRow = row.map((h) => String(h).trim());
    const nonEmpty = textRow.filter((c) => c.length > 0);
    const hasNumbers = textRow.some((c) => /^\d+$/.test(c));
    if (nonEmpty.length >= 2 && !hasNumbers) {
      potentialHeaders.push(textRow);
    }
    if (hasNumbers && nonEmpty.length >= 2) {
      break;
    }
  }

  if (potentialHeaders.length > 0) {
    const mergedHeaders: string[] = [];
    const lastRow = potentialHeaders[potentialHeaders.length - 1];
    for (let j = 0; j < lastRow.length; j++) {
      let label = lastRow[j];
      if (!label && potentialHeaders.length > 1) {
        for (let k = potentialHeaders.length - 2; k >= 0; k--) {
          if (potentialHeaders[k][j]) {
            label = potentialHeaders[k][j] + ' ' + label;
            break;
          }
        }
      }
      mergedHeaders.push(label || `Kolom${j + 1}`);
    }
    headers = mergedHeaders;
    headerRow = potentialHeaders.length;
  } else {
    for (let i = 0; i < Math.min(3, jsonData.length); i++) {
      const row = jsonData[i] as (string | number)[];
      if (row.some((c) => String(c).trim())) {
        headers = row.map((h) => String(h).trim() || `Kolom${h}`);
        headerRow = i + 1;
        break;
      }
    }
  }

  const rows: Record<string, string>[] = [];
  const knownTotals = new Set(['indonesia', 'total', 'jumlah', 'luar negeri']);

  for (let i = headerRow + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as (string | number)[];
    if (row.every((cell) => String(cell).trim() === '')) continue;

    const rowObj: Record<string, string> = {};
    let hasData = false;
    let firstCell = '';
    for (let j = 0; j < headers.length; j++) {
      if (j < row.length) {
        const val = String(row[j]).trim();
        rowObj[headers[j] || `Kolom${j + 1}`] = val;
        if (j === 0) firstCell = val.toLowerCase();
        if (val) hasData = true;
      }
    }
    if (hasData) {
      if (knownTotals.has(firstCell)) {
        rowObj['_rowType'] = 'total';
      }
      rows.push(rowObj);
    }
  }

  return { headers, rows, totalRows: rows.length };
}

export async function parseCsv(buffer: ArrayBuffer): Promise<ParsedData> {
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(buffer);

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const rowObj: Record<string, string> = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = j < values.length ? values[j] : '';
      if (rowObj[headers[j]]) hasData = true;
    }
    if (hasData) rows.push(rowObj);
  }

  return { headers, rows, totalRows: rows.length };
}
