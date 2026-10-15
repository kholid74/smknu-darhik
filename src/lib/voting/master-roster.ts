import { randomUUID } from 'node:crypto';

export type MasterVoter = { id: string; nisn: string; name: string; className: string };
export type ExistingVoter = { studentId: string; nisn: string };

export function planMasterRoster(students: MasterVoter[], existing: ExistingVoter[]) {
  const ids = new Set(existing.map((voter) => voter.studentId));
  const nisns = new Set(existing.map((voter) => voter.nisn));
  const additions = students.filter((student) => !ids.has(student.id));
  return {
    additions,
    alreadyPresent: students.length - additions.length,
    nisnConflict: additions.some((student) => nisns.has(student.nisn)),
  };
}

export function buildMasterRosterInserts(periodId: string, students: MasterVoter[], organizations: string[]) {
  const voters = students.map(({ id: studentId, ...snapshot }) => ({
    id: randomUUID(), periodId, studentId, ...snapshot, credentialEnabled: false,
  }));
  return {
    voters,
    participation: voters.flatMap(({ id: voterId }) => organizations.map((organization) => ({ voterId, periodId, organization }))),
  };
}
