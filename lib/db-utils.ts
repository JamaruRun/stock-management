/** Supabase (PostgREST) caps every response at 1000 rows by default, silently, even with no .limit() called.
 * Any query expected to return "all rows for this shop" must page through with .range() once row counts
 * can exceed 1000 - otherwise older/later rows just vanish from the result with no error thrown anywhere.
 * queryBuilder must return a *fresh* unexecuted query each call (so .range() can be re-applied per page). */
export async function fetchAllRows<T = any>(
  queryBuilder: () => any,
  pageSize = 1000
): Promise<T[]> {
  let all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryBuilder().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
