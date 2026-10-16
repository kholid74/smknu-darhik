import bcrypt from 'bcryptjs';
import { createHmac } from 'node:crypto';
import { db } from '../prisma';
import { verifyPassword } from '../auth';
import { requireEnv } from '../env';
import { PinError, generatePin, pinFingerprint, pinHashMaterial, type PinRequest } from './pin-input';
import { voterIdentifier } from './voter-identity';

function pinSecret() {
  const secret = requireEnv('VOTING_PIN_SECRET');
  if (Buffer.byteLength(secret) < 32) throw new Error('VOTING_PIN_SECRET must contain at least 32 bytes');
  return secret;
}

async function checkAdminRate(accountId: string) {
  const secret = requireEnv('VOTING_RATE_SECRET');
  if (Buffer.byteLength(secret) < 32) throw new Error('VOTING_RATE_SECRET must contain at least 32 bytes');
  const key = createHmac('sha256', secret).update(`pin-reauth\0${accountId}`).digest('hex');
  const [{ attempts }] = await db.$queryRaw<[{ attempts: number }]>`
    INSERT INTO "VotingRateBucket" ("key", "attempts", "expiresAt")
    VALUES (${key}, 1, clock_timestamp() + interval '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "VotingRateBucket"."expiresAt" <= clock_timestamp() THEN 1 ELSE "VotingRateBucket"."attempts" + 1 END,
      "expiresAt" = CASE WHEN "VotingRateBucket"."expiresAt" <= clock_timestamp() THEN clock_timestamp() + interval '15 minutes' ELSE "VotingRateBucket"."expiresAt" END
    RETURNING "attempts"
  `;
  if (attempts > 5) throw new PinError('RATE_LIMITED');
}

function prepare(targets: Array<{ id: string; nisn: string | null; voterType: string; loginCode: string | null; name: string; className: string; pinVersion: number }>, periodId: string, secret: string) {
  const used = new Set<string>();
  return Promise.all(targets.map(async (target) => {
    let pin: string;
    let fingerprint: string;
    do {
      pin = generatePin();
      fingerprint = pinFingerprint(secret, periodId, pin);
    } while (used.has(fingerprint));
    used.add(fingerprint);
    return {
      ...target, pin, pinFingerprint: fingerprint,
      pinHash: await bcrypt.hash(pinHashMaterial(secret, periodId, voterIdentifier(target), pin), 12),
    };
  }));
}

