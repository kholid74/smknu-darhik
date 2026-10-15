import {can, type Principal} from '../rbac';
import {PeriodError} from './period-input';

export function canDeleteTestPeriod(principal: Principal | undefined | null) {
  return !!principal?.roles.includes('superadmin') &&
    ['evoting.lihat', 'evoting.kelola', 'evoting.hapus-uji'].every(capability => can(principal, capability));
}

export function validateTestCleanupInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PeriodError('INVALID_INPUT');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 3 || Object.keys(input).some(key => !['confirmation', 'previewVersion', 'adminPassword'].includes(key)) ||
      typeof input.confirmation !== 'string' || !/^HAPUS [a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.confirmation) || input.confirmation.length > 70 ||
      typeof input.previewVersion !== 'string' || !/^[a-f0-9]{32}$/.test(input.previewVersion) ||
      typeof input.adminPassword !== 'string' || !input.adminPassword || input.adminPassword.length > 256) throw new PeriodError('INVALID_INPUT');
  return {confirmation: input.confirmation, previewVersion: input.previewVersion, adminPassword: input.adminPassword};
}

export type TestCleanupPreview = {
  id: string; slug: string; name: string; state: string; isTest: boolean; publishedAt: string | null;
  contests: number; candidates: number; members: number; voters: number; pins: number;
  participation: number; ballots: number; sessions: number; auditEvents: number; version: string;
};

export function assertTestCleanupAllowed(preview: TestCleanupPreview | null): asserts preview is TestCleanupPreview {
  if (!preview) throw new PeriodError('NOT_FOUND');
  if (!preview.isTest || preview.publishedAt !== null) throw new PeriodError('TEST_CLEANUP_NOT_ALLOWED');
}
