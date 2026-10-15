import { db } from '../prisma';
import { publicResultSnapshot } from './result-snapshot';

export async function getPublishedResult(where: { id: string } | { slug: string }) {
  const period = await db.electionPeriod.findFirst({ where: { ...where, state: { in: ['CLOSED', 'ARCHIVED'] }, publishedAt: { not: null } },
    select: { id: true, slug: true, name: true, academicYear: true, state: true, closedAt: true, publishedAt: true, resultSnapshot: true } });
  if (!period) return null;
  const result = publicResultSnapshot(period.resultSnapshot);
  if (!result) throw new Error('INVALID_RESULT_SNAPSHOT');
  return { period: { slug: period.slug, name: period.name, academicYear: period.academicYear, closedAt: period.closedAt, publishedAt: period.publishedAt }, result };
}
