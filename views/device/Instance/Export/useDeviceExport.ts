import { paramsEncodeQuery } from '@jetlinks-web-core/utils/encodeQuery'
import { getToken } from '@jetlinks-web/utils'
import { TOKEN_KEY_URL } from '@jetlinks-web/constants'
import { getBaseApi } from '@jetlinks-web-core/utils'

/** 导出沿用当前设备条件，选择产品时追加产品范围，文件后缀与选中的格式一致。 */
export function useDeviceExport() {
  function exportDevices(productId: string, fileType: 'xlsx' | 'csv', data?: Record<string, unknown>) {
    const query = paramsEncodeQuery(data)
    const params = new URLSearchParams({ [TOKEN_KEY_URL]: getToken() })
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
    })
    const productPath = productId ? `/${encodeURIComponent(productId)}` : ''
    window.open(`${window.location.origin}${getBaseApi()}/device-instance${productPath}/export.${fileType}?${params}`)
  }

  return { exportDevices }
}
