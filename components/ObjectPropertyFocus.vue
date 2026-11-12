<template>
  <a-select
    :value="selected"
    :options="options"
    :loading="loading"
    :disabled="disabled || loading || !modelId"
    :placeholder="t('ObjectPresentation.chooseProperties')"
    mode="multiple"
    option-filter-prop="label"
    style="width: 100%"
    @change="change"
  />
  <a-alert
    v-if="error"
    type="warning"
    :message="error"
  />
  <small v-else-if="modelId">{{ t('ObjectPresentation.currentProductScope') }}</small>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { objectCapabilitiesApi } from '@jetlinks-web-core/object-capability/api'
import { useDataCapabilityRequest } from '@jetlinks-web-core/data-capability/request'
import { useI18n } from 'vue-i18n'
const props = defineProps<{
  subject?: { typeId: string; id: string }
  parameters: Record<string, unknown>
  disabled?: boolean
}>()
const emit = defineEmits<{ change: [parameters: Record<string, unknown>] }>()
const { t } = useI18n()
const api = objectCapabilitiesApi({ request: useDataCapabilityRequest() })
const options = ref<Array<{ value: string; label: string }>>([]),
  loading = ref(false),
  error = ref('')
const modelId = ref('')
const selected = computed(() => (Array.isArray(props.parameters.properties) ? props.parameters.properties : []))
let generation = 0
let controller: AbortController | undefined
onBeforeUnmount(() => { generation++; controller?.abort() })
watch(
  () => [props.subject?.typeId, props.subject?.id],
  async () => {
    const current = ++generation
    controller?.abort()
    controller = new AbortController()
    const subject = props.subject
    options.value = []
    error.value = ''
    modelId.value = ''
    loading.value = !!subject
    if (!subject) return
    try {
      // 实例模型保留派生属性和可读范围；产品身份沿用原对象属性，避免放宽快照查询范围。
      const [models, properties] = await Promise.all([
        api.models(subject.typeId, subject.id, controller.signal),
        api.properties({ type: subject.typeId, id: subject.id }, subject.typeId, ['productId'], controller.signal),
      ])
      if (current !== generation) return
      const model = models.find((source) => source.providerId === 'device-data')
      const productId = properties.find((property) => property.property === 'productId')?.value
      if (!model || typeof productId !== 'string' || !productId)
        throw new Error(t('ObjectPresentation.propertiesUnavailable'))
      modelId.value = productId
      options.value = (model.metadata.properties || []).map((field) => ({ value: field.id, label: field.name || field.id }))
    } catch (cause) {
      if (current === generation) error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (current === generation) loading.value = false
    }
  },
  { immediate: true }
)
function change(value: unknown) {
  if (!props.disabled && !loading.value && Array.isArray(value) && modelId.value)
    emit('change', { ...props.parameters, properties: value.slice(0, 8), productIds: [modelId.value] })
}
</script>
