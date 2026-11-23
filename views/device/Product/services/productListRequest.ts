import { queryDetailList, queryNoPagingPost } from '../../../../api/product'

type BrandField = 'manufacturer' | 'model' | 'i18nManufacturer' | 'i18nModel'
type ProductBrand = { id: string } & Partial<Record<BrandField, string | null>>
type ProductListRow = ProductBrand & Record<string, unknown>
const brandFields: BrandField[] = ['manufacturer', 'model', 'i18nManufacturer', 'i18nModel']

/** 旧版详情列表缺少品牌型号，按当前页 ID 批量补齐；保留原分页、设备数量和记录顺序。 */
export async function queryProductList(params: Record<string, unknown>, options?: { signal?: AbortSignal }) {
  const config = options?.signal ? { signal: options.signal } : undefined
  const response = await queryDetailList(params, config)
  const rows: ProductListRow[] | undefined = response.result?.data
  if (!response.success || !rows?.length || options?.signal?.aborted) return response

  const ids = [...new Set(rows.map(row => row.id).filter(id => typeof id === 'string' && id.length > 0))]
  if (!ids.length) return response

  let brands: Awaited<ReturnType<typeof queryNoPagingPost>>
  try {
    brands = await queryNoPagingPost({
      paging: false,
      includes: ['id', 'manufacturer', 'model', 'i18nMessages'],
      terms: [{ column: 'id', termType: 'in', value: ids }],
    }, config)
  } catch (error) {
    if (options?.signal?.aborted) throw error
    // 补查失败沿用请求层的错误提示，保留已成功加载的列表供查看和重试。
    return response
  }
  if (!brands.success || !Array.isArray(brands.result) || options?.signal?.aborted) return response

  const byId = new Map<string, ProductBrand>(brands.result.map((brand: ProductBrand) => [brand.id, brand]))
  return {
    ...response,
    result: {
      ...response.result,
      data: rows.map(row => {
        const brand = byId.get(row.id)
        if (!brand) return row
        const merged = { ...row }
        // 只合并品牌字段，不能用补查实体覆盖详情接口的设备数量、枚举或其他扩展数据。
        brandFields.forEach(field => { if (brand[field] !== undefined) merged[field] = brand[field] })
        return merged
      }),
    },
  }
}
