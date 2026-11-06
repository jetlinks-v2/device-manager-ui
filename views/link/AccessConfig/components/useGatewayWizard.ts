import { computed, nextTick, onMounted, ref, type Ref } from 'vue'
import type { Composer } from 'vue-i18n'

export interface GatewaySummaryRow { label: string; value: unknown; block?: boolean }
export interface GatewayStep {
  id: number
  title: string
  hint?: string
  complete: boolean
  rows?: GatewaySummaryRow[]
  empty?: string
  builtin?: boolean
}
interface WizardOptions {
  current: Ref<number>
  initial: number
  steps: () => GatewayStep[]
  validate: (step: number) => Promise<boolean | void>
  save: () => unknown
}
/** 步骤仅负责展示；确定时依次校验所有真实表单，再调用原保存函数。 */
export function useGatewayWizard(options: WizardOptions) {
  const pending = ref(false)
  const steps = computed(options.steps)
  const select = (id: number) => { options.current.value = id }
  onMounted(async () => { await nextTick(); select(options.initial) })
  async function submit() {
    if (pending.value) return
    pending.value = true
    try {
      for (const step of steps.value) {
        try {
          if (await options.validate(step.id) === false) { select(step.id); return }
        } catch (error) {
          select(step.id)
          // Ant 表单已给出字段提示；非校验异常继续交给统一错误处理。
          if (!(error && typeof error === 'object' && 'errorFields' in error)) throw error
          return
        }
      }
      await options.save()
    } finally { pending.value = false }
  }
  return { current: options.current, steps, select, submit, pending }
}
export type GatewayWizard = ReturnType<typeof useGatewayWizard>
export interface GatewayBasicForm { name?: string; description?: string; bizKey?: string }
export function basicGatewayStep(t: Composer['t'], form: GatewayBasicForm, id: number): GatewayStep {
  return {
    id, title: t('GatewayEditor.basic'), hint: t('GatewayEditor.basicHint'),
    complete: Boolean(form.name), empty: t('GatewayEditor.emptyBasic'),
    rows: [
      { label: t('GatewayEditor.name'), value: form.name },
      { label: t('GatewayEditor.description'), value: form.description },
      { label: t('AccessConfig.bizKey.label'), value: form.bizKey },
    ],
  }
}
