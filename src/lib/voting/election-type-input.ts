export class ElectionTypeError extends Error {
  constructor(public code: string) { super(code); }
}

export type ElectionTypeInput = {
  code: string; name: string; logoUrl: string | null; candidateMode: 'SINGLE' | 'OPTIONAL_VICE';
  chairLabel: string; viceChairLabel: string | null; active: boolean; sortOrder: number;
};
export type ElectionTypePatch = Partial<Omit<ElectionTypeInput, 'code'>> & { expectedRevision: number };
const mutable = ['name', 'logoUrl', 'candidateMode', 'chairLabel', 'viceChairLabel', 'active', 'sortOrder'];
const codePattern = /^[A-Z][A-Z0-9_]{1,31}$/;
const maxInt = 2147483647;

function record(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new ElectionTypeError('INVALID_INPUT');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ElectionTypeError('INVALID_INPUT');
  return value.trim();
}
function int(value: unknown, max = maxInt) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new ElectionTypeError('INVALID_INPUT');
  return value;
}
export function validateTypeCode(value: unknown) {
  if (typeof value !== 'string' || !codePattern.test(value)) throw new ElectionTypeError('INVALID_ORGANIZATION');
  return value;
}
export function validateOrganizations(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20 || new Set(value).size !== value.length) throw new ElectionTypeError('INVALID_INPUT');
  return value.map(validateTypeCode);
}
function field(key: string, value: unknown): unknown {
  if (['name', 'chairLabel'].includes(key)) return text(value, key === 'name' ? 120 : 80);
  if (key === 'logoUrl') return value === null ? null : text(value, 1024);
  if (key === 'viceChairLabel') return value === null ? null : text(value, 80);
  if (key === 'sortOrder') return int(value, 9999);
  if (key === 'active' && typeof value === 'boolean') return value;
  if (key === 'candidateMode' && ['SINGLE', 'OPTIONAL_VICE'].includes(value as string)) return value;
  throw new ElectionTypeError('INVALID_INPUT');
}
export function validateTypeInput(value: unknown): ElectionTypeInput {
  const input = record(value, ['code', ...mutable]);
  if (Object.keys(input).length !== mutable.length + 1) throw new ElectionTypeError('INVALID_INPUT');
  const result = { code: validateTypeCode(input.code), ...Object.fromEntries(mutable.map(key => [key, field(key, input[key])])) } as ElectionTypeInput;
  if ((result.candidateMode === 'SINGLE' && result.viceChairLabel !== null) || (result.candidateMode === 'OPTIONAL_VICE' && !result.viceChairLabel)) throw new ElectionTypeError('INVALID_INPUT');
  return result;
}
export function validateTypePatch(value: unknown): ElectionTypePatch {
  const input = record(value, ['expectedRevision', ...mutable]);
  if (Object.keys(input).length < 2) throw new ElectionTypeError('INVALID_INPUT');
  return { expectedRevision: int(input.expectedRevision), ...Object.fromEntries(Object.keys(input).filter(key => key !== 'expectedRevision').map(key => [key, field(key, input[key])])) };
}
export function validateRevision(value: unknown) {
  const input = record(value, ['expectedRevision']);
  return int(input.expectedRevision);
}
export function validateContestInput(value: unknown) {
  const input = record(value, ['organizations', 'expectedRevision']);
  return { organizations: validateOrganizations(input.organizations), expectedRevision: int(input.expectedRevision) };
}

export type TypeCursor = { sortOrder: number; code: string };
export function encodeTypeCursor(value: TypeCursor) {
  return Buffer.from(JSON.stringify({ sortOrder: value.sortOrder, code: value.code })).toString('base64url');
}
export function validateTypeQuery(params: URLSearchParams) {
  if ([...params.keys()].some(key => !['q', 'active', 'limit', 'cursor'].includes(key) || params.getAll(key).length !== 1)) throw new ElectionTypeError('INVALID_INPUT');
  const q = (params.get('q') ?? '').trim(), active = params.get('active'), limit = params.get('limit') ?? '20';
  if (q.length > 120 || (active !== null && !['true', 'false'].includes(active)) || !/^[1-9][0-9]*$/.test(limit) || Number(limit) > 100) throw new ElectionTypeError('INVALID_INPUT');
  const raw = params.get('cursor');
  let cursor: TypeCursor | null = null;
  if (raw !== null) {
    try {
      if (!/^[A-Za-z0-9_-]{1,1024}$/.test(raw)) throw new Error();
      const decoded = record(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')), ['sortOrder', 'code']);
      cursor = { sortOrder: int(decoded.sortOrder, 9999), code: validateTypeCode(decoded.code) };
      if (encodeTypeCursor(cursor) !== raw) throw new Error();
    } catch { throw new ElectionTypeError('INVALID_CURSOR'); }
  }
  return { q, active: active === null ? null : active === 'true', limit: Number(limit), cursor };
}

export function isSchoolMediaUrl(source: string, origin?: string, mediaBase?: string): boolean {
  try {
    if (!source.startsWith('/api/image/') && !/^https?:\/\//.test(source)) return false;
    if (!origin && mediaBase?.startsWith('/') && !source.startsWith('/api/image/')) return false;
    const baseOrigin = origin ? new URL(origin).origin : 'https://relative.school.invalid';
    const url = new URL(source, baseOrigin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    if ((source.startsWith('/api/image/') || origin) && url.origin === baseOrigin && url.pathname.startsWith('/api/image/') && url.pathname.length > 11) return true;
    if (mediaBase) {
      const base = new URL(mediaBase.replace(/\/$/, '') + '/', baseOrigin);
      return url.origin === base.origin && url.pathname.startsWith(base.pathname) && url.pathname.length > base.pathname.length;
    }
  } catch { /* Invalid or untrusted URL is rejected before any network request. */ }
  return false;
}
