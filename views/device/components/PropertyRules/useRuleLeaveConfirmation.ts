import { onScopeDispose, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import { activeLogoutNavigation, useRuleLogoutNavigation } from './useRuleLogoutNavigation'

interface LeaveConfirmation {
  promise: Promise<boolean>
  resolve: (accepted: boolean) => void
  dialog?: ReturnType<typeof Modal.confirm>
}

/** Share one pending discard decision across concurrent navigation requests. */
export function useRuleLeaveConfirmation(t: (key: string) => string) {
  useRuleLogoutNavigation()
  let active: LeaveConfirmation | undefined
  function finish(confirmation: LeaveConfirmation, accepted: boolean) {
    // An old dialog's closing animation must not settle a newer decision.
    if (active !== confirmation) return
    active = undefined
    confirmation.resolve(accepted)
  }
  watch(activeLogoutNavigation, logout => {
    if (!logout || !active) return
    const confirmation = active
    finish(confirmation, true)
    confirmation.dialog?.destroy()
  }, { flush: 'sync' })
  onScopeDispose(() => {
    if (!active) return
    const confirmation = active
    finish(confirmation, false)
    confirmation.dialog?.destroy()
  })
  return () => {
    if (activeLogoutNavigation.value) return Promise.resolve(true)
    if (active) return active.promise
    let resolve!: LeaveConfirmation['resolve']
    const promise = new Promise<boolean>(done => { resolve = done })
    const confirmation: LeaveConfirmation = { promise, resolve }
    active = confirmation
    confirmation.dialog = Modal.confirm({
      title: t('PropertyRules.discard'),
      okText: t('PropertyRules.discardAction'),
      cancelText: t('DeviceAlarm.action.cancel'),
      onOk: () => finish(confirmation, true),
      onCancel: () => finish(confirmation, false),
      afterClose: () => finish(confirmation, false),
    })
    return promise
  }
}
