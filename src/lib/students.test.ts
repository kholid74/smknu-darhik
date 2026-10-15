import test from 'node:test';
import assert from 'node:assert/strict';
import { StudentError, validateExpectedStudent, validateStudentInput } from './students-input';

test('student input validates NISN and requires a master class id', () => {
  assert.deepEqual(validateStudentInput({ nisn: '0012345678', name: '  Siti Aminah ', schoolClassId: 'class_123' }), {
    nisn: '0012345678', name: 'Siti Aminah', schoolClassId: 'class_123',
  });
  assert.throws(() => validateStudentInput({ nisn: '123', name: 'Siti', schoolClassId: 'class_123' }), StudentError);
  assert.throws(() => validateStudentInput({ nisn: '1234567890', name: ' ', schoolClassId: 'class_123' }), StudentError);
  assert.throws(() => validateStudentInput({ nisn: '1234567890', name: 'Siti', schoolClassId: '' }), StudentError);
  assert.throws(() => validateStudentInput({ nisn: '1234567890', name: 'Siti', schoolClassId: 'class_123', pin: '1234' }), StudentError);
});

test('expected student snapshot includes the current class relationship', () => {
  assert.deepEqual(validateExpectedStudent({ nisn: '0012345678', name: 'Siti', className: 'X RPL 1', schoolClassId: null }), {
    nisn: '0012345678', name: 'Siti', className: 'X RPL 1', schoolClassId: null,
  });
  assert.throws(() => validateExpectedStudent({ nisn: '0012345678', name: 'Siti', className: 'X', schoolClassId: null, extra: true }), StudentError);
});

test('school class requires valid academic year and a department id', async () => {
  const { validateSchoolClassInput } = await import('./students-input');
  assert.deepEqual(validateSchoolClassInput({ academicYear: '2026/2027', name: 'X DKV 1', departmentId: 'dept_123' }), {
    academicYear: '2026/2027', name: 'X DKV 1', departmentId: 'dept_123',
  });
  assert.throws(() => validateSchoolClassInput({ academicYear: '2026/2028', name: 'X DKV 1', departmentId: 'dept_123' }), StudentError);
});
