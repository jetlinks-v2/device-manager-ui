<template>
  <section class="resource-selection">
    <header class="resource-selection__header">
      <strong class="resource-selection__title">{{ title }}</strong>
    </header>

    <div class="resource-selection__summary">
      <div class="resource-selection__identity">
        <span class="resource-selection__icon"><AIcon :type="resourceIcon" /></span>
        <div>
          <strong>{{ packageResource?.name }}</strong>
          <span>{{ resourceTypeName(packageResource) }}</span>
        </div>
      </div>

      <div class="resource-selection__details">
        <div v-if="resourceType === 'network'" class="resource-selection__detail">
          <small>{{ $t('Product.resourcePackage.001-54') }}</small>
          <span>{{ publicAddress }}</span>
        </div>
        <div v-if="resourceType === 'network'" class="resource-selection__detail resource-selection__detail--wide">
          <small>{{ $t('Product.resourcePackage.001-52') }}</small>
          <span>{{ description }}</span>
        </div>
        <template v-else-if="resourceType === 'gateway'">
          <div class="resource-selection__detail resource-selection__detail--wide">
            <small>{{ $t('Product.resourcePackage.001-52') }}</small>
            <span>{{ description }}</span>
          </div>
        </template>
        <template v-else-if="resourceType === 'plugin'">
          <div class="resource-selection__detail">
            <small>{{ $t('plugin.index.293829-4') }}</small>
            <span>{{ packageResource?.version }}</span>
          </div>
          <div class="resource-selection__detail resource-selection__detail--wide">
            <small>{{ $t('Product.resourcePackage.001-52') }}</small>
            <span>{{ description }}</span>
          </div>
        </template>
        <div v-else class="resource-selection__detail resource-selection__detail--wide">
          <small>{{ $t('Product.resourcePackage.001-52') }}</small>
          <span>{{ description }}</span>
        </div>
      </div>
    </div>

    <div v-if="options.length" class="resource-selection__source-panel">
      <div class="resource-selection__source-choice">
        <span>{{ $t('Product.resourcePackage.001-70') }}</span>
        <a-segmented v-model:value="resourceSource" size="small" :options="sourceOptions" />
      </div>
      <div v-if="matchingLocalOption && !useLocal" class="resource-selection__conflict">
        <AIcon type="ExclamationCircleFilled" />
        <span>{{ $t('Product.resourcePackage.001-69') }}</span>
      </div>
    </div>

    <a-form-item
      v-if="useLocal"
      class="resource-selection__local"
      :label="$t('Product.resourcePackage.001-62')"
      required
      :validate-status="isLocalSelectionInvalid ? 'error' : undefined"
      :help="isLocalSelectionInvalid ? $t('Product.resourcePackage.001-61') : undefined"
    >
      <a-select
        v-model:value="localId"
        class="resource-selection__select"
        option-label-prop="label"
        :dropdown-match-select-width="false"
        :placeholder="$t('Product.resourcePackage.001-61')"
        @change="changeLocal"
      >
        <a-select-option v-for="option in options" :key="option.value" :value="option.value" :label="option.label">
          <div class="resource-selection__option">
            <strong>{{ option.label }}</strong>
            <div class="resource-selection__option-meta">
              <span>{{ optionTypeLabel(option) }}：{{ resourceTypeName(option.resource, option.type) }}</span>
              <span v-if="resourceType === 'network'">{{ $t('Product.resourcePackage.001-54') }}：{{ optionPublicAddress(option) }}</span>
              <span v-else-if="resourceType === 'plugin'">{{ $t('plugin.index.293829-4') }}：{{ option.version }}</span>
              <span v-else>{{ $t('Product.resourcePackage.001-52') }}：{{ option.description }}</span>
            </div>
          </div>
        </a-select-option>
      </a-select>
    </a-form-item>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPluginTypeLabel } from '../../../../link/plugin/util'

interface LocalResourceOption {
  label: string
  value: string
  type?: string
  version?: string
  description?: string
  resource?: Record<string, any>
}

const props = defineProps<{
  title: string
  resourceType: 'gateway' | 'network' | 'protocol' | 'certificate' | 'plugin'
  packageResource?: Record<string, any>
  options?: LocalResourceOption[]
  modelValue?: Record<string, any>
  resourceTypeLabel?: string
  showValidation?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value?: Record<string, any>] }>()
const { t: $t } = useI18n()
const localId = ref<string>()
const options = computed(() => props.options || [])
const useLocal = ref(false)
const isLocalSelectionInvalid = computed(() => Boolean(props.showValidation && useLocal.value && !localId.value))
const matchingLocalOption = computed(() => props.packageResource?.id
  ? options.value.find(option => option.value === props.packageResource?.id)
  : undefined)
const sourceOptions = computed(() => [
  { label: $t('Product.resourcePackage.001-71'), value: 'package' },
  { label: $t('Product.resourcePackage.001-72'), value: 'local' },
])
const description = computed(() => {
  const resource = props.packageResource
  return resource?.description || resource?.describe || ''
})
const resourceIcon = computed(() => ({
  gateway: 'GatewayOutlined',
  network: 'GlobalOutlined',
  protocol: 'ApiOutlined',
  certificate: 'SafetyCertificateOutlined',
  plugin: 'AppstoreOutlined',
})[props.resourceType])

