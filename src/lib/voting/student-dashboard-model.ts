export const VOTING_ORGANIZATIONS = ['OSIS', 'DEWAN_AMBALAN', 'IPNU', 'IPPNU'] as const;

export function buildStudentDashboard(period: { id: string; slug: string; name: string; opensAt: Date; closesAt: Date }, voted: string[], voterType = 'STUDENT') {
  const participation = Object.fromEntries(VOTING_ORGANIZATIONS.map((organization) => [organization, voted.includes(organization)])) as Record<typeof VOTING_ORGANIZATIONS[number], boolean>;
  const nextOrganization = VOTING_ORGANIZATIONS.find((organization) => !participation[organization]) ?? null;
  return {
    scope: 'ELECTION_VOTING',
    period,
    participation,
    complete: nextOrganization === null,
    nextOrganization,
    services: [
      { id: 'e-voting', status: 'available' as const, href: `${voterType === 'TEACHER' ? '/pemilih' : '/siswa'}/e-voting/${period.slug}/pilih` },
      ...(voterType === 'TEACHER' ? [] : [
        { id: 'academic', label: 'Layanan Akademik', status: 'coming_soon' as const },
        { id: 'student', label: 'Layanan Siswa', status: 'coming_soon' as const },
      ]),
    ],
  };
}
