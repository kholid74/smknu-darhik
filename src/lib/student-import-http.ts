import { StudentError } from './students-input';

export async function readStudentCsv(request: Request) {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'text/csv') throw new StudentError('UNSUPPORTED_MEDIA_TYPE');
  const reader = request.body?.getReader();
  if (!reader) throw new StudentError('INVALID_INPUT');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 256 * 1024) {
      await reader.cancel();
      throw new StudentError('FILE_TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new StudentError('INVALID_CSV_ENCODING'); }
}
