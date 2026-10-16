export type TextAnnouncement = {
  id: string;
  text: string;
  linkUrl: string | null;
  linkLabel: string;
  expiresAt: string | null;
};

function safeLink(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return ['http:', 'https:'].includes(new URL(value, 'https://school.invalid').protocol) ? value.trim() : null;
  } catch { return null; }
}

export function parseAnnouncements(value: unknown, now = Date.now()): TextAnnouncement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.text !== 'string' || !item.text.trim()) return [];
    const expiresAt = item.expiresAt ?? null;
    if (expiresAt !== null && (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now)) return [];
    return [{ id: item.id, text: item.text, linkUrl: safeLink(item.linkUrl), linkLabel: typeof item.linkLabel === 'string' && item.linkLabel ? item.linkLabel : 'Selengkapnya', expiresAt }];
  });
}

type AnnouncementRow = {
  id: string; title: string; body: string | null; linkUrl: string | null;
  linkLabel: string | null; expiresAt: Date | null; imageUrl?: string | null; active?: boolean;
};

export function toTextAnnouncements(rows: AnnouncementRow[], now = Date.now()): TextAnnouncement[] {
  return parseAnnouncements(rows.filter(row => row.active !== false && !row.imageUrl).map(row => ({
    id: row.id, text: row.body || row.title, linkUrl: row.linkUrl, linkLabel: row.linkLabel,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  })), now);
}
