<template>
  <a-select
    :value="selected"
    :options="options"
    :loading="loading"
    :disabled="disabled || !subject"
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
import { request } from '@jetlinks-web/core'
import { useI18n } from 'vue-i18n'
const props = defineProps<{
  subject?: { typeId: string; id: string }
  parameters: Record<string, unknown>
  disabled?: boolean
}>()
const emit = defineEmits<{ change: [parameters: Record<string, unknown>] }>()
const { t } = useI18n()
const options = ref<Array<{ value: string; label: string }>>([]),
  loading = ref(false),
  error = ref('')
const modelId = ref('')
const selected = computed(() => (Array.isArray(props.parameters.properties) ? props.parameters.properties : []))
let generation = 0
onBeforeUnmount(() => generation++)
watch(
  () => props.subject?.id,
  async (id) => {
    const current = ++generation
    options.value = []
    error.value = ''
    modelId.value = ''
    loading.value = !!id
    if (!id) return
    try {
      const response = await request.get(`/device-instance/${encodeURIComponent(id)}/property-metadata`)
      if (current !== generation) return
      if (!response.success) throw new Error(response.message || t('ObjectPresentation.propertiesUnavailable'))
      const metadata = response.result as { modelId: string; properties: Array<{ id: string; name?: string }> }
      modelId.value = metadata.modelId
      options.value = (metadata.properties || []).map((field) => ({ value: field.id, label: field.name || field.id }))
    } catch (cause) {
      if (current === generation) error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (current === generation) loading.value = false
    }
  },
  { immediate: true }
)
function change(value: unknown) {
  if (Array.isArray(value) && modelId.value)
    emit('change', { ...props.parameters, properties: value.slice(0, 8), productIds: [modelId.value] })
}
</script>
