export function voterStatus(hasVoted: boolean) {
  return hasVoted
    ? { label: 'Sudah memilih', tone: 'success' as const, icon: '✓' }
    : { label: 'Belum memilih', tone: 'neutral' as const, icon: '○' };
}
