<template>
  <j-page-container>
    <main class="device-alarm-page">
      <PageHeader
        :title="$t('DeviceAlarm.title.page')"
        :description="$t('DeviceAlarm.description.page')"
        style="margin: 0"
      >
        <template #actions>
          <a-space>
            <DeviceAlarmRestoreButton @restored="refresh" />
            <a-button type="primary" @click="openCreate">
              <AIcon type="PlusOutlined" />
              {{ $t('DeviceAlarm.action.create') }}
            </a-button>
          </a-space>
        </template>
      </PageHeader>

      <section class="device-alarm-page__filter">
        <ConditionFilter
          :fields="filterFields"
          :modelValue="filterTerms"
          :placeholder="$t('DeviceAlarm.placeholder.filter')"
          @update:modelValue="handleFilterTermsUpdate"
          @change="handleSearch"
        />
      </section>

      <section class="device-alarm-page__table">
        <JProTable
          rowKey="key"
          mode="TABLE"
          :columns="columns"
          :request="tableRequest"
          :params="tableParams"
          :pagination="tablePagination"
          :alertShow="false"
          :bodyStyle="{ padding: 0 }"
          :scroll="{x: 'max-content'}"
        >
          <template #name="record">
            <span class="device-alarm-page__name">
              <IconBadge
                :size="32"
                :inner-size="24"
                :text="alarmNameInitial(record)"
                aria-hidden="true"
              />
              <span class="device-alarm-page__name-text" :title="toAlarmRow(record).name">
                {{ toAlarmRow(record).name || '--' }}
              </span>
            </span>
          </template>
          <template #productName="record">
            <span>{{ productName(record) }}</span>
          </template>
          <template #deviceName="record">
            <span>{{ deviceName(record) }}</span>
          </template>
          <template #trigger="record">
            <span>{{ rowTriggerText(record) }}</span>
          </template>
          <template #level="record">
            <StatusTag
              :status="levelStatus(record.level)"
              :style="levelTagStyle(record.level)"
              :text="String(levelLabel(record.level))"
            />
          </template>
          <template #notificationConfigured="record">
            <StatusTag
              class="device-alarm-page__notification-tag"
              :status="notificationStatus(record)"
              :text="notificationText(record)"
              :bordered="false"
            >
              <template #icon>
                <span class="device-alarm-page__status-dot" />
              </template>
            </StatusTag>
          </template>
          <template #action="record">
            <a-space>
              <a-button type="link" size="small" @click="openEdit(toAlarmRow(record))">
                {{ $t('DeviceAlarm.action.edit') }}
              </a-button>
              <a-popconfirm
                :title="$t('DeviceAlarm.confirm.delete', { name: record.name })"
                @confirm="remove(toAlarmRow(record))"
              >
                <a-button type="link" size="small" danger>
                  {{ $t('DeviceAlarm.action.delete') }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
          <template #emptyText>
            <CloudEmpty>
              <template #description>
                <span>{{ $t('DeviceAlarm.empty') }}</span>
              </template>
            </CloudEmpty>
          </template>
        </JProTable>
      </section>

      <DeviceAlarmEditorModal
        v-model:open="editorOpen"
        :model="form"
        :readonly-scope="Boolean(editingRow)"
        :level-options="levelOptions"
        :trigger-options="triggerOptions"
        :product-option="selectedProductOption"
        :device-option="selectedDeviceOption"
        :product-request="requestProducts"
        :device-request="requestDevices"
        :property-options="propertyOptions"
        :notify-methods="notifyMethods"
        :notify-users="notifyUsers"
        :notify-loading="notifyLoading"
        :product-reload-key="productReloadKey"
        @product-change="onProductChange"
        @device-change="onDeviceChange"
        @property-change="onPropertyChange"
        @load-more-users="loadMoreNotifyUsers"
        @save="save"
      />

    </main>
  </j-page-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import IconBadge from '@jetlinks-web-core/components/IconBadge/index.vue'
import { PageHeader } from '@jetlinks-web-core/components'
import DeviceAlarmEditorModal from './components/DeviceAlarmEditorModal.vue'
import DeviceAlarmRestoreButton from './components/DeviceAlarmRestoreButton.vue'
import { useDeviceAlarmPage } from './hooks/useDeviceAlarmPage'
import type { DeviceAlarmRow } from './types'

const { t: $t } = useI18n()

const {
  tablePagination,
  tableParams,
  filterTerms,
  filterFields,
  columns,
  levelOptions,
  triggerOptions,
  propertyOptions,
  selectedProductOption,
  selectedDeviceOption,
  notifyMethods,
  notifyUsers,
  notifyLoading,
  editorOpen,
  productReloadKey,
  editingRow,
  form,
  refresh,
  tableRequest,
  formatTriggerText,
  handleFilterTermsUpdate,
  handleSearch,
  openCreate,
  openEdit,
  requestProducts,
  requestDevices,
  onProductChange,
  onDeviceChange,
  onPropertyChange,
  loadMoreNotifyUsers,
  save,
  remove,
} = useDeviceAlarmPage($t)

const levelLabel = (level: number) =>
  levelOptions.value.find((item) => item.value === level)?.label || level

const levelStatus = (level: number) => {
  if (level === 1) return 'error' as const
  if (level === 2 || level === 3) return 'warning' as const
  if (level === 4) return 'info' as const
  if (level === 5) return 'success' as const
  return 'default' as const
}

const levelTagStyle = (level: number) => {
  if (level === 3) return { '--status-tag-color': '#f7ba1e' }
  if (level === 5) return { '--status-tag-color': '#11c6b7' }
  return undefined
}

const toAlarmRow = (record: Record<string, any>) => record as DeviceAlarmRow
const alarmNameInitial = (record: Record<string, any>) => Array.from(toAlarmRow(record).name?.trim() || '')[0] || '--'
const rowTriggerText = (record: Record<string, any>) => formatTriggerText(toAlarmRow(record))
const productName = (record: Record<string, any>) => {
  const row = toAlarmRow(record)
  return row.productName || (row.source === 'product' ? row.targetName : '') || '--'
}
const deviceName = (record: Record<string, any>) => {
  const row = toAlarmRow(record)
  return row.source === 'product' ? $t('DeviceAlarm.deviceRange.all') : row.targetName || '--'
}
const notificationText = (record: Record<string, any>) => {
  const row = toAlarmRow(record)
  if (!row.notificationConfigured) return $t('DeviceAlarm.notification.none')
  return row.notificationEnabled
    ? $t('DeviceAlarm.notification.enabled')
    : $t('DeviceAlarm.notification.disabled')
}
const notificationStatus = (record: Record<string, any>) => {
  const row = toAlarmRow(record)
  if (!row.notificationConfigured) return 'disabled' as const
  return row.notificationEnabled ? 'success' as const : 'warning' as const
}
</script>

<style scoped lang="less">
.device-alarm-page {
  display: flex;
  gap: var(--space-4);
	flex-direction: column;
  min-width: 0;
	background: color-mix(in srgb, var(--jet-theme-bg-container) 70%, transparent);
	border-radius: var(--r-4);
}
.device-alarm-page__filter {
	flex: 1;
}
.device-alarm-page__table {
  background: #fff;
	width: 100%;
  border-radius: 6px;
}

.device-alarm-page__table {
  :deep(.jtable-pagination) {
    margin-top: var(--space-3);
  }
}

.device-alarm-page__name {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  max-width: 100%;
}

.device-alarm-page__name-text {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-alarm-page__notification-tag {
  min-height: 1.5rem;
  gap: .25rem;
  padding: .25rem .625rem;
  border-radius: .6875rem;
}

.device-alarm-page__status-dot {
  display: block;
  width: .25rem;
  height: .25rem;
  background: currentcolor;
  border-radius: 50%;
}
</style>
