import { onBeforeUnmount, ref } from 'vue'
import { handleDeviceAlarm } from '../workspaceApi'
import { canHandleRecord } from '../workspaceUtils'
import type { DeviceAlarmEvent } from '../workspaceTypes'

/** 工作区和设备详情共用处理流程，由入口提供当前告警处理授权。 */
export function useDeviceAlarmHandling(t: (key: string, params?: Record<string, unknown>) => string,
  onHandled: (record: DeviceAlarmEvent) => Promise<void>, canHandle: () => boolean) {
  const record = ref<DeviceAlarmEvent>()
  const description = ref('')
  const error = ref('')
  const busy = ref(false)
  let disposed = false
  function show(value: DeviceAlarmEvent) {
    if (!canHandle() || busy.value || !canHandleRecord(value)) return
    record.value = value
    description.value = ''
    error.value = ''
  }
  function close() { if (!busy.value) record.value = undefined }
  async function submit() {
    const current = record.value
    // 弹窗打开后授权可能改变，提交时再次校验，不能只依赖按钮显隐。
    if (!canHandle() || !current || busy.value) return
    if (!description.value.trim() || description.value.trim().length > 200) {
      error.value = t('DeviceAlarm.workspace.handleValidation')
      return
    }
    busy.value = true
    error.value = ''
    try {
      await handleDeviceAlarm(current, description.value)
    } catch {
      if (!disposed) { error.value = t('DeviceAlarm.workspace.handleError'); busy.value = false }
      return
    }
    if (disposed) return
    record.value = undefined
    busy.value = false
    // 成功提交后再刷新服务端状态，刷新失败不误报为处理失败，也不重复提交。
    await onHandled(current)
  }
  onBeforeUnmount(() => { disposed = true })
  return { record, description, error, busy, show, close, submit }
}
