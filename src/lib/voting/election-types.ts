import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { db } from '../prisma';
import { env } from '../env';
import { PeriodError, type PeriodInput } from './period-input';
import { ElectionTypeError, encodeTypeCursor, isSchoolMediaUrl, validateTypeInput, type ElectionTypeInput, type ElectionTypePatch, type validateTypeQuery } from './election-type-input';

export type ElectionType = ElectionTypeInput & { revision: number; createdAt: Date };
export type ContestMetadata = {
  organization: string; name: string; logoUrl: string | null; candidateMode: ElectionTypeInput['candidateMode'];
  chairLabel: string; viceChairLabel: string | null; sortOrder: number;
};
const transactionOptions = { maxWait: 2000, timeout: 10000 };

async function audit(tx: Prisma.TransactionClient, actor: string, event: string, target: string, detail: unknown, periodId: string | null = null) {
  await tx.$executeRaw`INSERT INTO "VotingAuditEvent" (id,"periodId","actorAccountId",event,"targetId",detail)
    VALUES (${randomUUID()}::uuid,${periodId}::uuid,${actor},${event},${target},${JSON.stringify(detail)}::jsonb)`;
}
async function lockType(tx: Prisma.TransactionClient, code: string) {
  const [row] = await tx.$queryRaw<ElectionType[]>`SELECT code,name,"logoUrl","candidateMode","chairLabel","viceChairLabel",active,"sortOrder",revision,"createdAt"
    FROM "ElectionType" WHERE code=${code} FOR UPDATE`;
  if (!row) throw new ElectionTypeError('NOT_FOUND');
  return row;
}
async function validateLogo(tx: Prisma.TransactionClient, url: string | null, origin?: string) {
  if (url === null) return;
  if (!isSchoolMediaUrl(url, origin ?? env('PUBLIC_SITE_URL'), env('R2_PUBLIC_URL'))) throw new ElectionTypeError('INVALID_LOGO');
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Media" WHERE url=${url} AND kind='image' LIMIT 1 FOR SHARE`;
  if (!rows.length) throw new ElectionTypeError('INVALID_LOGO');
}
export async function listElectionTypes(input: ReturnType<typeof validateTypeQuery>) {
  const rows = await db.$queryRaw`SELECT code,name,"logoUrl","candidateMode","chairLabel","viceChairLabel",active,"sortOrder",revision,"createdAt"
    FROM "ElectionType" WHERE (${input.active}::boolean IS NULL OR active=${input.active}::boolean)
    AND (${input.q}='' OR strpos(lower(name),lower(${input.q}))>0 OR strpos(lower(code),lower(${input.q}))>0)
    AND (${input.cursor === null}::boolean OR ("sortOrder",code)>(${input.cursor?.sortOrder ?? 0}::integer,${input.cursor?.code ?? ''}::varchar))
    ORDER BY "sortOrder",code LIMIT ${input.limit + 1}::integer` as ElectionType[];
  const data = rows.slice(0, input.limit);
  return { data, nextCursor: rows.length > input.limit ? encodeTypeCursor(data[data.length - 1]) : null };
}
export async function createElectionType(input: ElectionTypeInput, actor: string, origin?: string) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    await validateLogo(tx, input.logoUrl, origin);
    const [row] = await tx.$queryRaw<ElectionType[]>`INSERT INTO "ElectionType" (code,name,"logoUrl","candidateMode","chairLabel","viceChairLabel",active,"sortOrder")
      VALUES (${input.code},${input.name},${input.logoUrl},${input.candidateMode}::"CandidateMode",${input.chairLabel},${input.viceChairLabel},${input.active},${input.sortOrder})
      ON CONFLICT (code) DO NOTHING RETURNING code,name,"logoUrl","candidateMode","chairLabel","viceChairLabel",active,"sortOrder",revision,"createdAt"`;
    if (!row) throw new ElectionTypeError('DUPLICATE_TYPE');
    await audit(tx, actor, 'ELECTION_TYPE_CREATED', row.code, { after: row });
    return row;
  }, transactionOptions);
}
export async function updateElectionType(code: string, patch: ElectionTypePatch, actor: string, origin?: string) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await lockType(tx, code);
    if (current.revision !== patch.expectedRevision) throw new ElectionTypeError('STALE_CONFIG');
    const { expectedRevision, ...changes } = patch;
    const { revision, createdAt, ...fields } = current;
    const merged = validateTypeInput({ ...fields, ...changes });
    if (Object.keys(changes).every(key => current[key as keyof ElectionType] === merged[key as keyof ElectionTypeInput])) return current;
    if (merged.logoUrl !== current.logoUrl) await validateLogo(tx, merged.logoUrl, origin);
    const [row] = await tx.$queryRaw<ElectionType[]>`UPDATE "ElectionType" SET name=${merged.name},"logoUrl"=${merged.logoUrl},
      "candidateMode"=${merged.candidateMode}::"CandidateMode","chairLabel"=${merged.chairLabel},"viceChairLabel"=${merged.viceChairLabel},active=${merged.active},"sortOrder"=${merged.sortOrder},revision=revision+1
      WHERE code=${code} RETURNING code,name,"logoUrl","candidateMode","chairLabel","viceChairLabel",active,"sortOrder",revision,"createdAt"`;
    await audit(tx, actor, 'ELECTION_TYPE_UPDATED', code, { before: current, after: row });
    return row;
  }, transactionOptions);
}
export async function deleteElectionType(code: string, expectedRevision: number, actor: string) {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await lockType(tx, code);
    if (current.revision !== expectedRevision) throw new ElectionTypeError('STALE_CONFIG');
    const used = await tx.$queryRaw<Array<{ organization: string }>>`SELECT organization FROM "ElectionContest" WHERE organization=${code} LIMIT 1`;
    if (used.length) throw new ElectionTypeError('TYPE_IN_USE');
    await tx.$executeRaw`DELETE FROM "ElectionType" WHERE code=${code}`;
    await audit(tx, actor, 'ELECTION_TYPE_DELETED', code, { before: current });
  }, transactionOptions);
}

