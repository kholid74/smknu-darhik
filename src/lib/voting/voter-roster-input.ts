export type RosterStudentInput = { nisn: string; name: string; className: string };

function validateRosterStudent(value: unknown): RosterStudentInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RosterError('INVALID_INPUT');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['nisn', 'name', 'className'].includes(key)) ||
      typeof v.nisn !== 'string' || !/^\d{10}$/.test(v.nisn) ||
      typeof v.name !== 'string' || !v.name.trim() || v.name.trim().length > 120 ||
      typeof v.className !== 'string' || !v.className.trim() || v.className.trim().length > 40) throw new RosterError('INVALID_INPUT');
  return { nisn: v.nisn, name: v.name.trim(), className: v.className.trim() };
}
export class RosterError extends Error {
  constructor(public code: string) { super(code); }
}

export function validateRosterSnapshot(value: unknown): RosterStudentInput {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3 ||
      Object.keys(value).some((key) => !['nisn', 'name', 'className'].includes(key))) throw new RosterError('INVALID_INPUT');
  return validateRosterStudent(value);
}

export function validatePostOpenRosterCorrection(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RosterError('INVALID_INPUT');
  const input = value as Record<string, unknown>;
  const allowed = ['syncFromMaster', 'expectedSnapshot', 'adminPassword', 'reviewerAccountId', 'reviewerPassword'];
  if (Object.keys(input).length !== allowed.length || Object.keys(input).some((key) => !allowed.includes(key)) || input.syncFromMaster !== true ||
      typeof input.adminPassword !== 'string' || !input.adminPassword || input.adminPassword.length > 256 ||
      typeof input.reviewerAccountId !== 'string' || !input.reviewerAccountId.trim() || input.reviewerAccountId.length > 128 ||
      typeof input.reviewerPassword !== 'string' || !input.reviewerPassword || input.reviewerPassword.length > 256) throw new RosterError('INVALID_INPUT');
  return { expectedSnapshot: validateRosterSnapshot(input.expectedSnapshot), adminPassword: input.adminPassword,
    reviewerAccountId: input.reviewerAccountId, reviewerPassword: input.reviewerPassword };
}

export type RosterVoterSnapshot = RosterStudentInput | { loginCode: string; name: string; className: string };
export function validateVoterSnapshot(value: unknown): RosterVoterSnapshot {
  if (!value || typeof value !== 'object' || !('loginCode' in value)) return validateRosterSnapshot(value);
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 3 || Object.keys(v).some(key => !['loginCode', 'name', 'className'].includes(key)) ||
      typeof v.loginCode !== 'string' || !/^GURU-[A-F0-9]{12}$/.test(v.loginCode) ||
      typeof v.name !== 'string' || !v.name.trim() || v.name.length > 120 || v.className !== 'Guru') throw new RosterError('INVALID_INPUT');
  return {loginCode: v.loginCode, name: v.name, className: 'Guru'};
}
