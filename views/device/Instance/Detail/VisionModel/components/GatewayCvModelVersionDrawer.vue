<template>
  <a-drawer
    :open="open"
    :width="920"
    destroy-on-close
    placement="right"
    @close="handleDrawerClose"
    @update:open="handleOpenChange"
  >
    <template #title>
      <div class="cv-version-drawer__title">
        <strong>{{ $t('GatewayCvModelVersionDrawer.title') }}</strong>
        <small>{{ model?.name || '--' }}</small>
      </div>
    </template>

    <section class="cv-version-drawer">
      <a-descriptions v-if="model" size="small" bordered :column="2">
        <a-descriptions-item :label="$t('GatewayCvModelVersionDrawer.currentVersion')">
          {{ currentVersionText }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('GatewayCvModelVersionDrawer.historyCount')">
          {{ model.historyVersionCount }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('GatewayCvModelVersionDrawer.currentKey')">
          {{ currentVersionText }}
        </a-descriptions-item>
      </a-descriptions>

      <a-table
        :columns="columns"
        :data-source="versions"
        :loading="loading"
        :pagination="false"
        :row-key="record => versionRowKey(record)"
      >
        <template #emptyText>
          <CloudEmpty :description="$t('GatewayCvModelVersionDrawer.empty')" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'version'">
            <div class="cv-version-drawer__version">
              <strong>{{ formatVersion(record.version) }}</strong>
              <small>{{ record.entry || '--' }}</small>
            </div>
          </template>
          <template v-else-if="column.key === 'operationTime'">
            {{ formatDateTime(record.operationTime || record.createTime) }}
          </template>
          <template v-else-if="column.key === 'changed'">
            <a-space :size="4" wrap>
              <a-tag>{{ $t('GatewayCvModelVersionDrawer.changed.added', { count: changedCount(record, 'added') }) }}</a-tag>
              <a-tag>{{ $t('GatewayCvModelVersionDrawer.changed.modified', { count: changedCount(record, 'modified') }) }}</a-tag>
              <a-tag>{{ $t('GatewayCvModelVersionDrawer.changed.deleted', { count: changedCount(record, 'deleted') }) }}</a-tag>
              <a-tag>{{ $t('GatewayCvModelVersionDrawer.changed.noop', { count: changedCount(record, 'noop') }) }}</a-tag>
            </a-space>
          </template>
          <template v-else-if="column.key === 'files'">
            {{ $t('GatewayCvModelVersionDrawer.fileCount', { count: fileCount(record) }) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="4" wrap>
              <a-button
                v-if="hasDetails(record)"
                size="small"
                type="link"
                @click="openDiffDetails(record)"
              >
                {{ $t('GatewayCvModelVersionDrawer.viewDetails') }}
              </a-button>
              <a-popconfirm
                v-if="!isCurrent(record)"
                :title="$t('GatewayCvModelVersionDrawer.rollbackConfirm')"
                @confirm="handleRollback(record)"
              >
                <a-button size="small" type="link" :loading="loading">
                  {{ $t('GatewayCvModelVersionDrawer.rollback') }}
                </a-button>
              </a-popconfirm>
              <a-popconfirm
                v-if="!isCurrent(record)"
                :title="$t('GatewayCvModelVersionDrawer.cleanConfirm')"
                @confirm="handleClean(record)"
              >
                <a-button size="small" type="link" danger :loading="loading">
                  {{ $t('GatewayCvModelVersionDrawer.clean') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>

      <GatewayCvModelVersionDiffDetailDrawer
        :open="detailOpen"
        :version="selectedDetailVersion"
        @close="closeDiffDetails"
      />
    </section>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TableColumnsType } from 'ant-design-vue'
import GatewayCvModelVersionDiffDetailDrawer from './GatewayCvModelVersionDiffDetailDrawer.vue'
import type { GatewayCvModelItem, ModelVersionRecord } from '../gatewayCvModel.types'
import {
  currentVersionKey,
  formatDateTime,
  formatVersion,
  hasModelVersionDiffDetails,
  versionIdentity,
} from '../utils/gatewayCvModelFormat'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  model: {
    type: Object as PropType<GatewayCvModelItem | undefined>,
    default: undefined,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'rollback', version: ModelVersionRecord): void
  (e: 'clean', version: ModelVersionRecord): void
}>()

const { t: $t } = useI18n()
const selectedDetailVersion = ref<ModelVersionRecord>()
const versions = computed(() => props.model?.versionInfo.versions || [])
const currentVersionValue = computed(() => props.model?.currentVersionValue
  || currentVersionKey(props.model?.versionInfo.current)
  || String(props.model?.versionInfo.currentVersion || ''))
const currentVersionText = computed(() => props.model?.usesDefaultVersion
  ? $t('GatewayCvModelCard.defaultVersion')
  : props.model?.currentVersionText || formatVersion(currentVersionValue.value))
const columns = computed<TableColumnsType<ModelVersionRecord>>(() => [
  { title: $t('GatewayCvModelVersionDrawer.columns.version'), key: 'version', width: 160 },
  { title: $t('GatewayCvModelVersionDrawer.columns.changed'), key: 'changed', width: 260 },
  { title: $t('GatewayCvModelVersionDrawer.columns.files'), key: 'files', width: 90 },
  { title: $t('GatewayCvModelVersionDrawer.columns.operationTime'), key: 'operationTime', width: 150 },
  { title: $t('GatewayCvModelVersionDrawer.columns.action'), key: 'action', width: 210, fixed: 'right' },
])
const detailOpen = computed(() => Boolean(selectedDetailVersion.value))

function handleOpenChange(value: boolean) {
  if (!value) handleDrawerClose()
}

function handleDrawerClose() {
  closeDiffDetails()
  emit('close')
}

function openDiffDetails(record: unknown) {
  const version = toVersionRecord(record)
  if (!version) return
  selectedDetailVersion.value = version
}

function closeDiffDetails() {
  selectedDetailVersion.value = undefined
}

function handleRollback(record: unknown) {
  const version = toVersionRecord(record)
  if (version) emit('rollback', version)
}

function handleClean(record: unknown) {
  const version = toVersionRecord(record)
  if (version) emit('clean', version)
}

function isCurrent(record: unknown) {
  const version = toVersionRecord(record)
  return Boolean(version && currentVersionValue.value === versionIdentity(version))
}

function hasDetails(record: unknown) {
  const version = toVersionRecord(record)
  return Boolean(version && hasModelVersionDiffDetails(version))
}

function fileCount(record: ModelVersionRecord) {
  return countValue(record.fileCount, record.files?.length, record.modelFiles?.length)
}

function changedCount(record: ModelVersionRecord, type: 'added' | 'modified' | 'deleted' | 'noop') {
  const summaryKeyMap = {
    added: 'addedCount',
    modified: 'changedCount',
    deleted: 'removedCount',
    noop: 'reusedCount',
  } as const
  return countValue(record[summaryKeyMap[type]], record.changed?.[type]?.length)
}

function countValue(...values: unknown[]) {
  const value = values.find(item => Number.isFinite(Number(item)))
  return value === undefined ? 0 : Math.max(0, Number(value))
}

function toVersionRecord(record: unknown): ModelVersionRecord | undefined {
  if (!record || typeof record !== 'object') return undefined
  const version = record as ModelVersionRecord
  return versionIdentity(version)
    ? record as ModelVersionRecord
    : undefined
}

function versionRowKey(record: ModelVersionRecord) {
  return versionIdentity(record) || record.entry || JSON.stringify(record)
}
</script>

<style scoped lang="less">
.cv-version-drawer,
.cv-version-drawer__title {
  display: grid;
  gap: var(--space-3);
}

.cv-version-drawer__title strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-16);
}

.cv-version-drawer__title small,
.cv-version-drawer__version small {
  color: var(--jet-theme-text-tertiary, var(--jet-theme-text-disabled));
  font-size: var(--fs-14);
}

.cv-version-drawer__version {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
}

.cv-version-drawer__version strong,
.cv-version-drawer__version small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