/** 网络组件只显示一个公网地址，集群场景固定取首个节点，避免导入页展开全部运行配置。 */
const getPublicAddress = (resource?: Record<string, any>) => {
  const configuration = resource?.shareCluster === false
    ? resource?.cluster?.[0]?.configuration
    : resource?.configuration
  const host = configuration?.publicHost || configuration?.remoteHost
  const port = configuration?.publicPort || configuration?.remotePort
  if (!host || !port) return ''
  const type = displayValue(resource?.type).toLowerCase()
  const protocol = configuration?.secure && type.includes('mqtt') ? 'mqtts' : type.split(/[_\s]/)[0]
  return `${protocol || 'tcp'}://${host}:${port}`
}

const publicAddress = computed(() => getPublicAddress(props.packageResource))
const optionPublicAddress = (option: LocalResourceOption) => getPublicAddress(option.resource)

const displayValue = (value: any) => value && typeof value === 'object' ? (value.text || value.name || value.value) : value || ''
const resourceTypeName = (resource?: Record<string, any>, fallback?: string) => {
  const type = displayValue(resource?.type || resource?.provider || fallback)
  if (props.resourceType === 'gateway') return props.resourceTypeLabel || type
  return props.resourceType === 'plugin' ? getPluginTypeLabel(type) : type
}
const optionTypeLabel = (_option: LocalResourceOption) => props.resourceType === 'plugin'
  ? $t('plugin.index.293829-2')
  : $t('Product.resourcePackage.001-53')

watch(() => props.modelValue, value => {
  useLocal.value = value?.source === 'LOCAL'
  localId.value = useLocal.value ? value?.id : undefined
}, { immediate: true, deep: true })

/** 选择器值在组件类型中可能是数组或数字，本流程只接受资源 ID 的字符串值。 */
const changeLocal = (value: unknown) => {
  const id = typeof value === 'string' ? value : undefined
  emit('update:modelValue', { source: 'LOCAL', id })
}

/** 配置来源始终二选一；相同 ID 的已有配置优先填入，避免用户再作一次无意义选择。 */
const changeResourceSource = (source: string) => {
  if (source === 'package') {
    emit('update:modelValue', undefined)
    return
  }
  emit('update:modelValue', { source: 'LOCAL', id: matchingLocalOption.value?.value })
}
const resourceSource = computed({
  get: () => useLocal.value ? 'local' : 'package',
  set: changeResourceSource,
})
</script>

<style scoped>
.resource-selection { display: flex; flex-direction: column; border: 1px solid var(--color-jet-border, rgba(0, 0, 0, 0.09)); border-radius: 10px; background: var(--color-jet-fill, #fff); transition: border-color 0.2s, background 0.2s; }
.resource-selection__header { padding: 14px 16px 0; }
.resource-selection__title { display: block; font-weight: 600; }
.resource-selection__summary { display: grid; grid-template-columns: minmax(180px, 0.8fr) minmax(0, 1.2fr); align-items: center; gap: 12px 24px; padding: 12px 16px 16px; }
.resource-selection__identity { display: flex; grid-column: 1; align-items: center; gap: 10px; }
.resource-selection__icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: var(--color-jet-primary-bg, rgba(22, 119, 255, 0.08)); color: var(--jet-theme-primary); font-size: 16px; }
.resource-selection__identity > div { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.resource-selection__identity strong { font-weight: 500; }
.resource-selection__identity span { overflow: hidden; color: var(--color-jet-text-secondary, rgba(0, 0, 0, 0.45)); text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.resource-selection__details { display: contents; }
.resource-selection__detail { display: flex; grid-column: 2; min-width: 0; flex-direction: column; gap: 4px; }
.resource-selection__detail--wide { grid-column: 1 / -1; }
.resource-selection__detail small { color: var(--color-jet-text-secondary, rgba(0, 0, 0, 0.45)); font-size: 12px; }
.resource-selection__detail span { min-height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 20px; }
.resource-selection__source-panel { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; padding: 12px 16px; border-top: 1px solid var(--color-jet-border, rgba(0, 0, 0, 0.09)); }
.resource-selection__conflict { display: inline-flex; flex: 1; align-items: center; gap: 6px; min-width: 260px; color: var(--color-jet-warning, #d48806); font-size: 12px; }
.resource-selection__source-choice { display: flex; align-items: center; gap: 12px; color: var(--color-jet-text-secondary, rgba(0, 0, 0, 0.65)); font-size: 12px; }
.resource-selection__source-choice :deep(.ant-segmented) { padding: 3px; border: 1px solid var(--color-jet-border, rgba(0, 0, 0, 0.09)); border-radius: 6px; background: var(--color-jet-fill, #fff); }
.resource-selection__source-choice :deep(.ant-segmented-item), .resource-selection__source-choice :deep(.ant-segmented-thumb) { border-radius: 4px; }
.resource-selection__source-choice :deep(.ant-segmented-item-label) { min-height: 26px; padding: 2px 10px; line-height: 22px; }
.resource-selection__source-choice :deep(.ant-segmented-item-selected) { color: var(--jet-theme-primary); background: var(--color-jet-primary-bg, rgba(22, 119, 255, 0.08)); box-shadow: 0 1px 3px rgba(29, 33, 41, 0.08); font-weight: 500; }
.resource-selection__local { margin: 0 16px 16px; }
.resource-selection__select { width: min(100%, 420px); }
.resource-selection__option { display: flex; min-width: 300px; flex-direction: column; gap: 4px; padding: 2px 0; }
.resource-selection__option strong { font-weight: 500; }
.resource-selection__option-meta { display: flex; flex-wrap: wrap; gap: 4px 16px; color: var(--color-jet-text-secondary, rgba(0, 0, 0, 0.45)); font-size: 12px; }
@media (max-width: 640px) { .resource-selection__summary { grid-template-columns: 1fr; } .resource-selection__identity, .resource-selection__detail, .resource-selection__detail--wide { grid-column: 1; } }
</style>
