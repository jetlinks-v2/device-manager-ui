import { cloneDeep } from 'lodash-es'
import { modify, updateDevice } from '../../../../../api/product'
import { savePluginData } from '../../../../../api/link/plugin'
import type { AccessSaveData } from './accessState'

/** 两次更新使用同一份快照，首个请求失败时停止后续写入。 */
export async function saveProductAccess(data: AccessSaveData, metadata: string) {
  const snapshot = cloneDeep(data)
  const { access, id, productTypeId } = snapshot
  const { storePolicy, ...configuration } = snapshot.values
  const response = await updateDevice({
    ...snapshot.product,
    id,
    metadata,
    configuration,
    storePolicy,
    transportProtocol: access.transport || '',
    protocolName: access.protocolDetail?.name || '',
    accessId: access.id,
    accessName: access.name,
    accessProvider: access.provider,
    messageProtocol: access.protocol || '',
  })
  if (!response.success) return response
  if (access.provider === 'plugin_gateway' && productTypeId) {
    await savePluginData('product', access.id, id, productTypeId)
  }
  return modify(id, { id, configuration, storePolicy })
}
