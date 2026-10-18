import { ORGANIZATION_CODE } from './contests';

export type CandidateInput = {
  organization: string;
  ballotNumber: number;
  chair: { studentId: string; photoUrl?: string | null };
  viceChair: { studentId: string; photoUrl?: string | null } | null;
  vision: string;
  mission: string;
};
export type ExpectedCandidate = { ballotNumber: number; chairStudentId: string; viceChairStudentId: string | null; chairPhotoUrl: string | null; viceChairPhotoUrl: string | null; vision: string; mission: string };

export class CandidateError extends Error {
  constructor(public code: string) { super(code); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validPhoto = (value: unknown) => value === null || (typeof value === 'string' && !!value.trim() && value.length <= 1024);

export function validateCandidateInput(value: unknown): CandidateInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CandidateError('INVALID_INPUT');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['organization', 'ballotNumber', 'chair', 'viceChair', 'vision', 'mission'].includes(key))) {
    throw new CandidateError('INVALID_INPUT');
  }
  if (typeof v.organization !== 'string' || !ORGANIZATION_CODE.test(v.organization)) throw new CandidateError('INVALID_INPUT');
  if (typeof v.ballotNumber !== 'number' || !Number.isSafeInteger(v.ballotNumber) || v.ballotNumber < 1 || v.ballotNumber > 2147483647) throw new CandidateError('INVALID_INPUT');
  const member = (raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CandidateError('INVALID_INPUT');
    const m = raw as Record<string, unknown>;
    if (Object.keys(m).some((key) => !['studentId', 'photoUrl'].includes(key))) throw new CandidateError('INVALID_INPUT');
    if (typeof m.studentId !== 'string' || !UUID.test(m.studentId)) throw new CandidateError('INVALID_STUDENT');
    if (m.photoUrl !== undefined && !validPhoto(m.photoUrl)) throw new CandidateError('INVALID_INPUT');
    return { studentId: m.studentId.toLowerCase(), photoUrl: m.photoUrl as string | null | undefined };
  };
  const chair = member(v.chair);
  const viceChair = v.viceChair == null ? null : member(v.viceChair);
  if (chair.studentId === viceChair?.studentId) throw new CandidateError('DUPLICATE_CANDIDATE');
  if (typeof v.vision !== 'string' || !v.vision.trim() || v.vision.length > 2000 ||
      typeof v.mission !== 'string' || !v.mission.trim() || v.mission.length > 2000) throw new CandidateError('INVALID_INPUT');
  return {
    organization: v.organization,
    ballotNumber: Number(v.ballotNumber), chair, viceChair,
    vision: v.vision.trim(), mission: v.mission.trim(),
  };
}

export function validateExpectedCandidate(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CandidateError('INVALID_INPUT');
  const expected = value as Record<string, unknown>;
  const keys = ['ballotNumber', 'chairStudentId', 'viceChairStudentId', 'chairPhotoUrl', 'viceChairPhotoUrl', 'vision', 'mission'];
  if (Object.keys(expected).length !== keys.length || Object.keys(expected).some((key) => !keys.includes(key)) ||
      typeof expected.ballotNumber !== 'number' || !Number.isSafeInteger(expected.ballotNumber) || expected.ballotNumber < 1 || expected.ballotNumber > 2147483647 ||
      typeof expected.chairStudentId !== 'string' || !UUID.test(expected.chairStudentId) ||
      (expected.viceChairStudentId !== null && (typeof expected.viceChairStudentId !== 'string' || !UUID.test(expected.viceChairStudentId))) ||
      expected.chairStudentId.toLowerCase() === (expected.viceChairStudentId as string | null)?.toLowerCase() ||
      !validPhoto(expected.chairPhotoUrl) || !validPhoto(expected.viceChairPhotoUrl) ||
      (expected.viceChairStudentId === null && expected.viceChairPhotoUrl !== null) ||
      typeof expected.vision !== 'string' || typeof expected.mission !== 'string') throw new CandidateError('INVALID_INPUT');
  return { ...expected, chairStudentId: expected.chairStudentId.toLowerCase(), viceChairStudentId: (expected.viceChairStudentId as string | null)?.toLowerCase() ?? null } as ExpectedCandidate;
}
