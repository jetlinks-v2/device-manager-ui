export interface PluginListQuery { terms?: unknown[] }
export interface PluginListCursor { createTime: number; id: string }
export const pluginListBatchSize = 32

export function pluginListRequest(query: PluginListQuery, cursor?: PluginListCursor) {
  const terms: unknown[] = query.terms?.length ? [{ terms: query.terms }] : []
  if (cursor) terms.push({ terms: [
    { column: 'createTime', termType: 'lt', value: cursor.createTime },
    { type: 'or', terms: [
      { column: 'createTime', termType: 'eq', value: cursor.createTime },
      { column: 'id', termType: 'lt', value: cursor.id },
    ] },
  ] })
  return { terms, paging: true, pageIndex: 0, pageSize: pluginListBatchSize,
    sorts: [{ name: 'createTime', order: 'desc' }, { name: 'id', order: 'desc' }] }
}
