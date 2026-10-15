import { StudentError } from './students-input';

export const STUDENT_IMPORT_HEADERS = ['NISN', 'Nama Lengkap', 'Tahun Ajaran', 'Kelas', 'Jurusan'] as const;
export const MAX_STUDENT_IMPORT_ROWS = 500;

export type StudentImportRow = {
  line: number;
  nisn: string;
  name: string;
  academicYear: string;
  className: string;
  departmentName: string;
};
export type StudentImportClass = { id: string; academicYear: string; name: string; department: { name: string; slug: string } };
export type StudentImportPreviewRow = StudentImportRow & { schoolClassId: string | null; errors: string[] };

export function parseStudentCsv(text: string): StudentImportRow[] {
  const source = text.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else field += char;
      continue;
    }
    if (closedQuote && char !== ',' && char !== '\r' && char !== '\n') throw new StudentError('INVALID_CSV');
    if (char === '"') {
      if (field) throw new StudentError('INVALID_CSV');
      quoted = true;
    } else if (char === ',') {
      row.push(field); field = ''; closedQuote = false;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = ''; closedQuote = false;
      if (row.some((cell) => cell.trim())) records.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new StudentError('INVALID_CSV');
  if (field || closedQuote || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) records.push(row);
  }

  const header = records.shift()?.map((cell) => cell.trim());
  if (!header || header.length !== STUDENT_IMPORT_HEADERS.length || header.some((cell, index) => cell !== STUDENT_IMPORT_HEADERS[index])) {
    throw new StudentError('INVALID_CSV_HEADERS');
  }
  if (!records.length) throw new StudentError('EMPTY_IMPORT');
  if (records.length > MAX_STUDENT_IMPORT_ROWS) throw new StudentError('TOO_MANY_IMPORT_ROWS');
  if (records.some((cells) => cells.length !== STUDENT_IMPORT_HEADERS.length)) throw new StudentError('INVALID_CSV');

  return records.map(([nisn, name, academicYear, className, departmentName], index) => ({
    line: index + 2, nisn: nisn.trim(), name: name.trim(), academicYear: academicYear.trim(),
    className: className.trim(), departmentName: departmentName.trim(),
  }));
}

export function validateStudentImportRows(rows: StudentImportRow[], classes: StudentImportClass[], existingNisn: Set<string>) {
  const classIds = new Map<string, string>();
  for (const item of classes) {
    for (const department of new Set([departmentKey(item.department.name), departmentKey(item.department.slug)])) {
      classIds.set(`${item.academicYear}\0${item.name}\0${department}`, item.id);
    }
  }
  const counts = new Map<string, number>();
  for (const row of rows) if (/^\d{10}$/.test(row.nisn)) counts.set(row.nisn, (counts.get(row.nisn) ?? 0) + 1);
  const result: StudentImportPreviewRow[] = rows.map((row) => {
    const errors: string[] = [];
    if (!/^\d{10}$/.test(row.nisn)) errors.push('NISN harus 10 digit angka.');
    else {
      if (counts.get(row.nisn)! > 1) errors.push('NISN duplikat di dalam file.');
      if (existingNisn.has(row.nisn)) errors.push('NISN sudah terdaftar di master siswa.');
    }
    if (!row.name || row.name.length > 120) errors.push('Nama wajib diisi (maksimal 120 karakter).');
    if (!/^\d{4}\/\d{4}$/.test(row.academicYear) || Number(row.academicYear.slice(5)) !== Number(row.academicYear.slice(0, 4)) + 1) {
      errors.push('Tahun ajaran harus berformat YYYY/YYYY.');
    }
    const schoolClassId = classIds.get(`${row.academicYear}\0${row.className}\0${departmentKey(row.departmentName)}`);
    if (!schoolClassId) errors.push('Tahun ajaran, kelas, dan jurusan tidak cocok dengan master kelas.');
    return { ...row, schoolClassId: schoolClassId ?? null, errors };
  });
  return { rows: result, total: result.length, valid: result.filter((row) => !row.errors.length).length, invalid: result.filter((row) => row.errors.length).length };
}

function departmentKey(value: string) {
  const key = value.trim().toLowerCase();
  if (['dkv', 'dkv (desain komunikasi visual)'].includes(key)) return 'dkv';
  if (['lps', 'perbankan syariah', 'perbankan-syariah', 'layanan perbankan syariah'].includes(key)) return 'lps';
  return key;
}
