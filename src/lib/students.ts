import { db } from './prisma';
import { parseStudentCsv, validateStudentImportRows } from './student-import';
import { StudentError, type ExpectedStudent, type SchoolClassInput, type StudentInput } from './students-input';

async function validateStudentImport(csv: string, client: any = db) {
  const rows = parseStudentCsv(csv);
  const classRecords = await client.schoolClass.findMany({ include: { department: { select: { name: true, slug: true } } } });
  const validNisn = rows.filter(({ nisn }) => /^\d{10}$/.test(nisn)).map(({ nisn }) => nisn);
  const existing = new Set((await client.student.findMany({ where: { nisn: { in: validNisn } }, select: { nisn: true } })).map((item: { nisn: string }) => item.nisn));
  return validateStudentImportRows(rows, classRecords, existing);
}


export async function previewStudentImport(csv: string) {
  return validateStudentImport(csv);
}

export async function importStudents(csv: string, actorAccountId: string) {
  return db.$transaction(async (tx: any) => {
    const preview = await validateStudentImport(csv, tx);
    if (preview.invalid) throw new StudentError('IMPORT_VALIDATION_FAILED', preview);
    const created = await tx.student.createManyAndReturn({ data: preview.rows.map((row: any) => ({
      nisn: row.nisn, name: row.name, className: row.className, schoolClassId: row.schoolClassId,
    })), select: { id: true } });
    await tx.studentAuditEvent.createMany({ data: created.map((student: { id: string }) => ({
      studentId: student.id, actorAccountId, event: 'CREATED', changedFields: ['nisn', 'name', 'className', 'schoolClassId'],
    })) });
    return { imported: created.length };
  }, { timeout: 15000 });
}

export async function listSchoolClasses() {
  return db.schoolClass.findMany({
    select: { id: true, academicYear: true, name: true, department: { select: { id: true, name: true } } },
    orderBy: [{ academicYear: 'desc' }, { name: 'asc' }, { department: { name: 'asc' } }],
  });
}

export async function createSchoolClass(input: SchoolClassInput) {
  const department = await db.department.findUnique({ where: { id: input.departmentId }, select: { id: true } });
  if (!department) throw new StudentError('INVALID_DEPARTMENT');
  return db.schoolClass.create({ data: input, include: { department: { select: { name: true } } } });
}

export async function updateSchoolClass(classId: string, input: SchoolClassInput, actorAccountId: string) {
  const department = await db.department.findUnique({ where: { id: input.departmentId }, select: { id: true } });
  if (!department) throw new StudentError('INVALID_DEPARTMENT');
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.schoolClass.findUnique({ where: { id: classId }, select: { id: true, name: true } });
      if (!existing) throw new StudentError('NOT_FOUND');
      const updated = await tx.schoolClass.update({ where: { id: classId }, data: input, include: { department: { select: { name: true } } } });
      if (existing.name !== input.name) {
        const students = await tx.student.findMany({ where: { schoolClassId: classId, className: { not: input.name } }, select: { id: true } });
        if (students.length) {
          await tx.student.updateMany({ where: { id: { in: students.map(({ id }) => id) } }, data: { className: input.name } });
          await tx.studentAuditEvent.createMany({ data: students.map(({ id }) => ({
            studentId: id, actorAccountId, event: 'UPDATED', changedFields: ['className'],
          })) });
        }
      }
      return updated;
    });
  } catch (error) {
    if (error instanceof StudentError) throw error;
    if ((error as { code?: string })?.code === 'P2025') throw new StudentError('NOT_FOUND');
    throw error;
  }
}

export async function deleteSchoolClass(classId: string) {
  return db.$transaction(async (tx) => {
    const schoolClass = await tx.schoolClass.findUnique({ where: { id: classId }, select: { id: true, _count: { select: { students: true } } } });
    if (!schoolClass) throw new StudentError('NOT_FOUND');
    if (schoolClass._count.students) throw new StudentError('CLASS_HAS_STUDENTS');
    await tx.schoolClass.delete({ where: { id: classId } });
  });
}

export async function listStudents(q: string, cursor: string | null, limit: number) {
  const where = studentWhere(q);
  return db.student.findMany({
    where,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { schoolClass: { select: { academicYear: true, name: true, department: { select: { name: true } } } } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }], take: Math.min(Math.max(limit, 1), 100),
  });
}

export async function listStudentsPage(q: string, requestedPage: number, pageSize: number, sort: {sort:'name'|'nisn'|'className';dir:'asc'|'desc'} = {sort:'name',dir:'asc'}) {
  pageSize = [10,25,50].includes(pageSize) ? pageSize : 10;
  requestedPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const sortColumn = ['name','nisn','className'].includes(sort.sort) ? sort.sort : 'name';
  const direction = sort.dir === 'desc' ? 'desc' : 'asc';
  const where = studentWhere(q);
  const total = await db.student.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const data = await db.student.findMany({
    where, skip: (page - 1) * pageSize, take: pageSize,
    include: { schoolClass: { select: { academicYear: true, name: true, department: { select: { name: true } } } } },
    orderBy: [{ [sortColumn]: direction }, { id: 'asc' }],
  });
  return { data, total, page, pageCount };
}

function studentWhere(q: string) {
  const query = q.trim();
  return query ? { OR: [
    { nisn: { startsWith: query } },
    { name: { contains: query, mode: 'insensitive' as const } },
    { className: { contains: query, mode: 'insensitive' as const } },
  ] } : undefined;
}

export async function createStudent(input: StudentInput, actorAccountId: string) {
  return db.$transaction(async (tx) => {
    const schoolClass = await tx.schoolClass.findUnique({ where: { id: input.schoolClassId }, select: { name: true } });
    if (!schoolClass) throw new StudentError('INVALID_CLASS');
    const student = await tx.student.create({ data: { nisn: input.nisn, name: input.name, schoolClassId: input.schoolClassId, className: schoolClass.name } });
    await tx.studentAuditEvent.create({ data: {
      studentId: student.id, actorAccountId, event: 'CREATED', changedFields: ['nisn', 'name', 'className', 'schoolClassId'],
    } });
    return student;
  });
}

export async function updateStudent(studentId: string, input: StudentInput, expected: ExpectedStudent, actorAccountId: string) {
  return db.$transaction(async (tx) => {
    const schoolClass = await tx.schoolClass.findUnique({ where: { id: input.schoolClassId }, select: { name: true } });
    if (!schoolClass) throw new StudentError('INVALID_CLASS');
    const result = await tx.student.updateMany({
      where: { id: studentId, nisn: expected.nisn, name: expected.name, className: expected.className, schoolClassId: expected.schoolClassId },
      data: { nisn: input.nisn, name: input.name, schoolClassId: input.schoolClassId, className: schoolClass.name },
    });
    if (!result.count) {
      if (!await tx.student.findUnique({ where: { id: studentId }, select: { id: true } })) throw new StudentError('NOT_FOUND');
      throw new StudentError('STALE_STUDENT');
    }
    const student = await tx.student.findUniqueOrThrow({ where: { id: studentId }, include: { schoolClass: { select: { academicYear: true, name: true, department: { select: { name: true } } } } } });
    await tx.studentAuditEvent.create({ data: {
      studentId, actorAccountId, event: 'UPDATED',
      changedFields: [
        ...(expected.nisn !== input.nisn ? ['nisn'] : []),
        ...(expected.name !== input.name ? ['name'] : []),
        ...(expected.className !== schoolClass.name ? ['className'] : []),
        ...(expected.schoolClassId !== input.schoolClassId ? ['schoolClassId'] : []),
      ],
    } });
    return student;
  });
}
