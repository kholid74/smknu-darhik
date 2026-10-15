const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const VOTING_SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-smkdh_vote' : 'smkdh_vote_dev';

export type StudentRouteAccess = 'public' | 'protected' | 'forbidden' | 'unrelated';

export function studentRouteAccess(path: string): StudentRouteAccess {
  const votingApi = path.match(/^\/api\/e-voting\/([^/]+)\/(session|status|activity|votes|results)$/);
  if (path === '/siswa/masuk' || path === '/siswa/selesai' ||
      (votingApi && UUID.test(votingApi[1]) && (votingApi[2] === 'session' || votingApi[2] === 'results')) ||
      path === '/api/e-voting/logout') return 'public';
  if (path === '/siswa' || path.startsWith('/siswa/e-voting/')) return 'protected';
  if (path === '/api/siswa/dashboard' || (votingApi && UUID.test(votingApi[1]))) return 'protected';
  if (path.startsWith('/siswa/') || path.startsWith('/api/siswa/') || path.startsWith('/api/e-voting/')) return 'forbidden';
  return 'unrelated';
}

export function isActiveVotingSession(session: {
  scope: string; createdAt: Date; expiresAt: Date; credentialEnabled: boolean;
  periodState: string; opensAt: Date; closesAt: Date; completed: boolean;
}, now: Date) {
  return session.scope === 'ELECTION_VOTING' && session.credentialEnabled && !session.completed &&
    session.periodState === 'SCHEDULED' && session.opensAt <= now && now < session.closesAt &&
    session.expiresAt > now && session.createdAt.getTime() + 15 * 60_000 > now.getTime();
}

export function nextStudentSessionExpiry(createdAt: Date, now: Date, closesAt: Date) {
  const absoluteExpiresAt = new Date(Math.min(createdAt.getTime() + 15 * 60_000, closesAt.getTime()));
  return { idleExpiresAt: new Date(Math.min(now.getTime() + 5 * 60_000, absoluteExpiresAt.getTime())), absoluteExpiresAt };
}

export function isStudentSessionCookie(value: string | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function validVotingPeriodId(value: string | undefined): value is string {
  return !!value && UUID.test(value);
}
