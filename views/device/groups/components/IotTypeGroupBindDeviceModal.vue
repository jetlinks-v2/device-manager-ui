<template>
  <a-modal
    :open="open"
    :title="title"
    :width="860"
    :confirm-loading="saving"
    :ok-text="$t('IotDeviceGroups.bindModal.okText')"
    :cancel-text="$t('IotDeviceDetail.common.cancel')"
    destroy-on-close
    centered
    @update:open="$emit('update:open', $event)"
    @ok="handleOk"
    @cancel="$emit('update:open', false)"
  >
    <div class="bind-device-modal">
      <ConditionFilter
        :fields="filterFields"
        :commonFields="commonFields"
        :modelValue="filterTerms"
        :placeholder="$t('IotDeviceGroups.bindModal.searchPlaceholder')"
        @update:modelValue="filterTerms = $event"
        @change="handleSearch"
      />

      <p v-if="visibleError" class="bind-device-modal__error">{{ visibleError }}</p>

      <j-pro-table
        mode="TABLE"
        rowKey="id"
        :columns="columns"
        :request="request"
        :params="tableParams"
        :pagination="pagination"
        :rowSelection="rowSelection"
        :bodyStyle="{ padding: '0' }"
        :scroll="{ x: 720 }"
      >
        <template #name="device">
          <span class="bind-device-modal__name">
            <strong>{{ device.name }}</strong>
            <small>{{ device.id }}</small>
          </span>
        </template>
        <template #state="device">
          <IotDeviceStatusPill :status="device.status" />
        </template>
        <template #emptyText>
          <CloudEmpty :description="$t('IotDeviceGroups.bindModal.empty')" />
        </template>
      </j-pro-table>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ConditionFilterCommonField, ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import type { TableColumnType } from 'ant-design-vue'

import IotDeviceStatusPill from '@device-manager-ui/components/IotDeviceStatusPill.vue'
import type { IotDevice } from '@device-manager-ui/types'
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n()

const props = defineProps<{
  open: boolean
  saving?: boolean
  error?: string
  groupName?: string
  searchTriggerKey?: number
  request: (params: { pageIndex?: number; pageSize?: number }) => Promise<unknown>
}>()

const emit = defineEmits<{
  (event: 'search', value: ConditionFilterTerm[]): void
  (event: 'save', value: IotDevice[]): void
  (event: 'update:open', value: boolean): void
}>()

const selectedRowKeys = ref<string[]>([])
const selectedRowsById = ref<Record<string, IotDevice>>({})
const filterTerms = ref<ConditionFilterTerm[]>([])
const formError = ref('')
const submittedFilterKey = ref('')
const title = computed(() => props.groupName ? $t('IotDeviceGroups.bindModal.titleWithName', { name: props.groupName }) : $t('IotDeviceGroups.bindModal.title'))
const visibleError = computed(() => formError.value || props.error || '')
const commonFields: ConditionFilterCommonField[] = ['name', 'identifier']
const filterFields: ConditionFilterField[] = [
  { dataIndex: 'name', title: $t('IotDeviceGroups.bindModal.column.name'), search: { type: 'string', defaultTermType: 'like', matchTokens: ['device', 'name'] } },
  { dataIndex: 'identifier', title: $t('IotDeviceList.filter.identifier'), search: { type: 'string', defaultTermType: 'like', matchTokens: ['deviceId', 'identifier', 'id'] } },
  { dataIndex: 'productName', title: $t('IotDeviceGroups.bindModal.column.product'), search: { type: 'string', defaultTermType: 'like', matchTokens: ['template', 'product'] } },
  {
    dataIndex: 'status',
    title: $t('IotDeviceGroups.bindModal.column.status'),
    search: {
      type: 'select',
      defaultTermType: 'in',
      options: [
        { label: $t('IotDeviceGroups.status.online'), value: 'online' },
        { label: $t('IotDeviceGroups.status.offline'), value: 'offline' },
        { label: $t('IotDeviceGroups.status.notActive'), value: 'notActive' },
      ],
      optionPanel: { multiple: true, showSearch: false },
      matchTokens: ['status'],
    },
  },
]
type BindDeviceTableColumn = TableColumnType & { scopedSlots?: boolean }

const columns: BindDeviceTableColumn[] = [
  { title: $t('IotDeviceGroups.bindModal.column.name'), dataIndex: 'name', key: 'name', scopedSlots: true, ellipsis: true, width: 260 },
  { title: $t('IotDeviceGroups.bindModal.column.product'), dataIndex: 'productName', key: 'productName', ellipsis: true, width: 180 },
  { title: $t('IotDeviceGroups.bindModal.column.status'), dataIndex: 'state', key: 'state', scopedSlots: true, width: 120 },
  { title: $t('IotDeviceGroups.bindModal.column.lastSeen'), dataIndex: 'lastSeen', key: 'lastSeen', width: 170 },
]
const pagination = {
  pageSizeOptions: ['10', '20', '50'],
  showSizeChanger: true,
  showTotal: (total: number) => $t('IotDeviceGroups.bindModal.total', { total }),
}
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: Array<string | number>, rows: IotDevice[]) => {
    selectedRowKeys.value = keys.map(String)
    selectedRowsById.value = Object.fromEntries(rows.map((row) => [row.id, row]))
  },
}))
const tableParams = computed(() => ({
  open: props.open,
  filterKey: submittedFilterKey.value,
  searchTriggerKey: props.searchTriggerKey ?? 0,
}))

watch(() => props.open, (open) => {
  if (!open) return
  selectedRowKeys.value = []
  selectedRowsById.value = {}
  filterTerms.value = []
  submittedFilterKey.value = ''
  formError.value = ''
  emit('search', [])
})

function handleSearch(payload?: { terms?: ConditionFilterTerm[] }) {
  const terms = payload?.terms ?? filterTerms.value
  submittedFilterKey.value = JSON.stringify(terms)
  emit('search', terms)
}

function handleOk() {
  if (!selectedRowKeys.value.length) {
    formError.value = $t('IotDeviceGroups.bindModal.selectRequired')
    return
  }
  formError.value = ''
  emit('save', selectedRowKeys.value.map((id) => selectedRowsById.value[id] ?? { id } as IotDevice))
}
</script>

<style scoped>
.bind-device-modal {
  display: grid;
  gap: var(--space-3);
}

.bind-device-modal__error {
  margin: 0;
  color: var(--jet-theme-error);
  font-size: var(--fs-14);
}

.bind-device-modal__name {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}

.bind-device-modal__name strong {
  color: var(--ink-1);
}

.bind-device-modal__name small {
  color: var(--ink-3);
  font-size: var(--fs-14);
}
</style>
