import { createHmac, randomInt } from 'node:crypto';

export class PinError extends Error {
  constructor(public code: string) { super(code); }
}

export type PinTarget = { voterId: string; pinVersion: number };
export type PinRequest = { targets: PinTarget[]; mode: 'issue' | 'reset'; reasonCode?: string; adminPassword: string };
const REASONS = new Set(['LOST_SLIP', 'COMPROMISED', 'PRINT_FAILURE', 'ADMIN_CORRECTION']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatePinRequest(value: unknown): PinRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PinError('INVALID_INPUT');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['targets', 'mode', 'reasonCode', 'adminPassword'].includes(key)) ||
      !Array.isArray(v.targets) || v.targets.length < 1 || v.targets.length > 25 ||
      (v.mode !== 'issue' && v.mode !== 'reset') || typeof v.adminPassword !== 'string' || !v.adminPassword || v.adminPassword.length > 256 ||
      (v.reasonCode !== undefined && (typeof v.reasonCode !== 'string' || !REASONS.has(v.reasonCode))) ||
      (v.mode === 'reset' && (typeof v.reasonCode !== 'string' || !REASONS.has(v.reasonCode)))) throw new PinError('INVALID_INPUT');
  const targets = v.targets.map((target) => {
    if (!target || typeof target !== 'object' || Array.isArray(target)) throw new PinError('INVALID_INPUT');
    const row = target as Record<string, unknown>;
    if (Object.keys(row).length !== 2 || typeof row.voterId !== 'string' || !UUID.test(row.voterId) ||
        typeof row.pinVersion !== 'number' || !Number.isSafeInteger(row.pinVersion) || row.pinVersion < 0) throw new PinError('INVALID_INPUT');
    return { voterId: row.voterId, pinVersion: row.pinVersion };
  });
  if (new Set(targets.map((target) => target.voterId)).size !== targets.length) throw new PinError('INVALID_INPUT');
  return { targets, mode: v.mode, reasonCode: v.reasonCode as string | undefined, adminPassword: v.adminPassword };
}

export function generatePin() { return randomInt(0, 10 ** 10).toString().padStart(10, '0'); }

export function pinHashMaterial(secret: string, periodId: string, nisn: string, pin: string) {
  return createHmac('sha256', secret).update(`pin-hash\0${periodId}\0${nisn}\0${pin}`).digest('hex');
}

export function pinFingerprint(secret: string, periodId: string, pin: string) {
  return createHmac('sha256', secret).update(`pin-unique\0${periodId}\0${pin}`).digest('hex');
}
