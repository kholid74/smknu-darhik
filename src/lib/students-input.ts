export class StudentError extends Error {
  constructor(public code: string, public details?: unknown) { super(code); }
}

export type SchoolClassInput = { academicYear: string; name: string; departmentId: string };

export function validateSchoolClassInput(value: unknown): SchoolClassInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StudentError('INVALID_INPUT');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['academicYear', 'name', 'departmentId'].includes(key)) ||
      typeof v.academicYear !== 'string' || !/^\d{4}\/\d{4}$/.test(v.academicYear) ||
      Number(v.academicYear.slice(5)) !== Number(v.academicYear.slice(0, 4)) + 1 ||
      typeof v.name !== 'string' || !v.name.trim() || v.name.trim().length > 40 ||
      typeof v.departmentId !== 'string' || !/^[a-zA-Z0-9_-]{1,30}$/.test(v.departmentId)) {
    throw new StudentError('INVALID_INPUT');
  }
  return { academicYear: v.academicYear, name: v.name.trim(), departmentId: v.departmentId };
}

export type StudentInput = { nisn: string; name: string; schoolClassId: string };
export type ExpectedStudent = { nisn: string; name: string; className: string; schoolClassId: string | null };

export function validateStudentInput(value: unknown): StudentInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StudentError('INVALID_INPUT');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['nisn', 'name', 'schoolClassId'].includes(key)) ||
      typeof v.nisn !== 'string' || !/^\d{10}$/.test(v.nisn) ||
      typeof v.name !== 'string' || !v.name.trim() || v.name.trim().length > 120 ||
      typeof v.schoolClassId !== 'string' || !/^[a-zA-Z0-9_-]{1,30}$/.test(v.schoolClassId)) {
    throw new StudentError('INVALID_INPUT');
  }
  return { nisn: v.nisn, name: v.name.trim(), schoolClassId: v.schoolClassId };
}

export function validateExpectedStudent(value: unknown): ExpectedStudent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StudentError('INVALID_INPUT');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['nisn', 'name', 'className', 'schoolClassId'].includes(key)) ||
      typeof v.nisn !== 'string' || !/^\d{10}$/.test(v.nisn) ||
      typeof v.name !== 'string' || !v.name.trim() || v.name.trim().length > 120 ||
      typeof v.className !== 'string' || v.className.length > 40 ||
      !(v.schoolClassId === null || (typeof v.schoolClassId === 'string' && /^[a-zA-Z0-9_-]{1,30}$/.test(v.schoolClassId)))) {
    throw new StudentError('INVALID_INPUT');
  }
  return { nisn: v.nisn, name: v.name, className: v.className, schoolClassId: v.schoolClassId as string | null };
}
