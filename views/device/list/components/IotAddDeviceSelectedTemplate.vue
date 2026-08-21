<template>
  <section v-if="template" class="add-device-selected-template">
    <span class="add-device-selected-template__visual">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="$t('IotDeviceList.iconAlt', { name: template.name })"
        @error="imageFailed = true"
      >
      <AIcon v-else :type="categoryIcon" aria-hidden="true" />
    </span>
    <div class="add-device-selected-template__body">
      <strong>{{ template.name }}</strong>
      <span>{{ templateMeta }}</span>
    </div>
    <a-button size="small" @click="$emit('change')">
      <template #icon>
        <AIcon type="SwapOutlined" aria-hidden="true" />
      </template>
      {{ $t('IotDeviceList.add.changeDevice') }}
    </a-button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IotDeviceProductTemplate } from '@device-manager-ui/api/device'

const props = defineProps({
  template: { type: Object as PropType<IotDeviceProductTemplate | null>, default: null },
})

defineEmits<{
  (event: 'change'): void
}>()

const { t: $t } = useI18n()
const imageFailed = ref(false)
const imageUrl = computed(() => imageFailed.value ? '' : String(props.template?.photoUrl || '').trim())
const categoryIcon = computed(() => ({
  video: 'VideoCameraOutlined',
  meter: 'DashboardOutlined',
  sensor: 'AppstoreOutlined',
  industrial: 'ClusterOutlined',
}[props.template?.category || ''] || 'ApiOutlined'))
const templateMeta = computed(() => [
  props.template?.manufacturer,
  props.template?.model,
].filter(Boolean).join(' · ') || $t('IotDeviceList.add.librarySource'))
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
