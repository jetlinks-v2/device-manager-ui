<template>
  <PhotoSave
    v-if="photoPanelVisible"
    :data="instanceStore.current"
    :imageSrc="photoTempSrc"
    @close="photoPanelVisible = false"
    @save="handlePhotoPanelSaved"
  />
  <input
    ref="photoFileInputRef"
    class="device-photo-file-input"
    type="file"
    accept="image/jpeg,image/png"
    @change="handlePhotoFileSelected"
  />
  <TagsSave
    v-if="tagsPanelVisible"
    @close="tagsPanelVisible = false"
    @save="handleTagsPanelSave"
  />
</template>

<script setup lang="ts">
import { toRefs, type PropType } from 'vue'
import TagsSave from './Info/components/Tags/Save.vue'
import PhotoSave from './PhotoSave.vue'

import type { DeviceInstanceDetailState } from './useDeviceInstanceDetail'

/** 名称外的照片与标签编辑弹层。 */
type ViewState = Pick<DeviceInstanceDetailState,
  'instanceStore' | 'photoPanelVisible' | 'photoTempSrc' | 'photoFileInputRef' | 'tagsPanelVisible' | 'handlePhotoPanelSaved' | 'handlePhotoFileSelected' | 'handleTagsPanelSave'
>
const props = defineProps({ state: { type: Object as PropType<ViewState>, required: true } })
const {
  instanceStore,
  photoPanelVisible,
  photoTempSrc,
  photoFileInputRef,
  tagsPanelVisible,
  handlePhotoPanelSaved,
  handlePhotoFileSelected,
  handleTagsPanelSave,
} = toRefs(props.state)
</script>

<style scoped src="./DeviceInstanceDetailOverlays.css"></style>
