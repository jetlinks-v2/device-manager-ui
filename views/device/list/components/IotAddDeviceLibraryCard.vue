<template>
  <article
    class="add-device-library__card"
    :class="{ 'is-selected': selected, 'is-disabled': disabled }"
    :aria-disabled="disabled"
    @click="handleSelect"
  >
    <header class="add-device-library__card-head">
      <span class="add-device-library__icon">
        <img
          v-if="visibleTemplateImageUrl"
          :src="visibleTemplateImageUrl"
          :alt="$t('IotDeviceList.iconAlt', { name: template.name })"
          loading="lazy"
          @error="markImageFailed(visibleTemplateImageUrl)"
        >
        <AIcon v-else :type="categoryIcon" aria-hidden="true" />
      </span>
      <div class="add-device-library__card-title">
        <a-tooltip :title="template.name">
          <strong>{{ template.name }}</strong>
        </a-tooltip>
        <small>
          <a-tooltip
            v-for="metric in thingModelMetrics"
            :key="metric.key"
            :title="metric.names.length ? metric.names.join($t('IotDeviceList.presentation.separator')) : '--'"
          >
            <span class="add-device-library__thing-model-summary">
              {{ metric.label }} {{ metric.count }}
            </span>
          </a-tooltip>
          <span class="add-device-library__device-type">{{ deviceTypeText }}</span>
        </small>
      </div>
      <a-tag v-if="selected" color="processing">
        {{ $t('IotDeviceList.add.selected') }}
      </a-tag>
      <a-tag v-else-if="disabled">
        {{ $t('IotDeviceList.add.unselectableTemplate') }}
      </a-tag>
    </header>

    <div v-if="allTemplateTags.length" class="add-device-library__template-tags">
      <a-tooltip v-for="tag in visibleTemplateTags" :key="tag" :title="tag">
        <a-tag>{{ tag }}</a-tag>
      </a-tooltip>
      <a-tooltip v-if="hiddenTemplateTagCount > 0" :title="templateTagTooltip">
        <a-tag>+{{ hiddenTemplateTagCount }}</a-tag>
      </a-tooltip>
    </div>

    <a-tooltip :title="summaryText">
      <p class="add-device-library__summary">
        {{ summaryText }}
      </p>
    </a-tooltip>

    <dl class="add-device-library__facts">
      <div>
        <dt>{{ $t('IotDeviceList.add.accessMode') }}</dt>
        <a-tooltip :title="template.accessName || '--'">
          <dd>{{ template.accessName || '--' }}</dd>
        </a-tooltip>
      </div>
      <div>
        <dt>{{ $t('IotDeviceList.add.manufacturer') }}</dt>
        <a-tooltip :title="manufacturerLabel">
          <dd>{{ manufacturerLabel }}</dd>
        </a-tooltip>
      </div>
      <div>
        <dt>{{ $t('IotDeviceList.add.libraryModel') }}</dt>
        <a-tooltip :title="modelLabel">
          <dd>{{ modelLabel }}</dd>
        </a-tooltip>
      </div>
    </dl>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeDeviceTypeValue, type IotDeviceProductTemplate } from '@device-manager-ui/api/device'

const props = defineProps({
  template: { type: Object as PropType<IotDeviceProductTemplate>, required: true },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'select', templateId: string): void
}>()

const { t: $t } = useI18n()

const categoryIconMap: Record<string, string> = {
  video: 'VideoCameraOutlined',
  meter: 'DashboardOutlined',
  sensor: 'AppstoreOutlined',
  industrial: 'ClusterOutlined',
  integration: 'ApiOutlined',
}

const categoryIcon = computed(() => categoryIconMap[props.template.category] || categoryIconMap.integration)
const failedImageUrl = ref('')
const templateImageUrl = computed(() => String(props.template.photoUrl || '').trim())
const visibleTemplateImageUrl = computed(() =>
  templateImageUrl.value && failedImageUrl.value !== templateImageUrl.value
    ? templateImageUrl.value
    : '',
)
const allTemplateTags = computed(() => {
  const groupedTags = props.template.tagGroups
    ?.flatMap((group) => group.values ?? []) ?? []
  const tags = props.template.tags?.length ? props.template.tags : groupedTags

  return [...new Set(tags.map((item) => String(item || '').trim()).filter(Boolean))]
})
const visibleTemplateTags = computed(() => allTemplateTags.value.slice(0, 3))
const hiddenTemplateTagCount = computed(() => Math.max(allTemplateTags.value.length - visibleTemplateTags.value.length, 0))
const templateTagTooltip = computed(() => allTemplateTags.value.join('、'))
const summaryText = computed(() => props.template.summary || $t('IotDeviceList.add.noTemplateDesc'))
const thingModelMetrics = computed(() => {
  const points = props.template.dataPoints ?? []
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
const deviceTypeText = computed(() => {
  const value = normalizeDeviceTypeValue(props.template.deviceType)
  return $t(`IotDeviceList.deviceType.${value}`)
})
const manufacturerLabel = computed(() => props.template.manufacturer || '--')
const modelLabel = computed(() => props.template.model || '--')

function handleSelect() {
  if (props.disabled) return
  emit('select', props.template.id)
}

function markImageFailed(url: string) {
  failedImageUrl.value = url
}

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
