<template>
  <a-modal
    :open="open"
    :title="$t('IotDeviceDetail.tagEditor.title')"
    :width="960"
    :confirm-loading="saving"
    :mask-closable="!saving"
    destroy-on-close
    @cancel="close"
    @ok="submit"
  >
    <a-table
      class="device-tag-editor"
      :columns="columns"
      :data-source="rows"
      :pagination="false"
      :row-key="getTagKey"
      :scroll="{ y: 448 }"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <j-ellipsis v-if="column.dataIndex === 'key'" class="device-tag-editor__key">
          {{ getTagKey(record) }}
        </j-ellipsis>
        <div v-else-if="column.dataIndex === 'name'" class="device-tag-editor__name">
          <j-ellipsis>{{ getTagLabel(record) }}</j-ellipsis>
        </div>
        <template v-else>
          <TagValueInput v-model="record.value" :tag="record" />
        </template>
      </template>
    </a-table>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import TagValueInput from './device-detail/tags/TagValueInput.vue'
import { createTagDraft, serializeTagDraft, getTagKey, getTagLabel, type DeviceTag } from './device-detail/tags/tagEditor'

const props = defineProps<{
  open: boolean
  saving: boolean
  tags: DeviceTag[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [tags: DeviceTag[]]
}>()

const { t } = useI18n()
const rows = ref<DeviceTag[]>([])

const columns = computed(() => [
  {
    title: t('IotDeviceDetail.tagEditor.identifier'),
    dataIndex: 'key',
    width: '24%',
  },
  {
    title: t('IotDeviceDetail.tagEditor.name'),
    dataIndex: 'name',
    width: '34%',
  },
  {
    title: t('IotDeviceDetail.tagEditor.value'),
    dataIndex: 'value',
    width: '42%',
  },
])

function resetRows() {
  rows.value = props.tags.map(createTagDraft)
}

function close() {
  if (!props.saving) emit('update:open', false)
}

function submit() {
  emit('save', rows.value.map(serializeTagDraft))
}

watch(
  () => props.open,
  (open) => {
    if (open) resetRows()
  },
)
</script>

<style scoped>
.device-tag-editor :deep(.ant-table-cell) {
  vertical-align: middle;
}

.device-tag-editor__key {
  color: var(--jet-theme-text-secondary);
}

.device-tag-editor__name {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.device-tag-editor :deep(.ant-table-cell:last-child) {
  min-width: 18rem;
}
</style>
