import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStudentCsv, validateStudentImportRows } from './student-import';
import { StudentError } from './students-input';

const header = 'NISN,Nama Lengkap,Tahun Ajaran,Kelas,Jurusan';

test('parses UTF-8 BOM, CRLF and escaped CSV quotes while preserving leading zeroes', () => {
  const rows = parseStudentCsv(`\uFEFF${header}\r\n0012345678,"Siti, ""Ayu""",2026/2027,X DKV,DKV\r\n`);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    line: 2, nisn: '0012345678', name: 'Siti, "Ayu"', academicYear: '2026/2027', className: 'X DKV', departmentName: 'DKV',
  });
});

test('rejects invalid headers and malformed CSV quoting', () => {
  assert.throws(() => parseStudentCsv('Nama,NISN\nSiti,0012345678'), (error) => error instanceof StudentError && error.code === 'INVALID_CSV_HEADERS');
  assert.throws(() => parseStudentCsv(`${header}\n0012345678,"Siti,2026/2027,X DKV,DKV`), (error) => error instanceof StudentError && error.code === 'INVALID_CSV');
});

test('validates class aliases against the master and rejects duplicate or existing NISN values', () => {
  const rows = parseStudentCsv(`${header}\n0012345678,Siti,2026/2027,X DKV,DKV\n0012345678,Aminah,2026/2027,X DKV,DKV\n1234567890,Budi,2026/2027,X LPS,LPS`);
  const classes = [
    { id: 'class_dkv', academicYear: '2026/2027', name: 'X DKV', department: { name: 'DKV (Desain Komunikasi Visual)', slug: 'dkv' } },
    { id: 'class_lps', academicYear: '2026/2027', name: 'X LPS', department: { name: 'Perbankan Syariah', slug: 'perbankan-syariah' } },
  ];
  const result = validateStudentImportRows(rows, classes, new Set(['1234567890']));
  assert.equal(result.valid, 0);
  assert.equal(result.invalid, 3);
  assert.equal(result.rows[0].schoolClassId, 'class_dkv');
  assert.equal(result.rows[2].schoolClassId, 'class_lps');
  assert.match(result.rows[0].errors[0], /duplikat/);
  assert.match(result.rows[2].errors[0], /terdaftar/);
});
