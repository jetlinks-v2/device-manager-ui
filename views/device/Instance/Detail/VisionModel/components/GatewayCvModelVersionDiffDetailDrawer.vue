<template>
  <a-drawer
    :open="open"
    :width="760"
    destroy-on-close
    placement="right"
    @close="$emit('close')"
    @update:open="handleOpenChange"
  >
    <template #title>
      <div class="cv-version-diff-detail__title">
        <strong>{{ $t('GatewayCvModelVersionDrawer.detailTitle') }}</strong>
        <small>{{ versionText }}</small>
      </div>
    </template>

    <section class="cv-version-diff-detail">
      <a-tabs v-model:activeKey="activeKey" size="small">
        <a-tab-pane
          v-for="tab in tabs"
          :key="tab.key"
          :tab="tab.label"
        />
      </a-tabs>

      <a-table
        :columns="columns"
        :data-source="rows"
        :pagination="{ pageSize: 20, size: 'small', showSizeChanger: false }"
        :row-key="row => row.rowId"
        size="small"
      >
        <template #emptyText>
          <CloudEmpty :description="$t('GatewayCvModelVersionDrawer.detailEmpty')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'">
            <a-tag :color="actionColor(record.action)">
              {{ actionText(record.action) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'path'">
            <div class="cv-version-diff-detail__file">
              <a-tooltip :title="record.filePath">
                <strong>{{ record.filePath }}</strong>
              </a-tooltip>
              <a-tooltip :title="record.fileKey || '--'">
                <small>{{ record.fileKey || '--' }}</small>
              </a-tooltip>
            </div>
          </template>
          <template v-else-if="column.key === 'format'">
            {{ record.formatText }}
          </template>
          <template v-else-if="column.key === 'currentMd5'">
            {{ shortMd5(record.currentMd5) }}
          </template>
          <template v-else-if="column.key === 'historyMd5'">
            {{ shortMd5(record.historyMd5) }}
          </template>
        </template>
      </a-table>
    </section>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TableColumnsType } from 'ant-design-vue'
import type { ModelVersionRecord } from '../gatewayCvModel.types'
import {
  buildModelVersionDiffRows,
  formatVersion,
  type ModelVersionDiffAction,
  type ModelVersionDiffRow,
} from '../utils/gatewayCvModelFormat'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  version: {
    type: Object as PropType<ModelVersionRecord | undefined>,
    default: undefined,
  },
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t: $t } = useI18n()
const activeKey = ref('all')
const allRows = computed(() => props.version ? buildModelVersionDiffRows(props.version) : [])
const rows = computed(() => activeKey.value === 'all'
  ? allRows.value
  : allRows.value.filter(row => row.action === activeKey.value))
const versionText = computed(() => formatVersion(props.version?.version))
const tabs = computed(() => [
  { key: 'all', label: $t('GatewayCvModelVersionDrawer.detailTabs.all', { count: allRows.value.length }) },
  { key: 'added', label: $t('GatewayCvModelVersionDrawer.detailTabs.added', { count: countAction('added') }) },
  { key: 'changed', label: $t('GatewayCvModelVersionDrawer.detailTabs.changed', { count: countAction('changed') }) },
  { key: 'removed', label: $t('GatewayCvModelVersionDrawer.detailTabs.removed', { count: countAction('removed') }) },
  { key: 'reused', label: $t('GatewayCvModelVersionDrawer.detailTabs.reused', { count: countAction('reused') }) },
])
const columns = computed<TableColumnsType<ModelVersionDiffRow>>(() => [
  { title: $t('GatewayCvModelVersionDrawer.detailColumns.action'), key: 'action', width: 96 },
  { title: $t('GatewayCvModelVersionDrawer.detailColumns.path'), key: 'path', ellipsis: true },
  { title: $t('GatewayCvModelVersionDrawer.detailColumns.format'), key: 'format', width: 120 },
  { title: $t('GatewayCvModelVersionDrawer.detailColumns.currentMd5'), key: 'currentMd5', width: 140 },
  { title: $t('GatewayCvModelVersionDrawer.detailColumns.historyMd5'), key: 'historyMd5', width: 140 },
])

watch(() => props.open, (open) => {
  if (open) activeKey.value = 'all'
})

function handleOpenChange(value: boolean) {
  if (!value) emit('close')
}

function countAction(action: ModelVersionDiffAction) {
  return allRows.value.filter(row => row.action === action).length
}

function actionText(action: ModelVersionDiffAction) {
  return $t(`GatewayCvModelVersionDrawer.detailActions.${action}`)
}

function actionColor(action: ModelVersionDiffAction) {
  const colors: Record<ModelVersionDiffAction, string> = {
    added: 'success',
    changed: 'processing',
    removed: 'error',
    reused: 'default',
  }
  return colors[action]
}

function shortMd5(value: string | undefined) {
  if (!value) return '--'
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value
}
</script>

<style scoped lang="less">
.cv-version-diff-detail,
.cv-version-diff-detail__title {
  display: grid;
  gap: var(--space-3);
}

.cv-version-diff-detail__title strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-16);
}

.cv-version-diff-detail__title small,
.cv-version-diff-detail__file small {
  color: var(--jet-theme-text-tertiary, var(--jet-theme-text-disabled));
  font-size: var(--fs-14);
}

.cv-version-diff-detail__file {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
}

.cv-version-diff-detail__file strong,
.cv-version-diff-detail__file small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cv-version-diff-detail__file strong {
  color: var(--jet-theme-text);
  font-weight: 500;
}
</style>
