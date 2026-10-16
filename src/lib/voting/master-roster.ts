import { randomUUID } from 'node:crypto';
import { RosterError } from './voter-roster-input';

export type MasterVoter = { id: string; nisn: string; name: string; className: string };
export type ExistingVoter = { studentId: string | null; nisn: string | null };

export function validateStudentSelection(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !('studentIds' in value)) throw new RosterError('INVALID_INPUT');
  const ids = (value as Record<string, unknown>).studentIds;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!Array.isArray(ids) || !ids.length || ids.length > 99 || ids.some(id => typeof id !== 'string' || !uuid.test(id)) ||
      new Set(ids.map(id => id.toLowerCase())).size !== ids.length) throw new RosterError('INVALID_INPUT');
  return ids.map(id => id.toLowerCase());
}

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
