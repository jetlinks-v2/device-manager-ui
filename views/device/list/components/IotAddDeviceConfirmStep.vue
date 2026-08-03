<template>
  <section class="add-device-confirm">
    <div class="add-device-confirm__grid">
      <section class="add-device-confirm__section">
        <h5>{{ $t('IotDeviceList.add.deviceInfo') }}</h5>
        <dl>
          <div>
            <dt>{{ $t('IotDeviceList.table.device') }}</dt>
            <dd>{{ form.name || '-' }}</dd>
          </div>
          <div>
            <dt>
              {{ $t('IotDeviceList.add.productName') }}
              <a-tooltip
                :title="$t('IotDeviceList.add.productAutoCreateTip')"
              >
                <AIcon type="QuestionCircleOutlined" class="add-device-confirm__help" />
              </a-tooltip>
            </dt>
            <dd>{{ confirmProductName }}</dd>
          </div>
          <div>
            <dt>{{ $t('IotDeviceList.table.area') }}</dt>
            <dd>{{ form.area || '-' }}</dd>
          </div>
          <div>
            <dt>{{ $t('IotDeviceList.table.group') }}</dt>
            <dd>{{ groupLabel || '-' }}</dd>
          </div>
          <div>
            <dt>{{ $t('IotDeviceList.add.description') }}</dt>
            <dd>{{ form.description || '-' }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="source" class="add-device-confirm__section">
        <h5>{{ sourceTitle }}</h5>
        <div class="add-device-confirm__template-head">
          <span class="add-device-confirm__icon">
            <AIcon type="AppstoreOutlined" aria-hidden="true" />
          </span>
          <div>
            <strong>{{ source.name }}</strong>
            <small>
              <a-tooltip
                v-for="metric in thingModelMetrics"
                :key="metric.key"
                :title="metric.names.length ? metric.names.join('、') : '--'"
              >
                <span class="add-device-library__thing-model-summary">
                  {{ metric.label }} {{ metric.count }}
                </span>
              </a-tooltip>
              <span>{{ deviceTypeText }}</span>
            </small>
          </div>
        </div>

        <div class="add-device-confirm__template-summary">
          <div v-for="item in summaryItems" :key="item.key">
            <span>{{ item.label }}</span>
            <a-tooltip :title="item.value">
              <strong>{{ item.value }}</strong>
            </a-tooltip>
          </div>
        </div>

        <div v-if="showLibraryProductStatus" class="add-device-confirm__library-status" :class="libraryStatusClass">
          <AIcon :type="libraryStatusIcon" aria-hidden="true" />
          <div>
            <strong>{{ libraryStatusTitle }}</strong>
            <span>{{ libraryStatusDescription }}</span>
          </div>
        </div>
      </section>
    </div>

    <div v-if="source" class="add-device-confirm__summary-layout">
      <section class="add-device-confirm__section">
        <h5>{{ $t('IotDeviceList.add.templateSummary') }}</h5>
        <div class="add-device-confirm__summary-main">
          <div class="add-device-confirm__detail">
            <span>{{ $t('IotDeviceList.add.templateTags') }}</span>
            <div v-if="templateTagGroups.length" class="add-device-confirm__tag-groups">
              <div v-for="group in templateTagGroups" :key="group.key" class="add-device-confirm__tag-group">
                <b>{{ group.label }}</b>
                <div class="add-device-confirm__tags">
                  <span v-for="tag in group.values" :key="`${group.key}-${tag}`">{{ tag }}</span>
                </div>
              </div>
            </div>
            <strong v-else>{{ $t('IotDeviceList.add.noTemplateTags') }}</strong>
          </div>
          <div class="add-device-confirm__detail">
            <span>{{ $t('IotDeviceList.add.templateDescription') }}</span>
            <p>{{ source.summary || $t('IotDeviceList.add.noTemplateDesc') }}</p>
          </div>
        </div>
      </section>
      <div class="add-device-confirm__install-progress-wrap">
        <IotAddDeviceInstallProgress :state="installProgress" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeDeviceTypeValue, type IotDeviceProductTemplate } from '@device-manager-ui/api/device'
import IotAddDeviceInstallProgress from './IotAddDeviceInstallProgress.vue'

type AddDeviceForm = {
  name: string
  area: string
  groupId: string
  description: string
}

type ProductSyncState = {
  checking: boolean
  installed: boolean
  productId: string
  productName: string
  deviceCount: number
  restrictedFields: string[]
  updateDisabled: boolean
}

type InstallProgressState = {
  logs: Array<{
    id: string
    type: string
    message: string
  }>
  running: boolean
  hasError: boolean
}

