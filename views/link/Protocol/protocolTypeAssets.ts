import { link } from '../../../assets'
import type { ProtocolTypeId } from './protocolTypes'

/** Ant Design Vue 图标名，用于编辑态类型行（AIcon），勿与图片混用 */
export const PROTOCOL_TYPE_FONT_ICON: Record<ProtocolTypeId, string> = {
  jar: 'FileZipOutlined',
  local: 'FolderOpenOutlined',
  marketplace: 'AppstoreOutlined',
}

export function protocolTypeFontIcon(type: string | undefined): string {
  if (!type) return 'FileOutlined'
  const k = String(type).trim().toLowerCase() as ProtocolTypeId
  return PROTOCOL_TYPE_FONT_ICON[k] ?? 'FileOutlined'
}

export const PROTOCOL_TYPE_ICON_URL: Record<ProtocolTypeId, string> = {
  jar: link.jar,
  local: link.local,
  marketplace: link.marketplace,
}

export function protocolTypeIconUrl(type: string | undefined): string | undefined {
  if (!type) return undefined
  const k = String(type).trim().toLowerCase() as ProtocolTypeId
  return PROTOCOL_TYPE_ICON_URL[k]
}
