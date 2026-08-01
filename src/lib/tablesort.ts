// Reusable server-side table sort untuk halaman list admin.
// Pakai: const s = tableSort(Astro.url, { nama:'nama', tanggal:'createdAt' }, [{ createdAt:'desc' }]);
// - s.orderBy  -> dipakai di prisma findMany
// - s.sortLink(col) / s.sortIcon(col) / s.sort -> header <SortTh>
// - s.mkQs({ page }) -> link pagination/filter yang jaga semua param

type Dir = 'asc' | 'desc';

export function tableSort(
  url: URL,
  sortCols: Record<string, string>,
  fallback: any[],
) {
  const sort = url.searchParams.get('sort') || '';
  const dir: Dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const col = sortCols[sort];
  const orderBy = col ? [{ [col]: dir }, ...fallback] : fallback;

  const mkQs = (ov: Record<string, string | number> = {}) => {
    const s = new URLSearchParams(url.search);
    for (const [k, v] of Object.entries(ov)) {
      if (v === '' || v === undefined || v === null) s.delete(k);
      else s.set(k, String(v));
    }
    const str = s.toString();
    return str ? `?${str}` : '';
  };

  // Klik header: toggle arah; kolom baru default desc; reset ke page 1
  const sortLink = (c: string) => mkQs({ sort: c, dir: sort === c && dir === 'desc' ? 'asc' : 'desc', page: 1 });
  const sortIcon = (c: string) => (sort !== c ? 'unfold_more' : dir === 'asc' ? 'arrow_upward' : 'arrow_downward');

  return { sort, dir, orderBy, mkQs, sortLink, sortIcon };
}
