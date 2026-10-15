import type { VotingOrganization } from '@prisma/client';
import { db } from '../prisma';
import { retryDatabaseRead } from '../database-read';
import { CandidateError, type CandidateInput, type ExpectedCandidate } from './candidate-input';

export { CandidateError, validateCandidateInput } from './candidate-input';

async function lockEditablePeriod(tx: any, periodId: string) {
  const rows = await tx.$queryRawUnsafe(
    'SELECT "state", "opensAt" FROM "ElectionPeriod" WHERE "id" = $1 FOR UPDATE', periodId,
  );
  if (!rows[0]) throw new CandidateError('NOT_FOUND');
  const [{ now }] = await tx.$queryRawUnsafe('SELECT clock_timestamp() AS "now"');
  if (!['DRAFT', 'SCHEDULED'].includes(rows[0].state)) throw new CandidateError('INVALID_STATE');
  if (new Date(now) >= new Date(rows[0].opensAt)) throw new CandidateError('CANDIDATES_LOCKED');
}

async function resolveMembers(tx: any, input: CandidateInput) {
  const students = await tx.student.findMany({ where: { id: { in: [input.chair.studentId, input.viceChair.studentId] } } });
  if (students.length !== 2) throw new CandidateError('INVALID_STUDENT');
  const byId = new Map<string, any>(students.map((student: any) => [student.id, student] as const));
  for (const member of [input.chair, input.viceChair]) {
    if (member.photoUrl && !await tx.media.findFirst({ where: { url: member.photoUrl, kind: 'image' }, select: { id: true } })) {
      throw new CandidateError('INVALID_PHOTO');
    }
  }
  return [
    { studentId: input.chair.studentId, position: 'CHAIR', photoUrl: input.chair.photoUrl ?? null },
    { studentId: input.viceChair.studentId, position: 'VICE_CHAIR', photoUrl: input.viceChair.photoUrl ?? null },
  ].map((member) => {
    const student = byId.get(member.studentId) as any;
    return { ...member, nameSnapshot: student.name, classSnapshot: student.className };
  });
}

export async function saveCandidatePair(periodId: string, input: CandidateInput, actorAccountId: string, candidateId?: string, expected?: ExpectedCandidate) {
  return db.$transaction(async (tx: any) => {
    await lockEditablePeriod(tx, periodId);
    const members = await resolveMembers(tx, input);
    if (!await tx.electionContest.findUnique({ where: { periodId_organization: { periodId, organization: input.organization } }, select: { periodId: true } })) {
      throw new CandidateError('INVALID_ORGANIZATION');
    }

    let pair: any;
    if (candidateId) {
      pair = await tx.candidatePair.findFirst({ where: { id: candidateId, periodId, organization: input.organization }, include: { members: true } });
      if (!pair) throw new CandidateError('NOT_FOUND');
      if (!expected || pair.ballotNumber !== expected.ballotNumber || pair.vision !== expected.vision || pair.mission !== expected.mission ||
          pair.members.find((member: any) => member.position === 'CHAIR')?.studentId !== expected.chairStudentId ||
          pair.members.find((member: any) => member.position === 'VICE_CHAIR')?.studentId !== expected.viceChairStudentId) {
        throw new CandidateError('STALE_CANDIDATE');
      }
      await tx.candidatePair.update({ where: { id: pair.id }, data: { ballotNumber: input.ballotNumber, vision: input.vision, mission: input.mission } });
      await tx.candidateMember.deleteMany({ where: { candidatePairId: pair.id } });
      await tx.candidateMember.createMany({ data: members.map((member) => ({ ...member, candidatePairId: pair!.id, periodId, organization: input.organization })) });
    } else {
      pair = await tx.candidatePair.create({ data: { periodId, organization: input.organization, ballotNumber: input.ballotNumber, vision: input.vision, mission: input.mission } });
      await tx.candidateMember.createMany({ data: members.map((member) => ({ ...member, candidatePairId: pair.id, periodId, organization: input.organization })) });
    }
    await tx.votingAuditEvent.create({ data: {
      periodId, actorAccountId, event: candidateId ? 'CANDIDATE_UPDATED' : 'CANDIDATE_CREATED', targetId: pair.id,
      detail: { organization: input.organization, ballotNumber: input.ballotNumber, studentIds: members.map((member) => member.studentId) },
    } });
    return pair;
  });
}

export async function deleteCandidatePair(periodId: string, candidateId: string, actorAccountId: string) {
  return db.$transaction(async (tx: any) => {
    await lockEditablePeriod(tx, periodId);
    const pair = await tx.candidatePair.findFirst({
      where: { id: candidateId, periodId }, include: { _count: { select: { ballots: true } } },
    });
    if (!pair) throw new CandidateError('NOT_FOUND');
    if (pair._count.ballots) throw new CandidateError('CANDIDATE_HAS_BALLOTS');
    if (await tx.candidatePair.count({ where: { periodId, organization: pair.organization } }) <= 1) throw new CandidateError('LAST_CANDIDATE');
    await tx.candidateMember.deleteMany({ where: { candidatePairId: candidateId } });
    await tx.candidatePair.delete({ where: { id: candidateId } });
    await tx.votingAuditEvent.create({ data: {
      periodId, actorAccountId, event: 'CANDIDATE_DELETED', targetId: candidateId,
      detail: { organization: pair.organization, ballotNumber: pair.ballotNumber },
    } });
  });
}

export async function searchStudents(query: string, limit = 20) {
  const q = query.trim();
  if (q.length < 2) return [];
  return retryDatabaseRead(() => db.student.findMany({
    where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { nisn: { startsWith: q } }, { className: { contains: q, mode: 'insensitive' } }] },
    select: { id: true, name: true, nisn: true, className: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }], take: Math.min(Math.max(limit, 1), 20),
  }));
}
