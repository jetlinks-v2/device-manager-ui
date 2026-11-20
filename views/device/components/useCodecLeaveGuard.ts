import { onScopeDispose } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'

interface CodecLeaveOptions {
  dirty: () => boolean
  busy: () => boolean
  save: () => Promise<boolean>
  discard: () => void
}

/** 解析配置沿用物模型的保存、不保存、关闭继续编辑语义。 */
export function useCodecLeaveGuard(options: CodecLeaveOptions) {
  const { t } = useI18n()
  let pending: Promise<boolean> | undefined
  let settle: ((accepted: boolean) => void) | undefined
  let dialog: ReturnType<typeof Modal.confirm> | undefined

  function confirmLeave(): Promise<boolean> {
    if (pending) return pending
    if (options.busy()) return Promise.resolve(false)
    if (!options.dirty()) return Promise.resolve(true)
    pending = new Promise(resolve => { settle = resolve })
    const current = pending
    const finish = (accepted: boolean) => {
      if (pending !== current) return
      pending = undefined
      settle?.(accepted)
      settle = undefined
      dialog = undefined
    }
    dialog = Modal.confirm({
      content: t('Base.Base.640395-18'),
      okText: t('Base.Base.640395-6'),
      cancelText: t('Base.Base.640395-19'),
      zIndex: 1400,
      closable: true,
      maskClosable: false,
      onOk: (close: () => void) => {
        if (options.busy()) return
        const currentDialog = dialog
        currentDialog?.update({ okButtonProps: { loading: true }, cancelButtonProps: { disabled: true }, closable: false, keyboard: false })
        // 保存失败时保留弹窗和草稿；关闭交由成功分支控制。
        void options.save().then(saved => {
          if (saved && !options.dirty()) { finish(true); close() }
        }).catch(() => {}).finally(() => {
          currentDialog?.update({ okButtonProps: { loading: false }, cancelButtonProps: { disabled: false }, closable: true, keyboard: true })
        })
      },
      onCancel: (...args: unknown[]) => {
        // Ant confirm 的关闭/ESC 回调带参数，底部“不保存”按钮无参数。
        if (args.length) { finish(false); return }
        options.discard()
        finish(true)
      },
      afterClose: () => finish(false),
    })
    return current
  }

  onBeforeRouteLeave(confirmLeave)
  onBeforeRouteUpdate(confirmLeave)
  onScopeDispose(() => {
    settle?.(false)
    pending = undefined
    dialog?.destroy()
  })
  return { confirmLeave }
}
