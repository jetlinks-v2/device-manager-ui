<template>
  <div class="add-device__fields" :class="{ 'add-device__fields--stacked': props.stackFields }">
    <section v-if="props.showIcon" class="add-device__identity add-device__field--full">
      <a-form-item name="imageUrl">
        <pro-upload v-model="props.form.imageUrl" />
      </a-form-item>
      <a-form-item
        v-if="props.showName !== false"
        :label="$t('IotDeviceList.basicFields.label.name')"
        name="name"
      >
        <a-input v-model:value="props.form.name" :placeholder="$t('IotDeviceList.basicFields.placeholder.name')" />
      </a-form-item>
    </section>

    <a-form-item
      v-else-if="props.showName !== false"
      class="add-device__field add-device__field--full"
      :label="$t('IotDeviceList.basicFields.label.name')"
      name="name"
    >
      <a-input v-model:value="props.form.name" :placeholder="$t('IotDeviceList.basicFields.placeholder.name')" />
    </a-form-item>

    <a-form-item v-if="props.showArea !== false" class="add-device__field" :label="$t('IotDeviceList.basicFields.label.area')" name="areaId">
      <a-tree-select
        v-model:value="props.form.areaId"
        :tree-data="props.areaTreeData"
        :placeholder="$t('IotDeviceList.basicFields.placeholder.area')"
        allow-clear
        show-search
        tree-default-expand-all
        tree-node-filter-prop="title"
        :dropdown-style="{ maxHeight: '320px', overflow: 'auto' }"
        @change="props.onAreaChange"
      />
    </a-form-item>

    <a-form-item v-if="props.showGroup !== false" class="add-device__field" :label="$t('IotDeviceList.basicFields.label.group')" name="groupId">
      <a-tree-select
        v-model:value="props.form.groupId"
        :tree-data="props.groupTreeData"
        :placeholder="$t('IotDeviceList.basicFields.placeholder.group')"
        allow-clear
        show-search
        tree-default-expand-all
        tree-node-filter-prop="title"
        :multiple="props.groupMultiple"
        :max-tag-count="props.groupMultiple ? 'responsive' : undefined"
        :dropdown-style="{ maxHeight: '320px', overflow: 'auto' }"
      />
    </a-form-item>

    <a-form-item v-if="props.showDescription !== false" class="add-device__field add-device__field--full" :label="$t('IotDeviceList.basicFields.label.description')" name="description">
      <a-textarea v-model:value="props.form.description" :placeholder="$t('IotDeviceList.basicFields.placeholder.description')" :rows="3" />
    </a-form-item>
  </div>
</template>

<script setup lang="ts">
import type { AreaTreeNode } from '../hooks/iotAreaTreeOptions'

type DeviceBasicForm = {
  name: string
  areaId: string
  area: string
  groupId: string | string[]
  description: string
  imageUrl: string
}

const props = withDefaults(defineProps<{
  form: DeviceBasicForm
  areaTreeData: AreaTreeNode[]
  groupTreeData: Array<{ title: string; value: string; key: string; children?: unknown[] }>
  groupMultiple?: boolean
  showIcon?: boolean
  showName?: boolean
  showArea?: boolean
  stackFields?: boolean
  showGroup?: boolean
  showDescription?: boolean
  onAreaChange: () => void
}>(), {
  groupMultiple: false,
  showIcon: false,
  showName: true,
  showArea: true,
  stackFields: false,
  showGroup: true,
  showDescription: true,
})
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
