import { unref, watch } from 'vue'
import type { Form } from 'ant-design-vue'

type FormState = ReturnType<typeof Form.useForm>
type BlurValidation = Pick<FormState, 'validateInfos' | 'validate' | 'rulesRef'>
type BlurValidateInfo = FormState['validateInfos'][string] & {
  onBlurCapture?: () => void
}

/** 为已有 validateInfos 补充普通 FormItem 的失焦监听，在组件 setup 内调用。 */
export function useValidateInfosBlur({ validateInfos, validate, rulesRef }: BlurValidation): void {
  // 读取当前规则，避免字段移除或触发方式改变后，旧监听仍启动校验。
  const hasBlurRule = (name: string): boolean => {
    const rules: { trigger?: string | string[] }[] | undefined = unref(rulesRef)[name]
    return rules?.some(({ trigger }) =>
      Array.isArray(trigger) ? trigger.includes('blur') : trigger === 'blur',
    ) ?? false
  }

  // resetFields 和动态规则会替换字段信息；仅跟踪对象与触发规则，不监听校验状态。
  watch(
    () => Object.entries(validateInfos).map(([name, info]) => ({ name, info, blur: hasBlurRule(name) })),
    fields => {
      fields.forEach(({ name, info, blur }) => {
        const fieldInfo: BlurValidateInfo = info
        if (!blur) {
          delete fieldInfo.onBlurCapture
          return
        }
        fieldInfo.onBlurCapture = () => {
          if (!hasBlurRule(name)) return
          // 校验错误已经写入 validateInfos，由现有表单项展示。
          void validate([name], { trigger: 'blur' }).catch(() => {})
        }
      })
    },
    { immediate: true },
  )
}
