import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Common column name variations for smart mapping
const COLUMN_MAPPINGS = {
  name: [
    'name',
    'employee name',
    'full name',
    'staff name',
    'employee',
    'worker name',
    'personnel name',
  ],
  department: [
    'department',
    'dept',
    'division',
    'team',
    'unit',
    'section',
  ],
  salary: [
    'salary',
    'monthly salary',
    'compensation',
    'pay',
    'wage',
    'monthly pay',
    'gross salary',
    'base salary',
  ],
  email: [
    'email',
    'e-mail',
    'email address',
    'work email',
  ],
  employee_number: [
    'employee number',
    'employee id',
    'emp id',
    'id',
    'staff number',
    'employee code',
  ],
};

export interface ParsedEmployee {
  name: string;
  department: string;
  salary: number;
  email?: string;
  employee_number?: string;
}

export interface ParsedRow {
  [key: string]: string;
}

export interface ParseResult {
  employees: ParsedEmployee[];
  errors: Array<{ row: number; message: string }>;
  unmappedColumns: string[];
}

/**
 * Normalize column name for comparison
 */
function normalizeColumn(col: string): string {
  return col.toLowerCase().trim().replace(/[_-]/g, ' ');
}

/**
 * Smart column mapping - finds the best match for a field
 */
function findColumnMatch(headers: string[], fieldVariations: string[]): string | null {
  const normalizedHeaders = headers.map(normalizeColumn);
  
  for (const variation of fieldVariations) {
    const normalized = normalizeColumn(variation);
    const index = normalizedHeaders.indexOf(normalized);
    if (index !== -1) {
      return headers[index];
    }
  }
  
  return null;
}

/**
 * Auto-detect column mappings
 */
function autoMapColumns(headers: string[]): {
  mappings: Record<string, string>;
  unmapped: string[];
} {
  const mappings: Record<string, string> = {};
  const mapped = new Set<string>();

  // Try to map required fields
  for (const [field, variations] of Object.entries(COLUMN_MAPPINGS)) {
    const match = findColumnMatch(headers, variations);
    if (match) {
      mappings[field] = match;
      mapped.add(match);
    }
  }

  const unmapped = headers.filter(h => !mapped.has(h));

  return { mappings, unmapped };
}

/**
 * Parse salary - handles various formats ($5,000, 5000, 5k)
 */
function parseSalary(value: string): number | null {
  if (!value) return null;

  // Remove currency symbols, commas, spaces
  let cleaned = value.toString().replace(/[$,\s]/g, '');

  // Handle 'k' suffix (e.g., "5k" = 5000)
  if (cleaned.toLowerCase().endsWith('k')) {
    const num = parseFloat(cleaned.slice(0, -1));
    return isNaN(num) ? null : num * 1000;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract text from PDF
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const textContent: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    textContent.push(pageText);
  }

  return textContent.join('\n');
}

/**
 * Extract text from DOCX
 */
export async function extractTextFromDOCX(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

/**
 * Parse table from text - attempts to extract structured data
 */
function parseTableFromText(text: string): ParsedRow[] {
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('Document must contain at least a header row and one data row');
  }

  // Assume first line is headers
  const headerLine = lines[0];
  const headers = headerLine.split(/\s{2,}|\t/).map(h => h.trim()).filter(Boolean);

  if (headers.length === 0) {
    throw new Error('Could not detect table headers');
  }

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(/\s{2,}|\t/).map(v => v.trim()).filter(Boolean);

    if (values.length === 0) continue;

    const row: ParsedRow = {};
    for (let j = 0; j < Math.min(headers.length, values.length); j++) {
      row[headers[j]] = values[j];
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Validate and transform row to employee
 */
function validateRow(
  row: ParsedRow,
  mappings: Record<string, string>,
  rowNumber: number
): { employee: ParsedEmployee | null; error: string | null } {
  const errors: string[] = [];

  // Extract name
  const nameCol = mappings.name;
  const name = nameCol ? row[nameCol]?.trim() : null;
  if (!name) {
    errors.push('Missing name');
  }

  // Extract department
  const deptCol = mappings.department;
  const department = deptCol ? row[deptCol]?.trim() : null;
  if (!department) {
    errors.push('Missing department');
  }

  // Extract salary
  const salaryCol = mappings.salary;
  const salaryValue = salaryCol ? row[salaryCol] : null;
  const salary = salaryValue ? parseSalary(salaryValue) : null;
  if (!salary || salary <= 0) {
    errors.push('Missing or invalid salary');
  }

  // Optional fields
  const emailCol = mappings.email;
  const email = emailCol ? row[emailCol]?.trim() : undefined;

  const empNumCol = mappings.employee_number;
  const employee_number = empNumCol ? row[empNumCol]?.trim() : undefined;

  if (errors.length > 0) {
    return {
      employee: null,
      error: `Row ${rowNumber}: ${errors.join(', ')}`,
    };
  }

  return {
    employee: {
      name: name!,
      department: department!,
      salary: salary!,
      email,
      employee_number,
    },
    error: null,
  };
}

/**
 * Main parser - handles PDF or DOCX
 */
export async function parseEmployeeFile(
  file: File
): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  let text: string;

  // Extract text based on file type
  if (file.type === 'application/pdf') {
    text = await extractTextFromPDF(buffer);
  } else if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    text = await extractTextFromDOCX(buffer);
  } else {
    throw new Error('Unsupported file type. Please upload PDF or DOCX.');
  }

  // Parse table structure
  const rows = parseTableFromText(text);
  
  if (rows.length === 0) {
    throw new Error('No data rows found in document');
  }

  // Auto-map columns
  const headers = Object.keys(rows[0]);
  const { mappings, unmapped } = autoMapColumns(headers);

  // Validate required mappings
  if (!mappings.name || !mappings.department || !mappings.salary) {
    throw new Error(
      `Could not auto-detect required columns. Found: ${headers.join(', ')}`
    );
  }

  // Validate and transform rows
  const employees: ParsedEmployee[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const { employee, error } = validateRow(rows[i], mappings, i + 2); // +2 for header + 1-based index

    if (error) {
      errors.push({ row: i + 2, message: error });
    } else if (employee) {
      employees.push(employee);
    }
  }

  return {
    employees,
    errors,
    unmappedColumns: unmapped,
  };
}