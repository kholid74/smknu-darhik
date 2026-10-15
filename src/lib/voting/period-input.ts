export class PeriodError extends Error {
  constructor(public code: string) { super(code); }
}

export type PeriodInput = { slug: string; name: string; academicYear: string; opensAt: Date; closesAt: Date };
export type PeriodConfig = { name: string; academicYear: string; opensAt: Date; closesAt: Date };
export type PeriodExtensionInput = { adminPassword: string; reasonCode: string };

export function validatePeriodExtension(value: unknown): PeriodExtensionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PeriodError('INVALID_INPUT');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || Object.keys(input).some((key) => !['adminPassword', 'reasonCode'].includes(key)) ||
      typeof input.adminPassword !== 'string' || !input.adminPassword || input.adminPassword.length > 256 ||
      typeof input.reasonCode !== 'string' || !/^[A-Z][A-Z0-9_]{1,63}$/.test(input.reasonCode)) throw new PeriodError('INVALID_INPUT');
  return { adminPassword: input.adminPassword, reasonCode: input.reasonCode };
}

function configFields(value: unknown): PeriodConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PeriodError('INVALID_INPUT');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['name', 'academicYear', 'opensAt', 'closesAt'].includes(key)) ||
      typeof v.name !== 'string' || !v.name.trim() || v.name.trim().length > 120 ||
      typeof v.academicYear !== 'string' || !v.academicYear.trim() || v.academicYear.trim().length > 20 ||
      typeof v.opensAt !== 'string' || typeof v.closesAt !== 'string') throw new PeriodError('INVALID_INPUT');
  const opensAt = new Date(v.opensAt);
  const closesAt = new Date(v.closesAt);
  if (!Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime()) || closesAt <= opensAt) throw new PeriodError('INVALID_SCHEDULE');
  return { name: v.name.trim(), academicYear: v.academicYear.trim(), opensAt, closesAt };
}

export function validatePeriodConfig(value: unknown): PeriodConfig {
  return configFields(value);
}

export function validateExpectedPeriodConfig(value: unknown): PeriodConfig {
  return configFields(value);
}

export function validatePeriodInput(value: unknown): PeriodInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PeriodError('INVALID_INPUT');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['slug', 'name', 'academicYear', 'opensAt', 'closesAt'].includes(key)) ||
      typeof v.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug) || v.slug.length > 64 ||
      typeof v.name !== 'string' || !v.name.trim() || v.name.trim().length > 120 ||
      typeof v.academicYear !== 'string' || !v.academicYear.trim() || v.academicYear.trim().length > 20 ||
      typeof v.opensAt !== 'string' || typeof v.closesAt !== 'string') throw new PeriodError('INVALID_INPUT');
  const opensAt = new Date(v.opensAt);
  const closesAt = new Date(v.closesAt);
  if (!Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime()) || closesAt <= opensAt) throw new PeriodError('INVALID_SCHEDULE');
  return { slug: v.slug, name: v.name.trim(), academicYear: v.academicYear.trim(), opensAt, closesAt };
}