export async function issuePins(periodId: string, request: PinRequest, actorAccountId: string) {
  await checkAdminRate(actorAccountId);
  const account = await db.account.findUnique({ where: { id: actorAccountId }, select: { active: true, passwordHash: true } });
  if (!account?.active || !await verifyPassword(request.adminPassword, account.passwordHash)) throw new PinError('INVALID_REAUTH');
  const voters = await db.electionVoter.findMany({
    where: { periodId, id: { in: request.targets.map((target) => target.voterId) } },
    select: { id: true, voterType: true, loginCode: true, nisn: true, name: true, className: true, pinHash: true, pinVersion: true, credentialEnabled: true,
      participation: { where: { hasVoted: true }, select: { organization: true } } },
  });
  if (voters.length !== request.targets.length) throw new PinError('NOT_FOUND');
  const versions = new Map(request.targets.map((target) => [target.voterId, target.pinVersion]));
  for (const voter of voters) {
    if (voter.pinVersion !== versions.get(voter.id)) throw new PinError('STALE_CREDENTIALS');
    if (request.mode === 'issue' && (voter.pinHash !== null || voter.credentialEnabled)) throw new PinError('INVALID_CREDENTIAL_STATE');
    if (request.mode === 'reset' && (!voter.pinHash || !voter.credentialEnabled)) throw new PinError('INVALID_CREDENTIAL_STATE');
    if (request.mode === 'reset' && voter.participation.length >= 4) throw new PinError('COMPLETED_VOTER');
  }
  const secret = pinSecret();
  const snapshots = new Map(voters.map((voter) => [voter.id, voter]));

  for (let attempt = 0; attempt < 3; attempt++) {
    const prepared = await prepare(request.targets.map((target) => {
      const voter = snapshots.get(target.voterId)!;
      return { id: voter.id, voterType: voter.voterType, loginCode: voter.loginCode, nisn: voter.nisn, name: voter.name, className: voter.className, pinVersion: target.pinVersion };
    }), periodId, secret);
    try {
      await db.$transaction(async (tx) => {
        const lockedPeriod = await tx.$queryRaw<Array<{ state: string; opensAt: Date; closesAt: Date }>>`SELECT "state", "opensAt", "closesAt" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR UPDATE`;
        if (!lockedPeriod.length) throw new PinError('NOT_FOUND');
        const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
        const beforeOpen = lockedPeriod[0].opensAt > now;
        const beforeClose = lockedPeriod[0].closesAt > now;
        if (lockedPeriod[0].state === 'SCHEDULED' && (!beforeClose || (request.mode === 'issue' && !beforeOpen &&
            request.targets.some((target) => target.pinVersion === 0)))) throw new PinError('INVALID_STATE');
        if (!['DRAFT', 'SCHEDULED'].includes(lockedPeriod[0].state)) throw new PinError('INVALID_STATE');
        const activeActor = await tx.account.findUnique({ where: { id: actorAccountId }, select: { active: true } });
        if (!activeActor?.active) throw new PinError('INVALID_REAUTH');
        for (const id of [...request.targets.map((target) => target.voterId)].sort()) {
          await tx.$queryRaw`SELECT "id" FROM "ElectionVoter" WHERE "id" = ${id}::uuid AND "periodId" = ${periodId}::uuid FOR UPDATE`;
        }
        const lockedVoters = await tx.electionVoter.findMany({ where: { periodId, id: { in: prepared.map((row) => row.id) } },
          select: { id: true, pinHash: true, pinVersion: true, credentialEnabled: true,
            participation: { where: { hasVoted: true }, select: { organization: true } } } });
        if (lockedVoters.length !== prepared.length) throw new PinError('NOT_FOUND');
        for (const voter of lockedVoters) {
          const target = request.targets.find((row) => row.voterId === voter.id)!;
          if (voter.pinVersion !== target.pinVersion) throw new PinError('STALE_CREDENTIALS');
          if (request.mode === 'issue' && (voter.pinHash !== null || voter.credentialEnabled)) throw new PinError('INVALID_CREDENTIAL_STATE');
          if (request.mode === 'reset' && (!voter.pinHash || !voter.credentialEnabled)) throw new PinError('INVALID_CREDENTIAL_STATE');
          if (request.mode === 'reset' && voter.participation.length >= 4) throw new PinError('COMPLETED_VOTER');
        }
        const fingerprints = prepared.map((row) => row.pinFingerprint);
        if (await tx.electionVoter.findFirst({ where: { periodId, pinFingerprint: { in: fingerprints } }, select: { id: true } })) {
          throw new PinError('PIN_COLLISION');
        }
        for (const row of prepared) {
          await tx.electionVoter.update({ where: { id: row.id }, data: {
            pinHash: row.pinHash, pinFingerprint: row.pinFingerprint, pinVersion: { increment: 1 }, credentialEnabled: true,
          } });
        }
        await tx.votingSession.deleteMany({ where: { voterId: { in: prepared.map((row) => row.id) } } });
        await tx.votingAuditEvent.createMany({ data: prepared.map((row) => ({
          periodId, actorAccountId, event: request.mode === 'issue' ? 'PIN_ISSUED' : 'PIN_RESET', targetId: row.id,
          reasonCode: request.reasonCode ?? null, detail: { pinVersion: row.pinVersion + 1 },
        })) });
      });
      return prepared.map(({ id, voterType, loginCode, name, nisn, className, pin }) => ({ id, voterType, loginCode, name, nisn, className, pin }));
    } catch (error) {
      if (error instanceof PinError && error.code === 'PIN_COLLISION') continue;
      if ((error as { code?: string })?.code === 'P2002') continue;
      throw error;
    }
  }
  throw new PinError('PIN_COLLISION');
}
