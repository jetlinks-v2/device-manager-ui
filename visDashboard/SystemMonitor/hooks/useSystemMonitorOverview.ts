import { computed, type Ref } from 'vue'
import { createSystemMonitorRuntime } from './useSystemMonitorRuntime'

/** 公开给概览的只读监控入口：复用采样、超时和离页清理，不读写运维图表聚焦偏好。 */
export function useSystemMonitorOverview(enabled: Ref<boolean>) {
  return createSystemMonitorRuntime(computed(() => !enabled.value), { persistFocus: false })
}
