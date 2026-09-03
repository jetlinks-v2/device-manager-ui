<template>
  <div class="add-device__fields" :class="{ 'add-device__fields--stacked': stackFields }">
    <a-form-item
      class="add-device__field add-device__field--full"
      :label="$t('IotDeviceList.basicFields.label.name')"
      name="name"
    >
      <a-input v-model:value="form.name" :placeholder="$t('IotDeviceList.basicFields.placeholder.name')" />
    </a-form-item>

    <a-form-item
      v-if="showIcon"
      class="add-device__field add-device__field--full"
      :label="$t('IotDeviceList.basicFields.label.icon')"
      name="imageUrl"
    >
      <a-tabs v-model:active-key="iconMode" class="add-device__icon-tabs" size="small">
        <a-tab-pane key="preset" :tab="$t('IotDeviceList.basicFields.presetIcon')">
          <div class="add-device__icon-grid">
            <button
              v-for="icon in presetIcons"
              :key="icon"
              type="button"
              class="add-device__icon-option"
              :class="{ 'is-selected': form.imageUrl === `font:${icon}` }"
              :aria-label="icon"
              @click="onSelectPresetIcon(icon)"
            >
              <AIcon :type="icon" aria-hidden="true" />
            </button>
          </div>
        </a-tab-pane>
        <a-tab-pane key="image" :tab="$t('IotDeviceList.basicFields.uploadIcon')">
          <a-upload accept="image/*" :before-upload="handleImageBeforeUpload" :show-upload-list="false">
            <button type="button" class="add-device__icon-upload">
              <span class="add-device__icon-preview" :class="{ 'is-empty': !displayImageUrl }">
                <img v-if="displayImageUrl" :src="displayImageUrl" :alt="$t('IotDeviceList.basicFields.iconPreview')" @error="onImageError">
                <AIcon v-else type="PlusOutlined" aria-hidden="true" />
              </span>
              <span class="add-device__icon-copy">
                <strong>{{ displayImageUrl ? imageFileName : $t('IotDeviceList.basicFields.uploadIcon') }}</strong>
                <small>{{ displayImageUrl ? $t('IotDeviceList.basicFields.iconSelected') : $t('IotDeviceList.basicFields.iconHint') }}</small>
              </span>
            </button>
          </a-upload>
        </a-tab-pane>
      </a-tabs>
    </a-form-item>

    <a-form-item class="add-device__field" :label="$t('IotDeviceList.basicFields.label.area')" name="areaId">
      <a-tree-select
        v-model:value="form.areaId"
        :tree-data="areaTreeData"
        :placeholder="$t('IotDeviceList.basicFields.placeholder.area')"
        allow-clear
        show-search
        tree-default-expand-all
        tree-node-filter-prop="title"
        :dropdown-style="{ maxHeight: '320px', overflow: 'auto' }"
        @change="onAreaChange"
      />
    </a-form-item>

    <a-form-item class="add-device__field" :label="$t('IotDeviceList.basicFields.label.group')" name="groupId">
      <a-tree-select
        v-model:value="form.groupId"
        :tree-data="groupTreeData"
        :placeholder="$t('IotDeviceList.basicFields.placeholder.group')"
        allow-clear
        show-search
        tree-default-expand-all
        tree-node-filter-prop="title"
        :multiple="groupMultiple"
        :max-tag-count="groupMultiple ? 'responsive' : undefined"
        :dropdown-style="{ maxHeight: '320px', overflow: 'auto' }"
      />
    </a-form-item>

    <a-form-item class="add-device__field add-device__field--full" :label="$t('IotDeviceList.basicFields.label.description')" name="description">
      <a-textarea v-model:value="form.description" :placeholder="$t('IotDeviceList.basicFields.placeholder.description')" :rows="3" />
    </a-form-item>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MARKETPLACE_FONT_ICON_TYPES, parseIconValue } from '@jetlinks-web-core/components/IconValue'
import type { AreaTreeNode } from '../hooks/iotAreaTreeOptions'

type DeviceBasicForm = {
  name: string
  areaId: string
  area: string
  groupId: string | string[]
  description: string
  imageUrl: string
}

const props = defineProps<{
  form: DeviceBasicForm
  imagePreviewUrl: string
  imageFileName: string
  areaTreeData: AreaTreeNode[]
  groupTreeData: Array<{ title: string; value: string; key: string; children?: unknown[] }>
  groupMultiple?: boolean
  showIcon?: boolean
  stackFields?: boolean
  onAreaChange: () => void
  handleImageBeforeUpload: (file: File) => boolean
  onSelectPresetIcon: (icon: string) => void
}>()

const imageLoadFailed = ref(false)
const displayImageUrl = computed(() => imageLoadFailed.value ? '' : props.imagePreviewUrl)
const iconMode = ref<'preset' | 'image'>('image')
const presetIcons = MARKETPLACE_FONT_ICON_TYPES.slice(0, 24)

function onImageError() {
  imageLoadFailed.value = true
}

watch(
  () => props.form.imageUrl,
  () => {
    imageLoadFailed.value = false
    iconMode.value = parseIconValue(props.form.imageUrl).kind === 'font' ? 'preset' : 'image'
  },
  { immediate: true },
)
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
