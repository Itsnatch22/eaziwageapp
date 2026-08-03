import * as XLSX from 'xlsx';

function parseCSV(csvContent: string): string[][] {
  const lines = csvContent.trim().split('\n');
  const rows: string[][] = [];

  for (const line of lines) {
    const row: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

export function normalizeHeaderValue(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, '_');
}

function toCellString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

export async function parsePayrollRowsFromFile(file: File): Promise<string[][]> {
  const filename = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (filename.endsWith('.csv') || mimeType.includes('csv')) {
    const csvContent = await file.text();
    const rows = parseCSV(csvContent);
    if (rows[0]) {
      rows[0] = rows[0].map((header) => normalizeHeaderValue(String(header)));
    }
    return rows;
  }

  const isExcelFile =
    filename.endsWith('.xlsx') ||
    filename.endsWith('.xls') ||
    filename.endsWith('.xlsm') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('sheet');

  if (!isExcelFile) {
    throw new Error('Unsupported file type');
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  if (!sheet) {
    return [];
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];
  const rows = rawRows.map((row) => (row ?? []).map((value) => toCellString(value)));
  if (rows[0]) {
    rows[0] = rows[0].map((header) => normalizeHeaderValue(String(header)));
  }
  return rows;
}
