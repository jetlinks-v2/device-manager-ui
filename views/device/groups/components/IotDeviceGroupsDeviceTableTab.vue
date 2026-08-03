<template>
  <div class="group-devices" :aria-label="$t('IotDeviceGroups.deviceTable.aria')">
    <div class="group-devices__toolbar">
      <ConditionFilter
        class="group-devices__filter"
        :fields="deviceFilterFields"
        :commonFields="deviceCommonFilterFieldsByView"
        :modelValue="deviceFilterTerms"
        :placeholder="$t('IotDeviceGroups.deviceTable.searchPlaceholder')"
        @update:modelValue="$emit('update:deviceFilterTerms', $event)"
        @change="$emit('search', $event)"
      />
    </div>

    <j-pro-table
      mode="TABLE"
      rowKey="id"
      :columns="deviceTableColumns"
      :request="deviceTableRequest"
      :params="stableDeviceTableParams"
      :pagination="deviceTablePagination"
      :bodyStyle="{ padding: '0' }"
      :scroll="{ x: 1120 }"
      class="group-devices__table"
    >
      <template #name="device">
        <span class="group-devices__name">
          <div class="group-devices__name-link" @click="$router.push(deviceDetailPath(device.id))">
            {{ device.name }}
          </div>
          <small>{{ device.productName }}</small>
        </span>
      </template>
      <template #status="device">
        <IotDeviceStatusPill :status="device.status" />
      </template>
      <template #onlineDuration="device">
        <span>{{ onlineDuration(device) }}</span>
      </template>
      <template #lastSeen="device">
        <span class="group-devices__mono">{{ device.lastSeen }}</span>
      </template>
      <template #healthScore="device">
        <span class="group-devices__score" :data-tone="statusTone(device)">
          {{ deviceHealthScore(device) }}
        </span>
      </template>
      <template #actions="device">
        <a-button v-if="showUnbindAction" type="link" danger size="small" @click="$emit('unbind-device', device)">
          {{ $t('IotDeviceGroups.detail.unbindDevice') }}
        </a-button>
        <span v-else class="group-devices__empty-action">--</span>
      </template>
      <template #emptyText>
        <CloudEmpty :description="$t('IotDeviceGroups.deviceTable.empty')" />
      </template>
    </j-pro-table>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { ConditionFilterCommonField, ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import type { TableColumnType } from 'ant-design-vue'

import IotDeviceStatusPill from '@device-manager-ui/components/IotDeviceStatusPill.vue'
import { useIotDeviceMeta } from '@device-manager-ui/hooks/useIotDeviceMeta'
import type { IotDevice } from '@device-manager-ui/types'

const props = defineProps<{
  deviceCommonFilterFieldsByView: ConditionFilterCommonField[]
  deviceFilterFields: ConditionFilterField[]
  deviceFilterTerms: ConditionFilterTerm[]
  deviceTableColumns: TableColumnType[]
  deviceTablePagination: Record<string, unknown>
  deviceTableParams: Record<string, unknown>
  deviceTableRequest: (params: { pageIndex?: number; pageSize?: number }) => Promise<unknown>
  deviceDetailPath: (deviceId: string) => string
  deviceHealthScore: (device: IotDevice) => number
  onlineDuration: (device: IotDevice) => string
  showUnbindAction?: boolean
}>()

defineEmits<{
  (event: 'search', payload?: unknown): void
  (event: 'unbind-device', value: IotDevice): void
  (event: 'update:deviceFilterTerms', value: ConditionFilterTerm[]): void
}>()

const deviceTableParamsKey = computed(() => JSON.stringify(props.deviceTableParams ?? {}))
const stableDeviceTableParams = shallowRef<Record<string, unknown>>({})
const { statusMeta } = useIotDeviceMeta()

watch(deviceTableParamsKey, () => {
  // j-pro-table 会深度监听 params；仅查询契约变化时替换引用，避免父级派生状态触发表格重刷。
  stableDeviceTableParams.value = { ...(props.deviceTableParams ?? {}) }
}, { immediate: true })

function statusTone(device: IotDevice) {
  return statusMeta(device.status).tone
}
</script>

<style scoped>
.group-devices {
  display: grid;
  min-width: 0;
  max-width: 100%;
}

.group-devices__toolbar {
  min-width: 0;
  padding: 0.875rem 1.375rem 0.75rem;
  border-bottom: 1px solid var(--line);
}

.group-devices__filter,
.group-devices__table {
  min-width: 0;
  max-width: 100%;
}

.group-devices__table :deep(.jtable-body-header) {
  display: none;
}

.group-devices__table :deep(.jtable-body) {
  gap: 0;
  min-width: 0;
}

.group-devices__table :deep(.ant-table-wrapper) {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.group-devices__table :deep(.ant-table-content) {
  max-width: 100%;
  overflow-x: auto;
}

.group-devices__table :deep(.ant-table-thead > tr > th) {
  padding: 0.75rem 0.875rem;
  color: var(--ink-3);
  font-size: var(--fs-14);
  background: transparent;
}

.group-devices__table :deep(.ant-table-tbody > tr > td) {
  padding: 0.8125rem 0.875rem;
  vertical-align: middle;
}

.group-devices__table :deep(.jtable-pagination) {
  padding: 0.75rem 1.375rem 1rem;
}

.group-devices__name {
  display: grid;
  gap: 0.1875rem;
  min-width: 0;
}

.group-devices__name-link {
  justify-content: flex-start;
  padding: 0;
  color: var(--ink-1);
  font-weight: 600;
  cursor: pointer;
}
.group-devices__name-link:hover {
  color: var(--ink-2);
}

.group-devices__name small,
.group-devices__mono {
  color: var(--ink-3);
  font-size: var(--fs-14);
}

.group-devices__score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  min-height: 1.625rem;
  padding: 0 0.5rem;
  border-radius: 0.375rem;
  background: var(--bg-sunken);
  color: var(--accent);
  font-weight: 700;
}

.group-devices__score[data-tone='warn'] {
  background: var(--warn-bg);
  color: var(--warn);
}

.group-devices__score[data-tone='urgent'],
.group-devices__score[data-tone='err'] {
  background: var(--err-bg);
  color: var(--err);
}

.group-devices__empty-action {
  color: var(--ink-4);
}
</style>
