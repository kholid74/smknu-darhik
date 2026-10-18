import { ORGANIZATION_CODE, type Contest } from './contests';

type MemberResult = { name: string; className: string; photoUrl: string | null };
type CandidateResult = {
  candidateId: string; ballotNumber: number; vision: string; mission: string; votes: number;
  chair: MemberResult; viceChair: MemberResult | null;
};
type ContestResult = Contest & { votesCast: number; candidates: CandidateResult[] };
export type ResultSnapshot = { version: 2; eligibleVoters: number; notStarted: number; partial: number; complete: number; contests: ContestResult[] };

const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown, max = 99): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max;
const media = (v: unknown): v is string | null => v === null || (typeof v === 'string' && v.length <= 1024 && /^(?:https?:\/\/|\/api\/image\/).+/.test(v));
const member = (v: unknown): MemberResult | null => record(v) && text(v.name, 120) && text(v.className, 40) && media(v.photoUrl)
  ? { name: v.name, className: v.className, photoUrl: v.photoUrl } : null;

// Project only public fields: snapshots must never expose IDs from the Student/voter master.
export function publicResultSnapshot(value: unknown): ResultSnapshot | null {
  if (!record(value) || value.version !== 2 || !count(value.eligibleVoters) || !value.eligibleVoters ||
      !count(value.notStarted) || !count(value.partial) || !count(value.complete) ||
      value.notStarted + value.partial + value.complete !== value.eligibleVoters ||
      !Array.isArray(value.contests) || !value.contests.length || value.contests.length > 20) return null;
  const contests: ContestResult[] = [], codes = new Set<string>(), ids = new Set<string>();
  for (const [i, c] of value.contests.entries()) {
    if (!record(c) || typeof c.organization !== 'string' || !ORGANIZATION_CODE.test(c.organization) || codes.has(c.organization) ||
        !text(c.name, 120) || !media(c.logoUrl) || !text(c.chairLabel, 80) || c.sortOrder !== i + 1 ||
        !['SINGLE', 'OPTIONAL_VICE'].includes(c.candidateMode) ||
        (c.candidateMode === 'SINGLE' ? c.viceChairLabel !== null : !text(c.viceChairLabel, 80)) ||
        !count(c.votesCast) || c.votesCast < value.complete || c.votesCast > value.complete + value.partial ||
        !Array.isArray(c.candidates) || !c.candidates.length) return null;
    codes.add(c.organization);
    const candidates: CandidateResult[] = [], numbers = new Set<number>();
    for (const raw of c.candidates) {
      if (!record(raw) || typeof raw.candidateId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.candidateId) ||
          ids.has(raw.candidateId.toLowerCase()) || !count(raw.ballotNumber, 2147483647) || !raw.ballotNumber || numbers.has(raw.ballotNumber) ||
          !text(raw.vision, 2000) || !text(raw.mission, 2000) || !count(raw.votes)) return null;
      const chair = member(raw.chair), viceChair = member(raw.viceChair);
      if (!chair || (raw.viceChair !== null && !viceChair) || (c.candidateMode === 'SINGLE' && raw.viceChair !== null)) return null;
      ids.add(raw.candidateId.toLowerCase()); numbers.add(raw.ballotNumber);
      candidates.push({ candidateId: raw.candidateId, ballotNumber: raw.ballotNumber, vision: raw.vision, mission: raw.mission, votes: raw.votes, chair, viceChair });
    }
    if (candidates.reduce((sum, row) => sum + row.votes, 0) !== c.votesCast) return null;
    contests.push({ organization: c.organization, name: c.name, logoUrl: c.logoUrl, candidateMode: c.candidateMode,
      chairLabel: c.chairLabel, viceChairLabel: c.viceChairLabel, sortOrder: c.sortOrder, votesCast: c.votesCast, candidates });
  }
  const n = contests.length, totalVotes = contests.reduce((sum, c) => sum + c.votesCast, 0);
  if (totalVotes < value.complete * n + value.partial || totalVotes > value.complete * n + value.partial * (n - 1) || (n === 1 && value.partial)) return null;
  return { version: 2, eligibleVoters: value.eligibleVoters, notStarted: value.notStarted, partial: value.partial, complete: value.complete, contests };
}
