import { votingProgress, type Contest } from './contests';

export function buildStudentDashboard(period: { id: string; slug: string; name: string; opensAt: Date; closesAt: Date }, contests: Contest[], rights: Array<{ organization: string; hasVoted: boolean }>, voterType = 'STUDENT') {
  const progress = votingProgress(contests, rights);
  return {
    scope: 'ELECTION_VOTING',
    period,
    contests,
    ...progress,
    services: [
      { id: 'e-voting', status: 'available' as const, href: `${voterType === 'TEACHER' ? '/pemilih' : '/siswa'}/e-voting/${period.slug}/pilih` },
      ...(voterType === 'TEACHER' ? [] : [
        { id: 'academic', label: 'Layanan Akademik', status: 'coming_soon' as const },
        { id: 'student', label: 'Layanan Siswa', status: 'coming_soon' as const },
      ]),
    ],
  };
}
