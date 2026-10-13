// Preserve bookmarks and record IDs after retiring the classic UI.
export const LEGACY_ROUTES: Record<string, string> = {
  '/dashboard': '/v3/home', '/dashboard/home': '/v3/home',
  '/dashboard/stock': '/v3/stock', '/dashboard/add': '/v3/stock?add=1', '/dashboard/sell': '/v3/sell',
  '/dashboard/history': '/v3/sales/history', '/dashboard/reports': '/v3/reports/detailed',
  '/dashboard/parts': '/v3/parts', '/dashboard/parts/add': '/v3/parts?add=1', '/dashboard/parts/edit': '/v3/parts',
  '/dashboard/pawn': '/v3/pawn', '/dashboard/pawn/stock': '/v3/pawn', '/dashboard/pawn/add': '/v3/pawn/add',
  '/dashboard/pawn/redeem': '/v3/pawn', '/dashboard/pawn/history': '/v3/pawn/history',
  '/dashboard/installment': '/v3/installment', '/dashboard/installment/stock': '/v3/installment',
  '/dashboard/installment/add': '/v3/installment?add=1', '/dashboard/installment/detail': '/v3/installment/detail',
  '/dashboard/installment/history': '/v3/installment/history',
  '/dashboard/goods/stock': '/v3/goods', '/dashboard/goods/add': '/v3/goods?add=1',
  '/dashboard/goods/sell': '/v3/goods?sell=1', '/dashboard/goods/history': '/v3/goods/history',
  '/dashboard/goods/print': '/v3/goods/print', '/dashboard/repair': '/v3/repair',
  '/dashboard/repair/new': '/v3/repair?new=1', '/dashboard/repair/edit': '/v3/repair/detail',
  '/dashboard/settings': '/v3/settings', '/dashboard/users': '/v3/users',
  '/dashboard/backup': '/v3/backup', '/dashboard/suppliers': '/v3/suppliers',
  '/super-admin': '/v3/super-admin', '/super-admin/users': '/v3/super-admin/users/manage',
  '/super-admin/online': '/v3/super-admin/online', '/super-admin/beta': '/v3/super-admin/beta',
  '/super-admin/activity': '/v3/super-admin/activity', '/super-admin/feedback': '/v3/super-admin/feedback/manage',
};
export function legacyDestination(url: URL): URL | null {
  const path = url.pathname.replace(/\/$/, '');
  const destination = LEGACY_ROUTES[path];
  if (!destination) return null;
  const target = new URL(destination, url.origin);
  for (const [key, value] of url.searchParams) if (key !== 'old' && !target.searchParams.has(key)) target.searchParams.append(key, value);
  if (path === '/dashboard/parts/edit' && url.searchParams.has('id')) {
    target.searchParams.set('edit', url.searchParams.get('id')!);
    target.searchParams.delete('id');
  }
  return target;
}
