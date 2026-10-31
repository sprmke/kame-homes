export type AdminListView = 'table' | 'card' | 'calendar';

export function parseAdminListView(
  params: URLSearchParams,
  fallback: AdminListView = 'table'
): AdminListView {
  const viewRaw = params.get('view');
  if (viewRaw === 'card' || viewRaw === 'calendar') return viewRaw;
  return fallback;
}
