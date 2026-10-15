import type { VotingOrganization } from '@prisma/client';

export type CandidateInput = {
  organization: VotingOrganization;
  ballotNumber: number;
  chair: { studentId: string; photoUrl?: string };
  viceChair: { studentId: string; photoUrl?: string };
  vision: string;
  mission: string;
};
export type ExpectedCandidate = { ballotNumber: number; chairStudentId: string; viceChairStudentId: string; vision: string; mission: string };

export class CandidateError extends Error {
  constructor(public code: string) { super(code); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORGANIZATIONS = new Set(['OSIS', 'DEWAN_AMBALAN', 'IPNU', 'IPPNU']);

export function validateCandidateInput(value: unknown): CandidateInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CandidateError('INVALID_INPUT');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['organization', 'ballotNumber', 'chair', 'viceChair', 'vision', 'mission'].includes(key))) {
    throw new CandidateError('INVALID_INPUT');
  }
  if (typeof v.organization !== 'string' || !ORGANIZATIONS.has(v.organization)) throw new CandidateError('INVALID_INPUT');
  if (typeof v.ballotNumber !== 'number' || !Number.isSafeInteger(v.ballotNumber) || v.ballotNumber < 1) throw new CandidateError('INVALID_INPUT');
  const member = (raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CandidateError('INVALID_INPUT');
    const m = raw as Record<string, unknown>;
    if (Object.keys(m).some((key) => !['studentId', 'photoUrl'].includes(key))) throw new CandidateError('INVALID_INPUT');
    if (typeof m.studentId !== 'string' || !UUID.test(m.studentId)) throw new CandidateError('INVALID_STUDENT');
    if (m.photoUrl !== undefined && (typeof m.photoUrl !== 'string' || !m.photoUrl || m.photoUrl.length > 1024)) throw new CandidateError('INVALID_INPUT');
    return { studentId: m.studentId, photoUrl: m.photoUrl as string | undefined };
  };
  const chair = member(v.chair);
  const viceChair = member(v.viceChair);
  if (chair.studentId === viceChair.studentId) throw new CandidateError('DUPLICATE_CANDIDATE');
  if (typeof v.vision !== 'string' || !v.vision.trim() || v.vision.length > 2000 ||
      typeof v.mission !== 'string' || !v.mission.trim() || v.mission.length > 2000) throw new CandidateError('INVALID_INPUT');
  return {
    organization: v.organization as VotingOrganization,
    ballotNumber: Number(v.ballotNumber), chair, viceChair,
    vision: v.vision.trim(), mission: v.mission.trim(),
  };
}

export function validateExpectedCandidate(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CandidateError('INVALID_INPUT');
  const expected = value as Record<string, unknown>;
  const keys = ['ballotNumber', 'chairStudentId', 'viceChairStudentId', 'vision', 'mission'];
  if (Object.keys(expected).length !== keys.length || Object.keys(expected).some((key) => !keys.includes(key)) ||
      typeof expected.ballotNumber !== 'number' || !Number.isSafeInteger(expected.ballotNumber) || expected.ballotNumber < 1 ||
      typeof expected.chairStudentId !== 'string' || !UUID.test(expected.chairStudentId) ||
      typeof expected.viceChairStudentId !== 'string' || !UUID.test(expected.viceChairStudentId) ||
      expected.chairStudentId === expected.viceChairStudentId ||
      typeof expected.vision !== 'string' || typeof expected.mission !== 'string') throw new CandidateError('INVALID_INPUT');
  return expected as unknown as ExpectedCandidate;
}
