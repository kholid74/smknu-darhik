import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { db } from '../prisma';
import { requireEnv } from '../env';
import { pinHashMaterial } from './pin-input';
import { createPreauthCsrfToken } from './security';
import type { VoterType } from './voter-identity';

export class StudentAuthError extends Error {
  constructor(public code: string) { super(code); }
}

const DUMMY_PIN_HASH = '$2b$12$lCpWabTWgZzcj6yPdcVG7e3lQ/HvjRq/CvuTuVeZgFaJsh.mI9Tqy';

function secret(name: string) {
  const value = requireEnv(name);
  if (Buffer.byteLength(value) < 32) throw new Error(`${name} must contain at least 32 bytes`);
  return value;
}

export function newOpaqueToken() { return randomBytes(32).toString('base64url'); }
export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function preauthCsrf(secretValue: string, nonce: string, now?: number) { return createPreauthCsrfToken(secretValue, nonce, now); }

export async function authenticateVoter(periodId: string, identifier: string, pin: string, voterType: VoterType) {
  const pinSecret = secret('VOTING_PIN_SECRET');
  const rateSecret = secret('VOTING_RATE_SECRET');
  const period = await db.electionPeriod.findUnique({ where: { id: periodId }, select: { id: true, state: true, opensAt: true, closesAt: true } });
  const now = Date.now();
  if (!period || period.state !== 'SCHEDULED' || period.opensAt.getTime() > now || period.closesAt.getTime() <= now) {
    throw new StudentAuthError('ELECTION_NOT_OPEN');
  }
  const rateKey = createHmac('sha256', rateSecret).update(`${voterType === 'TEACHER' ? 'teacher-login' : 'student-login'}\0${periodId}\0${identifier}`).digest('hex');
  const [{ attempts }] = await db.$queryRaw<[{ attempts: number }]>`
    INSERT INTO "VotingRateBucket" ("key", "attempts", "expiresAt") VALUES (${rateKey}, 1, clock_timestamp() + interval '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "VotingRateBucket"."expiresAt" <= clock_timestamp() THEN 1 ELSE "VotingRateBucket"."attempts" + 1 END,
      "expiresAt" = CASE WHEN "VotingRateBucket"."expiresAt" <= clock_timestamp() THEN clock_timestamp() + interval '15 minutes' ELSE "VotingRateBucket"."expiresAt" END
    RETURNING "attempts"
  `;
  if (attempts > 5) throw new StudentAuthError('RATE_LIMITED');
  const voter = await db.electionVoter.findUnique({ where: voterType === 'TEACHER'
    ? { periodId_loginCode: { periodId, loginCode: identifier } } : { periodId_nisn: { periodId, nisn: identifier } }, select: {
    id: true, voterType: true, pinHash: true, credentialEnabled: true, pinVersion: true,
  } });
  const material = voter?.pinHash && voter.credentialEnabled
    ? pinHashMaterial(pinSecret, periodId, identifier, pin)
    : `unmatched-login:${periodId}:${identifier}:${pin}`;
  const matched = await bcrypt.compare(material, voter?.pinHash ?? DUMMY_PIN_HASH);
  if (!voter || voter.voterType !== voterType || !voter.credentialEnabled || !voter.pinHash || !matched) throw new StudentAuthError('INVALID_CREDENTIALS');

  const rawToken = newOpaqueToken();
  const absoluteDeadline = Math.min(now + 15 * 60_000, period.closesAt.getTime());
  const idleDeadline = Math.min(now + 5 * 60_000, absoluteDeadline);
  const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR SHARE`;
      const locked = await tx.$queryRaw<Array<{ pinHash: string | null; credentialEnabled: boolean; pinVersion: number }>>`
        SELECT "pinHash", "credentialEnabled", "pinVersion" FROM "ElectionVoter" WHERE "id" = ${voter.id}::uuid FOR UPDATE`;
      const [{ now: dbNow }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
      const currentPeriod = await tx.electionPeriod.findUnique({ where: { id: periodId }, select: { state: true, opensAt: true, closesAt: true } });
      if (!locked.length || !currentPeriod || currentPeriod.state !== 'SCHEDULED' || currentPeriod.opensAt > dbNow || currentPeriod.closesAt <= dbNow ||
          locked[0].pinVersion !== voter.pinVersion || locked[0].pinHash !== voter.pinHash || !locked[0].credentialEnabled) return 'STALE';
      const participation = await tx.voterParticipation.findMany({ where: { voterId: voter.id, hasVoted: true }, select: { organization: true } });
      await tx.votingSession.deleteMany({ where: { voterId: voter.id } });
      if (participation.length >= 4) return 'COMPLETE';
      const expiresAt = new Date(Math.min(idleDeadline, currentPeriod.closesAt.getTime()));
      const session = await tx.votingSession.create({ data: { voterId: voter.id, tokenHash: tokenHash(rawToken), createdAt: dbNow, lastSeenAt: dbNow, expiresAt }, select: { id: true } });
      return { type: 'ACTIVE' as const, sessionId: session.id };
  });
  if (result === 'STALE') throw new StudentAuthError('INVALID_CREDENTIALS');
  if (result === 'COMPLETE') return { complete: true as const };
  return { complete: false as const, token: rawToken, sessionId: result.sessionId };
}

export function votingCsrfSecret() { return secret('VOTING_CSRF_SECRET'); }
