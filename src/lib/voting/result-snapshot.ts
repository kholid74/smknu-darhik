export const VOTING_ORGANIZATIONS = ['OSIS', 'DEWAN_AMBALAN', 'IPNU', 'IPPNU'] as const;
export type VotingOrganizationName = typeof VOTING_ORGANIZATIONS[number];

type CandidateResult = {
  candidateId: string; ballotNumber: number; vision: string; mission: string; votes: number;
  chair: { name: string; className: string; photoUrl: string | null };
  viceChair: { name: string; className: string; photoUrl: string | null } | null;
};
type ContestResult = { organization: VotingOrganizationName; votesCast: number; candidates: CandidateResult[] };
export type ResultSnapshot = { version: 1; eligibleVoters: number; notStarted: number; partial: number; complete: number; contests: ContestResult[] };

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function publicResultSnapshot(value: unknown): ResultSnapshot | null {
  if (!isRecord(value) || value.version !== 1 || !isCount(value.eligibleVoters) || !isCount(value.notStarted) ||
      !isCount(value.partial) || !isCount(value.complete) || value.notStarted + value.partial + value.complete !== value.eligibleVoters ||
      !Array.isArray(value.contests) || value.contests.length !== 4) return null;
  const contests: ContestResult[] = [];
  for (const rawContest of value.contests) {
    if (!isRecord(rawContest) || !VOTING_ORGANIZATIONS.includes(rawContest.organization as VotingOrganizationName) ||
        !isCount(rawContest.votesCast) || !Array.isArray(rawContest.candidates) || contests.some((row) => row.organization === rawContest.organization)) return null;
    const candidates: CandidateResult[] = [];
    for (const raw of rawContest.candidates) {
      if (!isRecord(raw) || typeof raw.candidateId !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw.candidateId) ||
          !isCount(raw.ballotNumber) || raw.ballotNumber < 1 || typeof raw.vision !== 'string' || typeof raw.mission !== 'string' || !isCount(raw.votes)) return null;
      const member = (input: unknown) => isRecord(input) && typeof input.name === 'string' && typeof input.className === 'string' &&
        (input.photoUrl === null || typeof input.photoUrl === 'string')
        ? { name: input.name, className: input.className, photoUrl: input.photoUrl as string | null } : null;
      const chair = member(raw.chair);
      const viceChair = member(raw.viceChair);
      if (!chair || (raw.viceChair !== null && !viceChair)) return null;
      candidates.push({ candidateId: raw.candidateId, ballotNumber: raw.ballotNumber, vision: raw.vision, mission: raw.mission, votes: raw.votes, chair, viceChair });
    }
    if (candidates.reduce((sum, row) => sum + row.votes, 0) !== rawContest.votesCast) return null;
    contests.push({ organization: rawContest.organization as VotingOrganizationName, votesCast: rawContest.votesCast, candidates });
  }
  const totalVotes = contests.reduce((sum, contest) => sum + contest.votesCast, 0);
  if (totalVotes < value.complete * 4 || totalVotes > value.eligibleVoters * 4) return null;
  return { version: 1, eligibleVoters: value.eligibleVoters, notStarted: value.notStarted, partial: value.partial, complete: value.complete, contests };
}
