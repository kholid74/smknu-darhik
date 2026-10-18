import { ORGANIZATION_CODE } from './contests';
export type VoteInput = { organization: string; candidateId: string };

export class VoteInputError extends Error {
  constructor(public code: string) { super(code); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateVoteInput(value: unknown): VoteInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new VoteInputError('INVALID_INPUT');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || Object.keys(input).some((key) => !['organization', 'candidateId'].includes(key)) ||
      typeof input.organization !== 'string' || !ORGANIZATION_CODE.test(input.organization) ||
      typeof input.candidateId !== 'string' || !UUID.test(input.candidateId)) throw new VoteInputError('INVALID_INPUT');
  return { organization: input.organization as VoteInput['organization'], candidateId: input.candidateId };
}
