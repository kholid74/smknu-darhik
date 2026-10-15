// Only use for reads: replaying a write after a lost response could duplicate a committed mutation.
export async function retryDatabaseRead<T>(read: () => T): Promise<Awaited<T>> {
  try { return await read(); }
  catch { return await read(); }
}
