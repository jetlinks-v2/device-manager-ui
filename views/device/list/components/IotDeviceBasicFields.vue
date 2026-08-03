<template>
  <div class="add-device__fields">
    <a-form-item
      class="add-device__field add-device__field--full"
      :label="$t('IotDeviceList.basicFields.label.name')"
      name="name"
    >
      <a-input v-model:value="form.name" :placeholder="$t('IotDeviceList.basicFields.placeholder.name')" />
    </a-form-item>

    <a-form-item
      class="add-device__field add-device__field--full"
      :label="$t('IotDeviceList.basicFields.label.icon')"
      name="imageUrl"
    >
      <a-upload
        accept="image/*"
        :before-upload="handleImageBeforeUpload"
        :show-upload-list="false"
      >
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
      <a-select
        v-model:value="form.groupId"
        :mode="groupMultiple ? 'multiple' : undefined"
        :options="groupSelectOptions"
        :placeholder="$t('IotDeviceList.basicFields.placeholder.group')"
        allow-clear
        :max-tag-count="groupMultiple ? 'responsive' : undefined"
      />
    </a-form-item>

    <a-form-item class="add-device__field add-device__field--full" :label="$t('IotDeviceList.basicFields.label.description')" name="description">
      <a-textarea v-model:value="form.description" :placeholder="$t('IotDeviceList.basicFields.placeholder.description')" :rows="3" />
    </a-form-item>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  groupSelectOptions: Array<{ label: string; value: string }>
  groupMultiple?: boolean
  onAreaChange: () => void
  handleImageBeforeUpload: (file: File) => boolean
}>()

const imageLoadFailed = ref(false)
const displayImageUrl = computed(() => imageLoadFailed.value ? '' : props.imagePreviewUrl)

function onImageError() {
  imageLoadFailed.value = true
}

watch(
  () => props.imagePreviewUrl,
  () => {
    imageLoadFailed.value = false
  },
)
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
