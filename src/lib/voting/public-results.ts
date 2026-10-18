import { db } from '../prisma';
import { publicResultSnapshot } from './result-snapshot';
import type { Contest } from './contests';
import { isSchoolMediaUrl } from './election-type-input';
import { env } from '../env';

export async function getResultDisplayLogos(contests: Pick<Contest, 'organization' | 'logoUrl'>[], origin: string) {
  const logos = new Map(contests.map(contest => [contest.organization, contest.logoUrl]));
  const missing = contests.filter(contest => !contest.logoUrl).map(contest => contest.organization);
  if (missing.length) {
    try {
      const types = await db.electionType.findMany({ where: { code: { in: missing }, logoUrl: { not: null } }, select: { code: true, logoUrl: true } });
      for (const type of types) {
        if (type.logoUrl && isSchoolMediaUrl(type.logoUrl, origin, env('R2_PUBLIC_URL'))) logos.set(type.code, type.logoUrl);
      }
    } catch {
      // Missing branding must not hide the official result when the optional lookup fails.
      console.warn('E-voting result logo lookup unavailable');
    }
  }
  return logos;
}

export async function getPublishedResult(where: { id: string } | { slug: string }) {
  const period = await db.electionPeriod.findFirst({ where: { ...where, state: { in: ['CLOSED', 'ARCHIVED'] }, publishedAt: { not: null } },
    select: { id: true, slug: true, name: true, academicYear: true, state: true, closedAt: true, publishedAt: true, resultSnapshot: true } });
  if (!period) return null;
  const result = publicResultSnapshot(period.resultSnapshot);
  if (!result) throw new Error('INVALID_RESULT_SNAPSHOT');
  return { period: { slug: period.slug, name: period.name, academicYear: period.academicYear, closedAt: period.closedAt, publishedAt: period.publishedAt }, result };
}