async function readContests(tx: Prisma.TransactionClient, periodId: string) {
  return tx.$queryRaw<ContestMetadata[]>`SELECT organization,"nameSnapshot" AS name,"logoUrlSnapshot" AS "logoUrl",
    "candidateModeSnapshot" AS "candidateMode","chairLabelSnapshot" AS "chairLabel","viceChairLabelSnapshot" AS "viceChairLabel","sortOrder"
    FROM "ElectionContest" WHERE "periodId"=${periodId}::uuid ORDER BY "sortOrder"`;
}
async function lockMasters(tx: Prisma.TransactionClient, codes: string[], added: string[]) {
  const rows = await tx.$queryRaw<Array<{ code: string; active: boolean }>>`SELECT code,active FROM "ElectionType"
    WHERE code IN (SELECT jsonb_array_elements_text(${JSON.stringify(codes)}::jsonb)) ORDER BY code FOR SHARE`;
  if (rows.length !== codes.length) throw new ElectionTypeError('INVALID_ORGANIZATION');
  if (rows.some(row => added.includes(row.code) && !row.active)) throw new ElectionTypeError('TYPE_INACTIVE');
}
async function insertContests(tx: Prisma.TransactionClient, periodId: string, rows: Array<{ organization: string; sortOrder: number }>) {
  if (!rows.length) return;
  // The DB trigger copies locked master metadata; request bodies cannot supply snapshots.
  await tx.$executeRaw`INSERT INTO "ElectionContest" ("periodId",organization,"sortOrder") SELECT ${periodId}::uuid,x.organization,x."sortOrder"
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(organization varchar,"sortOrder" integer) ORDER BY x.organization`;
}
export async function getPeriodContests(periodId: string) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const [period] = await tx.$queryRaw<Array<{ contestsRevision: number }>>`SELECT "contestsRevision" FROM "ElectionPeriod" WHERE id=${periodId}::uuid`;
    if (!period) throw new ElectionTypeError('NOT_FOUND');
    return { contests: await readContests(tx, periodId), contestsRevision: period.contestsRevision };
  }, { ...transactionOptions, isolationLevel: 'RepeatableRead' });
}
export async function replacePeriodContests(periodId: string, codes: string[], expectedRevision: number, actor: string) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const [period] = await tx.$queryRaw<Array<{ state: string; contestsRevision: number }>>`SELECT state,"contestsRevision" FROM "ElectionPeriod" WHERE id=${periodId}::uuid FOR UPDATE`;
    if (!period) throw new ElectionTypeError('NOT_FOUND');
    if (period.state !== 'DRAFT') throw new ElectionTypeError('INVALID_STATE');
    if (period.contestsRevision !== expectedRevision) throw new ElectionTypeError('STALE_CONFIG');
    const current = await readContests(tx, periodId), before = current.map(row => row.organization);
    const [integrity] = await tx.$queryRaw<Array<{ voters: number; used: boolean; ballots: boolean; malformed: boolean }>>`SELECT
      (SELECT count(*)::integer FROM "ElectionVoter" WHERE "periodId"=${periodId}::uuid) AS voters,
      EXISTS(SELECT 1 FROM "VoterParticipation" WHERE "periodId"=${periodId}::uuid AND "hasVoted") AS used,
      EXISTS(SELECT 1 FROM "Ballot" WHERE "periodId"=${periodId}::uuid) AS ballots,
      EXISTS(SELECT v.id FROM "ElectionVoter" v LEFT JOIN "VoterParticipation" p ON p."voterId"=v.id AND p."periodId"=v."periodId"
        WHERE v."periodId"=${periodId}::uuid GROUP BY v.id HAVING count(p.organization)<>${before.length}::integer) AS malformed`;
    if (before.length < 1 || before.length > 20 || current.some((row, i) => row.sortOrder !== i + 1) || integrity.voters > 99 || integrity.used || integrity.ballots || integrity.malformed) throw new ElectionTypeError('RECONCILIATION_FAILED');
    if (before.length === codes.length && before.every((code, i) => code === codes[i])) return { contests: current, contestsRevision: expectedRevision };
    const added = codes.filter(code => !before.includes(code)), removed = before.filter(code => !codes.includes(code));
    await lockMasters(tx, [...new Set([...before, ...codes])], added);
    const populated = await tx.$queryRaw<Array<{ organization: string }>>`SELECT organization FROM "CandidatePair" WHERE "periodId"=${periodId}::uuid
      AND organization IN (SELECT jsonb_array_elements_text(${JSON.stringify(removed)}::jsonb)) LIMIT 1`;
    if (populated.length) throw new ElectionTypeError('CONTEST_HAS_CANDIDATES');
    await tx.$executeRaw`DELETE FROM "VoterParticipation" WHERE "periodId"=${periodId}::uuid AND NOT "hasVoted"
      AND organization IN (SELECT jsonb_array_elements_text(${JSON.stringify(removed)}::jsonb))`;
    await tx.$executeRaw`DELETE FROM "ElectionContest" WHERE "periodId"=${periodId}::uuid
      AND organization IN (SELECT jsonb_array_elements_text(${JSON.stringify(removed)}::jsonb))`;
    await tx.$executeRaw`UPDATE "ElectionContest" c SET "sortOrder"=x.position::integer
      FROM jsonb_array_elements_text(${JSON.stringify(codes)}::jsonb) WITH ORDINALITY AS x(code,position)
      WHERE c."periodId"=${periodId}::uuid AND c.organization=x.code AND c."sortOrder"<>x.position`;
    await insertContests(tx, periodId, codes.flatMap((organization, i) => added.includes(organization) ? [{ organization, sortOrder: i + 1 }] : []));
    await tx.$executeRaw`INSERT INTO "VoterParticipation" ("voterId","periodId",organization)
      SELECT v.id,v."periodId",c.organization FROM "ElectionVoter" v JOIN "ElectionContest" c ON c."periodId"=v."periodId"
      WHERE v."periodId"=${periodId}::uuid AND c.organization IN (SELECT jsonb_array_elements_text(${JSON.stringify(added)}::jsonb))`;
    await tx.$executeRaw`UPDATE "ElectionPeriod" SET "contestsRevision"="contestsRevision"+1 WHERE id=${periodId}::uuid`;
    await audit(tx, actor, 'PERIOD_CONTESTS_UPDATED', periodId, { before, after: codes, added, removed, voterCount: integrity.voters }, periodId);
    return { contests: await readContests(tx, periodId), contestsRevision: expectedRevision + 1 };
  }, transactionOptions);
}

