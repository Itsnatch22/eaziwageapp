import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parsePayrollRowsFromFile } from '@/lib/payroll-upload';

describe('parsePayrollRowsFromFile', () => {
  it('parses CSV files with spaced headers', async () => {
    const csv = 'employee code,gross salary\nEMP001,50000\n';
    const file = new File([csv], 'payroll.csv', { type: 'text/csv' });

    const rows = await parsePayrollRowsFromFile(file);

    expect(rows[0]).toEqual(['employee_code', 'gross_salary']);
    expect(rows[1]).toEqual(['EMP001', '50000']);
  });

  it('parses Excel workbooks with the first worksheet', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['employee code', 'gross salary', 'deductions'],
      ['EMP001', 50000, 1000],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Payroll');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const file = new File([buffer], 'payroll.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const rows = await parsePayrollRowsFromFile(file);

    expect(rows[0]).toEqual(['employee_code', 'gross_salary', 'deductions']);
    expect(rows[1]).toEqual(['EMP001', '50000', '1000']);
  });
});
