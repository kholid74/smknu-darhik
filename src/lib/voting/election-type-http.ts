import { json } from './admin-http';
import { ElectionTypeError } from './election-type-input';
import { PeriodError } from './period-input';

export function electionTypeFailure(error: unknown) {
  if (error instanceof ElectionTypeError || error instanceof PeriodError) {
    const status = error.code === 'NOT_FOUND' ? 404 : ['DUPLICATE_TYPE', 'DUPLICATE_SLUG', 'TYPE_IN_USE', 'STALE_CONFIG', 'INVALID_STATE', 'TYPE_INACTIVE', 'CONTEST_HAS_CANDIDATES', 'RECONCILIATION_FAILED'].includes(error.code) ? 409 : 400;
    return json({ error: { code: error.code } }, status);
  }
  const code = error instanceof Error ? error.message : '';
  if (['INVALID_INPUT', 'BODY_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE'].includes(code)) return json({ error: { code } }, code === 'BODY_TOO_LARGE' ? 413 : code === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : 400);
  return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
}
