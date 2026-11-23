import { ref, watch, type Ref } from 'vue'
import { iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import { isCodecSimulatorTransportSupported } from '../../../Instance/Detail/DeviceAccess/composables/useCodecSimulator'

/** 隐藏的接入摘要预载不查询调试能力；设备切换后丢弃旧查询结果。 */
export function useDeviceSimulatorSupport(deviceId: Readonly<Ref<string | undefined>>, transport: Readonly<Ref<string | undefined>>, enabled: Readonly<Ref<boolean>>) {
  const supported = ref(false)
  watch([deviceId, transport, enabled], async ([id, protocol, active], _, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    supported.value = false
    if (!id || !active || !isCodecSimulatorTransportSupported(protocol)) return
    try {
      const response = await iotDeviceDetailRealApi.existsDeviceCodecSimulateSupport()
      if (!cancelled) supported.value = response?.status === 200 && Boolean(response.result)
    } catch { /* 能力查询失败时不暴露不可用的发送入口。 */ }
  }, { immediate: true })
  return supported
}