const props = defineProps({
  form: { type: Object as PropType<AddDeviceForm>, required: true },
  selectedProduct: { type: Object as PropType<IotDeviceProductTemplate | null>, default: null },
  selectedTemplate: { type: Object as PropType<IotDeviceProductTemplate | null>, default: null },
  groupLabel: { type: String, default: '' },
  mode: { type: String as PropType<'library' | 'custom'>, required: true },
  productSyncState: {
    type: Object as PropType<ProductSyncState>,
    default: () => ({
      checking: false,
      installed: false,
      productId: '',
      productName: '',
      deviceCount: 0,
      restrictedFields: [],
      updateDisabled: false,
    }),
  },
  installProgress: {
    type: Object as PropType<InstallProgressState>,
    default: () => ({
      logs: [],
      running: false,
      hasError: false,
    }),
  },
})

const { t: $t } = useI18n()
const source = computed(() =>
  props.mode === 'library'
    ? props.selectedTemplate ?? props.selectedProduct
    : props.selectedProduct ?? props.selectedTemplate,
)
const sourceTitle = computed(() =>
  props.mode === 'library'
    ? $t('IotDeviceList.add.librarySource')
    : $t('IotDeviceList.add.customSource'),
)
const accessMethodText = computed(() => source.value?.accessName || source.value?.accessProvider || '--')
const manufacturerText = computed(() => source.value?.manufacturer || '--')
const modelText = computed(() => source.value?.model || source.value?.supportedModels?.flatMap((item) => item.models ?? []).find(Boolean) || '--')
const deviceTypeText = computed(() => {
  const value = normalizeDeviceTypeValue(source.value?.deviceType)
  return $t(`IotDeviceList.deviceType.${value}`)
})
const summaryItems = computed(() => [
  { key: 'access', label: $t('IotDeviceList.add.accessMode'), value: accessMethodText.value },
  { key: 'manufacturer', label: $t('IotDeviceList.add.manufacturer'), value: manufacturerText.value },
  { key: 'model', label: $t('IotDeviceList.add.libraryModel'), value: modelText.value },
])
const confirmProductName = computed(() =>
  props.productSyncState.productName || source.value?.name || props.selectedProduct?.name || '--',
)
const thingModelMetrics = computed(() => {
  const points = source.value?.dataPoints ?? []
  const groups = {
    properties: points.filter((point) => !isEventPoint(point.kind) && !isFunctionPoint(point.kind)),
    events: points.filter((point) => isEventPoint(point.kind)),
    functions: points.filter((point) => isFunctionPoint(point.kind)),
  }

  return [
    {
      key: 'properties',
      label: $t('IotDeviceList.add.thingModelProperties'),
      names: pointNames(groups.properties),
      count: groups.properties.length,
    },
    {
      key: 'events',
      label: $t('IotDeviceList.add.thingModelEvents'),
      names: pointNames(groups.events),
      count: groups.events.length,
    },
    {
      key: 'functions',
      label: $t('IotDeviceList.add.thingModelFunctions'),
      names: pointNames(groups.functions),
      count: groups.functions.length,
    },
  ]
})
const showLibraryProductStatus = computed(() => props.mode === 'library' && Boolean(props.selectedTemplate))
const libraryStatusClass = computed(() => ({
  'is-installed': props.productSyncState.installed,
}))
const libraryStatusIcon = computed(() => {
  if (props.productSyncState.checking) return 'LoadingOutlined'
  if (props.productSyncState.installed) return 'CheckCircleOutlined'
  return 'CloudDownloadOutlined'
})
const libraryStatusTitle = computed(() => {
  if (props.productSyncState.checking) return $t('IotDeviceList.add.libraryProductChecking')
  if (props.productSyncState.installed) return $t('IotDeviceList.add.libraryProductInstalled')
  return $t('IotDeviceList.add.libraryProductNotInstalled')
})
const libraryStatusDescription = computed(() => {
  if (props.productSyncState.installed) {
    return $t('IotDeviceList.add.libraryProductInstalledDesc', {
      product: props.productSyncState.productName || props.productSyncState.productId || '-',
      count: props.productSyncState.deviceCount,
    })
  }
  return $t('IotDeviceList.add.libraryProductNotInstalledDesc')
})
const templateTagGroups = computed(() => {
  const groups = source.value?.tagGroups
    ?.map((group) => ({
      key: group.key,
      label: group.label,
      values: Array.from(new Set(group.values?.filter(Boolean) ?? [])),
    }))
    .filter((group) => group.values.length) ?? []
  if (groups.length) return groups
  const tags = Array.from(new Set(source.value?.tags?.filter(Boolean) ?? []))
  return tags.length
    ? [{ key: 'default-tags', label: $t('IotDeviceList.add.templateTags'), values: tags }]
    : []
})

function pointNames(points: NonNullable<IotDeviceProductTemplate['dataPoints']>) {
  return points
    .map((point) => String(point.name || point.key || '').trim())
    .filter(Boolean)
}

function isEventPoint(kind?: string) {
  const value = String(kind || '').toLowerCase()
  return value.includes('event') || value.includes('alarm')
}

function isFunctionPoint(kind?: string) {
  const value = String(kind || '').toLowerCase()
  return value.includes('function') || value.includes('service') || value.includes('command')
}
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
