import { db } from '../prisma';
import { retryDatabaseRead } from '../database-read';
import { CandidateError, type CandidateInput, type ExpectedCandidate } from './candidate-input';
import { canEditElectionSetup } from './setup-readiness';

export { CandidateError, validateCandidateInput } from './candidate-input';

async function lockEditablePeriod(tx: any, periodId: string) {
  const rows = await tx.$queryRawUnsafe(
    'SELECT "state", "opensAt" FROM "ElectionPeriod" WHERE "id" = $1 FOR UPDATE', periodId,
  );
  if (!rows[0]) throw new CandidateError('NOT_FOUND');
  const [{ now }] = await tx.$queryRawUnsafe('SELECT clock_timestamp() AS "now"');
  if (!['DRAFT', 'SCHEDULED'].includes(rows[0].state)) throw new CandidateError('INVALID_STATE');
  if (!canEditElectionSetup(rows[0], new Date(now))) throw new CandidateError('CANDIDATES_LOCKED');
  return rows[0];
}

async function resolveMembers(tx: any, input: CandidateInput, previous: any[] = []) {
  const members = [
    { ...input.chair, position: 'CHAIR' },
    ...(input.viceChair ? [{ ...input.viceChair, position: 'VICE_CHAIR' }] : []),
  ];
  const students = await tx.student.findMany({ where: { id: { in: members.map(member => member.studentId) } } });
  if (students.length !== members.length) throw new CandidateError('INVALID_STUDENT');
  const byId = new Map<string, any>(students.map((student: any) => [student.id, student] as const));
  for (const member of members) {
    if (member.photoUrl && !(await tx.$queryRawUnsafe('SELECT id FROM "Media" WHERE url=$1 AND kind=\'image\' LIMIT 1 FOR SHARE',member.photoUrl)).length) {
      throw new CandidateError('INVALID_PHOTO');
    }
  }
  return members.map((member) => {
    const student = byId.get(member.studentId) as any;
    const historical = previous.find(old => old.studentId === member.studentId);
    return { ...member, photoUrl: member.photoUrl ?? null, nameSnapshot: historical?.nameSnapshot ?? student.name, classSnapshot: historical?.classSnapshot ?? student.className };
  });
}

function assertExpected(pair: any, expected?: ExpectedCandidate) {
  const chair = pair.members.find((member: any) => member.position === 'CHAIR');
  const vice = pair.members.find((member: any) => member.position === 'VICE_CHAIR');
  if (!expected || pair.ballotNumber !== expected.ballotNumber || pair.vision !== expected.vision || pair.mission !== expected.mission ||
      chair?.studentId !== expected.chairStudentId || (vice?.studentId ?? null) !== expected.viceChairStudentId ||
      (chair?.photoUrl ?? null) !== expected.chairPhotoUrl || (vice?.photoUrl ?? null) !== expected.viceChairPhotoUrl) {
    throw new CandidateError('STALE_CANDIDATE');
  }
}

export async function saveCandidatePair(periodId: string, input: CandidateInput, actorAccountId: string, candidateId?: string, expected?: ExpectedCandidate) {
  return db.$transaction(async (tx: any) => {
    await lockEditablePeriod(tx, periodId);
    const contest = await tx.electionContest.findUnique({ where: { periodId_organization: { periodId, organization: input.organization } }, select: { candidateModeSnapshot: true } });
    if (!contest) {
      throw new CandidateError('INVALID_ORGANIZATION');
    }
    if (contest.candidateModeSnapshot === 'SINGLE' && input.viceChair) throw new CandidateError('INVALID_CANDIDATE_MODE');
    let pair: any;
    if (candidateId) {
      pair = await tx.candidatePair.findFirst({ where: { id: candidateId, periodId, organization: input.organization }, include: { members: true } });
      if (!pair) throw new CandidateError('NOT_FOUND');
      assertExpected(pair, expected);
    }
    const members = await resolveMembers(tx, input, pair?.members);
    if (candidateId) {
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

export async function deleteCandidatePair(periodId: string, candidateId: string, actorAccountId: string, expected: ExpectedCandidate) {
  return db.$transaction(async (tx: any) => {
    const period = await lockEditablePeriod(tx, periodId);
    const pair = await tx.candidatePair.findFirst({
      where: { id: candidateId, periodId }, include: { members: true, _count: { select: { ballots: true } } },
    });
    if (!pair) throw new CandidateError('NOT_FOUND');
    assertExpected(pair, expected);
    if (pair._count.ballots) throw new CandidateError('CANDIDATE_HAS_BALLOTS');
    if (period.state !== 'DRAFT' && await tx.candidatePair.count({ where: { periodId, organization: pair.organization } }) <= 1) throw new CandidateError('LAST_CANDIDATE');
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
