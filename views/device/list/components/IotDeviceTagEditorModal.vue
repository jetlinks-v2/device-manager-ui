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
          <MetadataValueItem
            v-if="['object', 'array'].includes(getTagType(record))"
            v-model="record.value"
            :item="record"
          />
          <SelectAMap
            v-else-if="getTagType(record) === 'geoPoint'"
            v-model:point="record.value"
          />
          <j-value-item
            v-else
            v-model:modelValue="record.value"
            :item-type="getEditorType(record)"
            :action="FileStaticPath()"
            :headers="getUploadHeaders()"
            :options="getTagOptions(record)"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </template>
      </template>
    </a-table>
  </a-modal>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileStaticPath } from '@jetlinks-web-core/api/comm'
import { getUploadHeaders } from '@jetlinks-web-core/utils'

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

function getEditorType(tag: TagRecord) {
  const type = getTagType(tag)
  return type === 'array' ? 'object' : type === 'file' ? 'string' : type
}

function getTagOptions(tag: TagRecord) {
  const type = getTagType(tag)
  if (type === 'enum') {
    return (tag.dataType?.elements || []).map((item: TagRecord) => ({
      label: item.text,
      value: item.value,
    }))
  }
  if (type === 'boolean') {
    return [
      { label: tag.dataType?.trueText, value: tag.dataType?.trueValue },
      { label: tag.dataType?.falseText, value: tag.dataType?.falseValue },
    ]
  }
  return undefined
}

function normalizeTagValue(type: string, value: unknown) {
  // 标签接口的 value 是字符串；object/array 需要提交 JSON 文本而不是解析后的对象。
  if (['object', 'array'].includes(type) && value !== undefined && value !== null && typeof value !== 'string') {
    return JSON.stringify(value)
  }
  return value
}

function parseJsonEditorValue(value: unknown) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function resetRows() {
  rows.value = props.tags.map((tag) => {
    const type = getTagType(tag)
    const value = tag.value ?? tag.formatValue ?? undefined
    return {
      ...tag,
      value: ['object', 'array'].includes(type) ? parseJsonEditorValue(value) : value,
      valueType: {
        ...(tag.dataType || {}),
        type,
      },
    }
  })
}

function close() {
  if (!props.saving) emit('update:open', false)
}

function submit() {
  // 与旧版接口保持一致：日期标签保存为后端可读的完整时间字符串。
  emit('save', rows.value.map((row) => {
    const type = getTagType(row)
    const { dataType, valueType, ...tag } = row
    return {
      ...tag,
      value: type === 'date' && row.value
        ? dayjs(row.value).format('YYYY-MM-DD HH:mm:ss')
        : normalizeTagValue(type, row.value),
    }
  }))
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
