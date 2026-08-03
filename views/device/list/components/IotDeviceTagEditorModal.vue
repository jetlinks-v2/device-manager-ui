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
        <MetadataValueItem
          v-else
          v-model="record.value"
          :item="record"
        />
      </template>
    </a-table>
  </a-modal>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

type TagRecord = Record<string, any>

type TagEditorRow = TagRecord & {
  valueType: TagRecord
}

const props = defineProps<{
  open: boolean
  saving: boolean
  tags: TagRecord[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [tags: TagRecord[]]
}>()

const { t } = useI18n()
const rows = ref<TagEditorRow[]>([])

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

function getTagKey(tag: TagRecord) {
  return String(tag.key || tag.id || tag.name || '')
}

function getTagLabel(tag: TagRecord) {
  return String(tag.name || tag.key || tag.id || '')
}

function getTagType(tag: TagRecord) {
  return String(tag.dataType?.type || tag.type || 'string')
}

function resetRows() {
  rows.value = props.tags.map((tag) => ({
    ...tag,
    value: tag.value ?? tag.formatValue ?? undefined,
    valueType: {
      ...(tag.dataType || {}),
      type: getTagType(tag),
    },
  }))
}

function close() {
  if (!props.saving) emit('update:open', false)
}

function submit() {
  // 与旧版接口保持一致：日期标签保存为后端可读的完整时间字符串。
  emit('save', rows.value.map(({ valueType, ...tag }) => ({
    ...tag,
    value: getTagType(tag) === 'date' && tag.value ? dayjs(tag.value).format('YYYY-MM-DD HH:mm:ss') : tag.value,
  })))
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
