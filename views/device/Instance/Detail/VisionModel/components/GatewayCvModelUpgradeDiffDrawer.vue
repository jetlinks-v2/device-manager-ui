<template>
  <a-drawer
    :open="open"
    :width="920"
    destroy-on-close
    placement="right"
    @close="$emit('close')"
    @update:open="handleOpenChange"
  >
    <template #title>
      <div class="cv-upgrade-diff__title">
        <strong>{{ $t('GatewayCvModelUpgradeDiffDrawer.title') }}</strong>
        <small>{{ model?.name || '--' }}</small>
      </div>
    </template>

    <section class="cv-upgrade-diff">
      <a-alert
        v-if="!result"
        show-icon
        type="info"
        :message="$t('GatewayCvModelUpgradeDiffDrawer.unchecked')"
      />
      <template v-else>
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
          :row-key="rowKey"
          size="small"
        >
          <template #emptyText>
            <CloudEmpty :description="$t('GatewayCvModelUpgradeDiffDrawer.empty')" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-tag :color="actionColor(record.action)">
                {{ actionText(record.action) }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'path'">
              <div class="cv-upgrade-diff__path">
                <strong>{{ record.filePath }}</strong>
                <small>{{ record.fileKey || '--' }}</small>
              </div>
            </template>
            <template v-else-if="column.key === 'size'">
              {{ formatBytes(record.size) }}
            </template>
            <template v-else-if="column.key === 'md5'">
              <div class="cv-upgrade-diff__md5">
                <span v-if="record.platformMd5">{{ shortMd5(record.platformMd5) }}</span>
                <small v-if="record.edgeMd5">{{ shortMd5(record.edgeMd5) }}</small>
                <span v-if="!record.platformMd5 && !record.edgeMd5">--</span>
              </div>
            </template>
          </template>
        </a-table>
      </template>
    </section>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TableColumnsType } from 'ant-design-vue'
import type {
  EdgeGatewayModelUpgradeCheckResult,
  GatewayCvModelItem,
  ModelUpgradeFileDiff,
} from '../gatewayCvModel.types'
import { formatBytes } from '../utils/gatewayCvModelFormat'

type DiffAction = 'download' | 'add' | 'delete' | 'skip' | 'filtered'

type DiffRow = ModelUpgradeFileDiff & {
  action: DiffAction
  filePath: string
  rowId: string
}

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  model: {
    type: Object as PropType<GatewayCvModelItem | undefined>,
    default: undefined,
  },
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t: $t } = useI18n()
const activeKey = ref('all')
const result = computed(() => props.model?.upgradeCheckResult)
const allRows = computed(() => buildRows(result.value))
const tabs = computed(() => [
  { key: 'all', label: $t('GatewayCvModelUpgradeDiffDrawer.tabs.all', { count: allRows.value.length }) },
  { key: 'download', label: $t('GatewayCvModelUpgradeDiffDrawer.tabs.download', { count: countByAction('download') + countByAction('add') }) },
  { key: 'delete', label: $t('GatewayCvModelUpgradeDiffDrawer.tabs.delete', { count: countByAction('delete') }) },
  { key: 'skip', label: $t('GatewayCvModelUpgradeDiffDrawer.tabs.skip', { count: countByAction('skip') }) },
  { key: 'filtered', label: $t('GatewayCvModelUpgradeDiffDrawer.tabs.filtered', { count: countByAction('filtered') }) },
])
const rows = computed(() => {
  if (activeKey.value === 'all') return allRows.value
  if (activeKey.value === 'download') return allRows.value.filter(row => row.action === 'download' || row.action === 'add')
  return allRows.value.filter(row => row.action === activeKey.value)
})
const columns = computed<TableColumnsType<DiffRow>>(() => [
  { title: $t('GatewayCvModelUpgradeDiffDrawer.columns.action'), key: 'action', width: 96 },
  { title: $t('GatewayCvModelUpgradeDiffDrawer.columns.path'), key: 'path', ellipsis: true },
  { title: $t('GatewayCvModelUpgradeDiffDrawer.columns.size'), key: 'size', width: 110 },
  { title: $t('GatewayCvModelUpgradeDiffDrawer.columns.md5'), key: 'md5', width: 150 },
])

watch(() => props.open, (open) => {
  if (open) activeKey.value = 'all'
})

function handleOpenChange(value: boolean) {
  if (!value) emit('close')
}

function buildRows(input?: EdgeGatewayModelUpgradeCheckResult): DiffRow[] {
  if (!input) return []

  return [
    ...toRows(input.upgraded, 'download'),
    ...toRows(input.added, 'add'),
    ...toRows(input.removed, 'delete'),
    ...toRows(input.unchanged, 'skip'),
    ...toRows(input.filtered, 'filtered'),
  ]
}

function toRows(files: ModelUpgradeFileDiff[] | undefined, action: DiffAction): DiffRow[] {
  return (files || []).map((file, index) => {
    const filePath = displayPath(file)
    return {
      ...file,
      action,
      filePath,
      rowId: `${action}:${file.fileKey || filePath}:${index}`,
    }
  })
}

function displayPath(file: ModelUpgradeFileDiff) {
  const path = file.path?.trim()
  const name = file.name?.trim()
  if (path && name) return path.endsWith('/') ? `${path}${name}` : `${path}/${name}`
  return path || name || file.fileKey || '--'
}

function countByAction(action: DiffAction) {
  return allRows.value.filter(row => row.action === action).length
}

function rowKey(row: DiffRow) {
  return row.rowId
}

function actionText(action: DiffAction) {
  return $t(`GatewayCvModelUpgradeDiffDrawer.actions.${action}`)
}

function actionColor(action: DiffAction) {
  const colors: Record<DiffAction, string> = {
    download: 'processing',
    add: 'success',
    delete: 'error',
    skip: 'default',
    filtered: 'warning',
  }
  return colors[action]
}

function shortMd5(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value
}
</script>

<style scoped lang="less">
.cv-upgrade-diff,
.cv-upgrade-diff__title {
  display: grid;
  gap: var(--space-3);
}

.cv-upgrade-diff__title strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-16);
}

.cv-upgrade-diff__title small,
.cv-upgrade-diff__path small {
  color: var(--jet-theme-text-tertiary, var(--jet-theme-text-disabled));
  font-size: var(--fs-14);
}

.cv-upgrade-diff__path,
.cv-upgrade-diff__md5 {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
}

.cv-upgrade-diff__path strong,
.cv-upgrade-diff__path small,
.cv-upgrade-diff__md5 span,
.cv-upgrade-diff__md5 small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cv-upgrade-diff__path strong {
  color: var(--jet-theme-text);
  font-weight: 500;
}

.cv-upgrade-diff__md5 span {
  color: var(--jet-theme-error, #ff4d4f);
}

.cv-upgrade-diff__md5 small {
  color: var(--jet-theme-success, #52c41a);
}
</style>
