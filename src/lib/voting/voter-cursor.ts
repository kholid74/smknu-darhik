export function encodeVoterCursor(id: string) {
  return Buffer.from(id).toString('base64url');
}

export function decodeVoterCursor(cursor: string | null) {
  if (cursor === null) return undefined;
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('INVALID_CURSOR');
  const id = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || encodeVoterCursor(id) !== cursor) {
    throw new Error('INVALID_CURSOR');
  }
  return id;
}
