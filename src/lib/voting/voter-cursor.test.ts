import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeVoterCursor, encodeVoterCursor } from './voter-cursor';

const voterId = '123e4567-e89b-42d3-a456-426614174000';

test('voter cursors round-trip and reject malformed or non-canonical values', () => {
  assert.equal(decodeVoterCursor(encodeVoterCursor(voterId)), voterId);
  assert.equal(decodeVoterCursor(null), undefined);
  assert.throws(() => decodeVoterCursor('not-a-cursor'), /INVALID_CURSOR/);
  assert.throws(() => decodeVoterCursor(Buffer.from('not-a-uuid').toString('base64url')), /INVALID_CURSOR/);
});
