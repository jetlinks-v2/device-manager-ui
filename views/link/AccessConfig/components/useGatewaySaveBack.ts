import { inject } from 'vue'
import { useTabSaveSuccessBack } from '@jetlinks-web-core/hooks'
import { gatewayChildSaveKey } from './gatewayEditorContext'

/** 内嵌子网关只回传草稿；普通与外部创建入口继续走原跨标签回传。 */
export function useGatewaySaveBack() {
  const external = useTabSaveSuccessBack()
  const saveChild = inject(gatewayChildSaveKey, undefined)
  return saveChild ? { onBack: saveChild } : external
}
