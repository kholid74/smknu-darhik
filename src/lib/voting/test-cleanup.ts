import {db} from '../prisma';
import {getPrincipal} from '../auth';
import {reauthenticateAdmin} from './periods';
import {PeriodError} from './period-input';
import {assertTestCleanupAllowed, canDeleteTestPeriod, type TestCleanupPreview, type validateTestCleanupInput} from './test-cleanup-input';

export async function previewTestCleanup(periodId: string) {
  const [{data}] = await db.$queryRaw<Array<{data: TestCleanupPreview | null}>>`
    SELECT evoting_test_cleanup_preview(${periodId}::uuid) AS data`;
  assertTestCleanupAllowed(data);
  return data;
}

export async function deleteTestPeriod(periodId: string, actorId: string, input: ReturnType<typeof validateTestCleanupInput>) {
  if (!canDeleteTestPeriod(await getPrincipal(actorId))) throw new PeriodError('FORBIDDEN');
  await reauthenticateAdmin(actorId, input.adminPassword);
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
    await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
    const [{data}] = await tx.$queryRaw<Array<{data: TestCleanupPreview | {error: string}}>>`
      SELECT evoting_delete_test_period(${periodId}::uuid, ${actorId}, ${input.confirmation}, ${input.previewVersion}) AS data`;
    if ('error' in data) throw new PeriodError(data.error);
    return data;
  }, {maxWait: 2_000, timeout: 15_000});
}
