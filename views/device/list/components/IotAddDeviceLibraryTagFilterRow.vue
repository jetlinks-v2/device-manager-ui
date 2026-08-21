<template>
  <div class="add-device-library__tag-row">
    <a-tooltip :title="groupLabel">
      <span class="add-device-library__tag-row-label">{{ groupLabel }}</span>
    </a-tooltip>
    <div ref="optionsRef" class="add-device-library__tag-options" :class="{ 'is-expanded': expanded }">
      <button
        v-for="option in group.tags"
        :key="option.id"
        type="button"
        class="add-device-library__tag-option"
        :class="{ 'is-active': activeTagIds.includes(option.id) }"
        @click="$emit('toggle-tag', option.id)"
      >
        {{ option.name }}
      </button>
    </div>
    <a-button
      v-if="hasOverflow"
      class="add-device-library__tag-row-toggle"
      type="link"
      size="small"
      @click="toggleExpanded"
    >
      {{ expanded ? $t('IotDeviceList.add.libraryTagCollapse') : $t('IotDeviceList.add.libraryTagExpand') }}
      <AIcon :type="expanded ? 'UpOutlined' : 'DownOutlined'" />
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IotDeviceLibraryTagGroup } from '@device-manager-ui/api/device'

const props = defineProps({
  group: { type: Object as PropType<IotDeviceLibraryTagGroup>, required: true },
  activeTagIds: { type: Array as PropType<string[]>, default: () => [] },
})

defineEmits<{
  (e: 'toggle-tag', tagId: string): void
}>()

const { t: $t } = useI18n()
const optionsRef = ref<HTMLElement>()
const expanded = ref(false)
const hasOverflow = ref(false)
let resizeObserver: ResizeObserver | undefined

const groupLabel = computed(() => $t('IotDeviceList.add.libraryTagGroupCount', {
  name: props.group.name,
  count: props.group.tags.length,
}))

function measureOverflow() {
  const element = optionsRef.value
  if (!element || expanded.value) return
  hasOverflow.value = element.scrollHeight > element.clientHeight + 1
}

function toggleExpanded() {
  expanded.value = !expanded.value
  if (!expanded.value) void nextTick(measureOverflow)
}

function scheduleMeasure() {
  // 标签宽度会随弹窗尺寸变化，使用真实溢出高度决定是否显示展开操作。
  void nextTick(measureOverflow)
}

onMounted(() => {
  scheduleMeasure()
  if (typeof ResizeObserver === 'undefined' || !optionsRef.value) return
  resizeObserver = new ResizeObserver(scheduleMeasure)
  resizeObserver.observe(optionsRef.value)
})

onBeforeUnmount(() => resizeObserver?.disconnect())

watch(() => props.group.tags, () => {
  expanded.value = false
  scheduleMeasure()
}, { deep: true })
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
