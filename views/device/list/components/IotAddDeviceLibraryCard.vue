<template>
  <article
    class="add-device-library__card"
    :class="{ 'is-selected': selected, 'is-disabled': disabled }"
    :aria-disabled="disabled"
    @click="handleSelect"
  >
    <div class="add-device-library__card-visual">
      <img
        v-if="visibleTemplateImageUrl"
        :src="visibleTemplateImageUrl"
        :alt="$t('IotDeviceList.iconAlt', { name: template.name })"
        loading="lazy"
        @error="markImageFailed(visibleTemplateImageUrl)"
      >
      <span v-else class="add-device-library__icon">
        <AIcon :type="categoryIcon" aria-hidden="true" />
      </span>
      <span class="add-device-library__card-category">{{ deviceTypeText }}</span>
    </div>

    <div class="add-device-library__card-content">
      <header class="add-device-library__card-head">
        <div class="add-device-library__card-title">
          <a-tooltip :title="template.name">
            <strong>{{ template.name }}</strong>
          </a-tooltip>
        </div>
        <a-tag v-if="selected" color="processing">
          {{ $t('IotDeviceList.add.selected') }}
        </a-tag>
        <a-tag v-else-if="disabled">
          {{ $t('IotDeviceList.add.unselectableTemplate') }}
        </a-tag>
      </header>

      <a-tooltip :title="summaryText">
        <p class="add-device-library__summary">
          {{ summaryText }}
        </p>
      </a-tooltip>

      <div v-if="allTemplateTags.length" class="add-device-library__template-tags">
        <a-tooltip v-for="tag in visibleTemplateTags" :key="tag" :title="tag">
          <a-tag>{{ tag }}</a-tag>
        </a-tooltip>
        <a-tooltip v-if="hiddenTemplateTagCount > 0" :title="templateTagTooltip">
          <a-tag>+{{ hiddenTemplateTagCount }}</a-tag>
        </a-tooltip>
      </div>
    </div>
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
const deviceTypeText = computed(() => {
  const value = normalizeDeviceTypeValue(props.template.deviceType)
  return $t(`IotDeviceList.deviceType.${value}`)
})
function handleSelect() {
  if (props.disabled) return
  emit('select', props.template.id)
}

function markImageFailed(url: string) {
  failedImageUrl.value = url
}

</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
