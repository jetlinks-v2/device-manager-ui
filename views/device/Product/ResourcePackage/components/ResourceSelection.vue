<template>
  <a-card size="small" class="resource-selection">
    <template #title>{{ title }}</template>
    <a-descriptions size="small" :column="resourceType === 'network' ? 3 : 1">
      <a-descriptions-item :label="$t('Product.resourcePackage.001-7')">
        {{ packageResource?.name || '-' }}
      </a-descriptions-item>
      <template v-if="resourceType === 'network'">
        <a-descriptions-item :label="$t('Product.resourcePackage.001-53')">
          {{ displayValue(packageResource?.type) }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('Product.resourcePackage.001-54')">
          {{ publicAddress }}
        </a-descriptions-item>
      </template>
      <a-descriptions-item v-else :label="$t('Product.resourcePackage.001-52')">
        {{ description || '-' }}
      </a-descriptions-item>
    </a-descriptions>
    <a-space v-if="options.length" class="selection-source">
      <span>{{ $t('Product.resourcePackage.001-31') }}</span>
      <a-switch :checked="useLocal" @change="changeSource" />
    </a-space>
    <a-select
      v-if="useLocal"
      v-model:value="localId"
      :options="options"
      class="selection-local"
      @change="changeLocal"
    />
  </a-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  title: string
  resourceType: 'gateway' | 'network' | 'protocol' | 'certificate' | 'plugin'
  packageResource?: Record<string, any>
  options?: { label: string; value: string }[]
  modelValue?: Record<string, any>
}>()
const emit = defineEmits<{ 'update:modelValue': [value?: Record<string, any>] }>()
const { t: $t } = useI18n()
const localId = ref<string>()
const options = computed(() => props.options || [])
const useLocal = ref(false)
const description = computed(() => {
  const resource = props.packageResource
  return resource?.description || resource?.describe || ''
})

/** 网络组件只显示一个公网地址，集群场景固定取首个节点，避免导入页展开全部运行配置。 */
const publicAddress = computed(() => {
  const resource = props.packageResource
  const configuration = resource?.shareCluster === false
    ? resource?.cluster?.[0]?.configuration
    : resource?.configuration
  const host = configuration?.publicHost || configuration?.remoteHost
  const port = configuration?.publicPort || configuration?.remotePort
  if (!host || !port) return '-'
  const type = displayValue(resource?.type).toLowerCase()
  const protocol = configuration?.secure && type.includes('mqtt') ? 'mqtts' : type.split(/[_\s]/)[0]
  return `${protocol || 'tcp'}://${host}:${port}`
})

const displayValue = (value: any) => value && typeof value === 'object' ? (value.text || value.name || value.value) : value || '-'

watch(() => props.modelValue, value => {
  useLocal.value = value?.source === 'LOCAL'
  localId.value = useLocal.value ? value?.id : undefined
}, { immediate: true, deep: true })

/** 本地网关一旦被选中便立即通知父级，以便锁定其余依赖资源，待下拉选择完成后再补充 ID。 */
const changeSource = (checked: boolean) => {
  useLocal.value = checked
  if (checked) {
    emit('update:modelValue', { source: 'LOCAL', id: localId.value })
  } else {
    emit('update:modelValue', undefined)
  }
}

const changeLocal = (id?: string) => emit('update:modelValue', { source: 'LOCAL', id })
</script>

<style scoped>
.resource-selection { margin-top: 12px; }
.selection-source { margin-top: 12px; color: rgba(0, 0, 0, 0.65); }
.selection-local { display: block; margin-top: 12px; width: 100%; }
</style>
