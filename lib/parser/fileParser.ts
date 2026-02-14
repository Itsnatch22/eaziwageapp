import fs from "fs";
import { PDFParse } from "pdf-parse";
import ExcelJS, { CellValue } from "exceljs";

// --- PDF Parser ---
interface Employee {
    name: string;
    department: string;
    salary: number;
}

export async function parsePDF(filePath: string): Promise<Employee[]> {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    
    return data.text.split('\n').slice(1).map((line: string): Employee => {
        const [name, department, salary] = line.split(/\s{2,}|\t/);
        return { name, department, salary: Number(salary) };
    });
}

// --- DOCX Parser ---
export async function parseDocx(filePath: string): Promise<Employee[]> {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    
    return data.text.split('\n').slice(1).map((line: string): Employee => {
        const [name, department, salary] = line.split(/\s{2,}|\t/);
        return { name, department, salary: Number(salary) };
    });
}

// --- XLSX Parser ---
export async function parseXLSX(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  const employees: Array<{ id: string; name: string; department: string; salary: number; withdrawnThisMonth: number; status: 'Active' | 'Inactive'; }> = [];
  worksheet.eachRow((row, index) => {
    if(index === 1) return; // skip header
    const values = row.values && Array.isArray(row.values) ? row.values.slice(1) : [];
    if (values.length === 0) return;

    const [id, name, department, salary, withdrawnThisMonth, status] = values as CellValue[]; 
    employees.push({ 
        id: String(id), 
        name: String(name), 
        department: String(department), 
        salary: Number(salary), 
        withdrawnThisMonth: Number(withdrawnThisMonth) || 0, 
        status: (String(status) as 'Active' | 'Inactive') || 'Active' 
    });
  });
  return employees;
}
