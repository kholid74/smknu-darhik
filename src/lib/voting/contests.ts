export const ORGANIZATION_CODE = /^[A-Z][A-Z0-9_]{1,31}$/;
export const contestSelect = {
  organization: true, nameSnapshot: true, logoUrlSnapshot: true, candidateModeSnapshot: true,
  chairLabelSnapshot: true, viceChairLabelSnapshot: true, sortOrder: true,
} as const;

export type Contest = {
  organization: string; name: string; logoUrl: string | null; candidateMode: 'SINGLE' | 'OPTIONAL_VICE';
  chairLabel: string; viceChairLabel: string | null; sortOrder: number;
};
type StoredContest = {
  organization: string; nameSnapshot: string; logoUrlSnapshot: string | null; candidateModeSnapshot: 'SINGLE' | 'OPTIONAL_VICE';
  chairLabelSnapshot: string; viceChairLabelSnapshot: string | null; sortOrder: number;
};

export function orderedContests<T extends { organization: string; sortOrder: number }>(contests: T[]): T[] {
  const ordered = [...contests].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!ordered.length || ordered.length > 20 || new Set(ordered.map(c => c.organization)).size !== ordered.length ||
      ordered.some((c, i) => !ORGANIZATION_CODE.test(c.organization) || c.sortOrder !== i + 1)) throw new Error('RECONCILIATION_FAILED');
  return ordered;
}

export function publicContests(contests: StoredContest[]): Contest[] {
  return orderedContests(contests).map(c => ({ organization: c.organization, name: c.nameSnapshot, logoUrl: c.logoUrlSnapshot,
    candidateMode: c.candidateModeSnapshot, chairLabel: c.chairLabelSnapshot, viceChairLabel: c.viceChairLabelSnapshot, sortOrder: c.sortOrder }));
}

export function votingProgress(contests: Array<{ organization: string; sortOrder: number }>, rights: Array<{ organization: string; hasVoted: boolean }>) {
  const ordered = orderedContests(contests);
  const byCode = new Map(rights.map(r => [r.organization, r.hasVoted]));
  if (rights.length !== ordered.length || byCode.size !== ordered.length || ordered.some(c => typeof byCode.get(c.organization) !== 'boolean')) {
    throw new Error('RECONCILIATION_FAILED');
  }
  const participation = Object.fromEntries(ordered.map(c => [c.organization, byCode.get(c.organization)!]));
  const nextOrganization = ordered.find(c => !participation[c.organization])?.organization ?? null;
  return { participation, complete: nextOrganization === null, nextOrganization };
}
