import type { ProductItem } from '../typings'

export type ProductDetailTabKey =
  | 'Metadata'
  | 'Device'
  | 'AlarmRecord'
  | 'AlarmConfig'
  | 'DataAnalysis'
  | 'Firmware'
  | 'MetadataMap'
  | 'Invalid'
  | 'Dashboard'

export type ProductDetailTab = {
  key: ProductDetailTabKey
  labelKey: string
  icon: string
}

const legacyTabMap: Record<string, ProductDetailTabKey> = {
  Info: 'Device',
  Metadata: 'Metadata',
  Device: 'Device',
  AlarmRecord: 'AlarmRecord',
  Threshold: 'AlarmConfig',
  DataAnalysis: 'DataAnalysis',
  Firmware: 'Firmware',
  MetadataMap: 'MetadataMap',
  Invalid: 'Invalid',
  Dashboard: 'Dashboard',
}

export function supportsProductCodec(product: Partial<ProductItem>) {
  return product.features?.some(({ id }) => id === 'transparentCodec') ?? false
}

/** Builds direct product-detail entries while preserving existing feature switches. */
export function buildProductDetailTabs(product: Partial<ProductItem>, options: {
  showAlarm: boolean
  showRules?: boolean
  showFirmware: boolean
  showDashboard: boolean
  hasProductCodecProvider: boolean
  isNoCommunity: boolean
}): ProductDetailTab[] {
  const tabs: ProductDetailTab[] = [
    { key: 'Device', labelKey: 'Detail.index.478940-11', icon: 'WifiOutlined' },
    { key: 'Metadata', labelKey: 'Detail.index.478940-10', icon: 'ApartmentOutlined' },
  ]
  if (options.showRules !== false) tabs.push({ key: 'AlarmConfig', labelKey: 'PropertyRules.title', icon: 'ControlOutlined' })
  const features = product.features ?? []
  if (options.showAlarm) {
    tabs.push({ key: 'AlarmRecord', labelKey: 'Product.detail.alarmRecords', icon: 'AlertOutlined' })
    if (options.isNoCommunity) tabs.push({ key: 'Invalid', labelKey: 'Detail.index.478940-17', icon: 'FileTextOutlined' })
  }
  if (options.hasProductCodecProvider && supportsProductCodec(product)) {
    tabs.push({ key: 'DataAnalysis', labelKey: 'Detail.index.478940-13', icon: 'LineChartOutlined' })
  }
  if (features.some((item) => item.id === 'supportFirmware') && options.showFirmware && options.isNoCommunity) {
    tabs.push({ key: 'Firmware', labelKey: 'Detail.index.478940-14', icon: 'CloudUploadOutlined' })
  }
  if (features.some((item) => item.id === 'diffMetadataSameProduct')) {
    tabs.push({ key: 'MetadataMap', labelKey: 'Detail.index.478940-15', icon: 'SwapOutlined' })
  }
  if (options.showDashboard) tabs.push({ key: 'Dashboard', labelKey: 'Detail.index.478940-20', icon: 'DashboardOutlined' })
  return tabs
}

/** Converts saved legacy or current direct detail parameters into a visible entry key. */
export function resolveProductDetailTab(key: unknown, tabs: ProductDetailTab[]): ProductDetailTabKey {
  const requestedKey = String(key ?? '')
  const candidate = tabs.find((item) => item.key === requestedKey)?.key || legacyTabMap[requestedKey]
  return tabs.some((item) => item.key === candidate) ? candidate : tabs[0]?.key || 'Device'
}