export async function createPeriod(input: PeriodInput, actor: string) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    if (input.opensAt <= now) throw new PeriodError('INVALID_SCHEDULE');
    const id = randomUUID();
    const [period] = await tx.$queryRaw<Array<{ id: string; name: string; slug: string; academicYear: string; opensAt: Date; closesAt: Date; state: string; isTest: boolean; contestsRevision: number }>>`INSERT INTO "ElectionPeriod" (id,slug,name,"academicYear","opensAt","closesAt","isTest")
      VALUES (${id}::uuid,${input.slug},${input.name},${input.academicYear},${input.opensAt},${input.closesAt},${input.isTest})
      ON CONFLICT (slug) DO NOTHING RETURNING id,name,slug,"academicYear","opensAt","closesAt",state,"isTest","contestsRevision"`;
    if (!period) throw new PeriodError('DUPLICATE_SLUG');
    await lockMasters(tx, input.organizations, input.organizations);
    await insertContests(tx, id, input.organizations.map((organization, i) => ({ organization, sortOrder: i + 1 })));
    await audit(tx, actor, 'PERIOD_CREATED', id, { slug: input.slug, isTest: input.isTest, organizations: input.organizations }, id);
    return { ...period, contests: await readContests(tx, id) };
  }, transactionOptions);
}
