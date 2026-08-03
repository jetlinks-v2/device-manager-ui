<template>
  <a-modal
    :open="open"
    :title="$t('IotDeviceList.assignGroup.title', { count: selectedDeviceCount })"
    :width="880"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !selectedGroupId }"
    :ok-text="$t('IotDeviceList.assignGroup.confirm')"
    :cancel-text="$t('IotDeviceList.action.cancel')"
    destroy-on-close
    centered
    @update:open="$emit('update:open', $event)"
    @ok="handleOk"
    @cancel="$emit('update:open', false)"
  >
    <div class="assign-group-modal">
      <ConditionFilter
        :fields="filterFields"
        :commonFields="commonFields"
        :modelValue="filterTerms"
        :placeholder="$t('IotDeviceList.assignGroup.searchPlaceholder')"
        @update:modelValue="handleFilterTermsUpdate"
        @change="handleFilterSearch"
      />

      <p v-if="visibleError" class="assign-group-modal__error">{{ visibleError }}</p>

      <j-pro-table
        mode="TABLE"
        rowKey="id"
        :columns="columns"
        :request="tableRequest"
        :params="tableParams"
        :pagination="pagination"
        :rowSelection="rowSelection"
        :bodyStyle="{ padding: 0 }"
        :scroll="{ x: 720 }"
      >
        <template #name="group">
          <span class="assign-group-modal__name">
            <strong>{{ group.name }}</strong>
            <small>{{ group.key || group.id }}</small>
          </span>
        </template>

        <template #description="group">
          <span class="assign-group-modal__description">
            {{ group.description || $t('IotDeviceList.assignGroup.noDescription') }}
          </span>
        </template>
        <template #emptyText>
          <CloudEmpty :description="$t('IotDeviceList.assignGroup.empty')" />
        </template>
      </j-pro-table>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TableColumnType } from 'ant-design-vue'
import ConditionFilter, {
  buildQueryFilter,
  type ConditionFilterCommonField,
  type ConditionFilterField,
  type ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter'
import {
  queryDeviceGroupPage_api,
  type DeviceGroup,
  type DeviceGroupQueryTerm,
} from '@device-manager-ui/api/deviceGroup'

const props = defineProps<{
  open: boolean
  saving?: boolean
  error?: string
  selectedDeviceCount: number
}>()

const emit = defineEmits<{
  (event: 'save', group: DeviceGroup): void
  (event: 'update:open', value: boolean): void
}>()

const { t: $t } = useI18n()
const filterTerms = ref<ConditionFilterTerm[]>([])
const submittedTerms = ref<ConditionFilterTerm[]>([])
const selectedGroup = ref<DeviceGroup | null>(null)
const formError = ref('')
const refreshKey = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const visibleError = computed(() => formError.value || props.error || '')
const selectedGroupId = computed(() => selectedGroup.value?.id || '')

const commonFields: ConditionFilterCommonField[] = ['name', 'key', 'description']
const filterFields = computed<ConditionFilterField[]>(() => [
  {
    dataIndex: 'name',
    title: $t('IotDeviceList.assignGroup.name'),
    search: {
      type: 'string',
      defaultTermType: 'like',
      matchTokens: ['分组名称', '名称', 'groupName', 'name'],
    },
  },
  {
    dataIndex: 'key',
    title: $t('IotDeviceList.assignGroup.key'),
    search: {
      type: 'string',
      defaultTermType: 'like',
      matchTokens: ['分组标识', '标识', 'groupKey', 'key'],
    },
  },
  {
    dataIndex: 'description',
    title: $t('IotDeviceList.assignGroup.description'),
    search: {
      type: 'string',
      defaultTermType: 'like',
      matchTokens: ['分组说明', '说明', 'description'],
    },
  },
])

type AssignGroupTableColumn = TableColumnType & { scopedSlots?: boolean }

const columns = computed<AssignGroupTableColumn[]>(() => [
  { title: $t('IotDeviceList.assignGroup.name'), dataIndex: 'name', key: 'name', scopedSlots: true, width: 260 },
  { title: $t('IotDeviceList.assignGroup.deviceCount'), dataIndex: 'deviceCount', key: 'deviceCount', width: 130 },
  { title: $t('IotDeviceList.assignGroup.description'), dataIndex: 'description', key: 'description', scopedSlots: true, ellipsis: true },
])

const pagination = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  pageSizeOptions: ['10', '20', '50'],
  showSizeChanger: true,
  showTotal: (total: number) => $t('IotDeviceList.assignGroup.total', { total }),
}))

const rowSelection = computed(() => ({
  type: 'radio',
  selectedRowKeys: selectedGroupId.value ? [selectedGroupId.value] : [],
  onSelect: (record: DeviceGroup, selected: boolean) => {
    selectedGroup.value = selected ? record : null
    formError.value = ''
  },
  onChange: (_keys: Array<string | number>, rows: DeviceGroup[]) => {
    selectedGroup.value = rows[0] ?? null
    formError.value = ''
  },
}))

const tableParams = computed(() => ({
  open: props.open,
  refreshKey: refreshKey.value,
  filterKey: JSON.stringify(submittedTerms.value),
}))

watch(() => props.open, (open) => {
  if (!open) return
  filterTerms.value = []
  submittedTerms.value = []
  selectedGroup.value = null
  formError.value = ''
  currentPage.value = 1
  refreshKey.value += 1
})

function buildGroupQueryTerms() {
  const filter = buildQueryFilter(submittedTerms.value, filterFields.value)
  return (filter.terms as DeviceGroupQueryTerm[]) ?? []
}

async function tableRequest(params: { pageIndex?: number; pageSize?: number }) {
  const pageIndex = Number(params.pageIndex ?? Math.max(currentPage.value - 1, 0))
  const pageSizeValue = Number(params.pageSize ?? pageSize.value)
  currentPage.value = pageIndex + 1
  pageSize.value = pageSizeValue

  try {
    const result = await queryDeviceGroupPage_api({
      pageIndex,
      pageSize: pageSizeValue,
      terms: buildGroupQueryTerms(),
    })

    return {
      success: true,
      result,
    }
  } catch (error) {
    formError.value = error instanceof Error ? error.message : $t('IotDeviceList.assignGroup.loadFailed')
    return {
      success: false,
      result: {
        data: [],
        total: 0,
        pageIndex,
        pageSize: pageSizeValue,
      },
    }
  }
}

function cloneTerms(terms: ConditionFilterTerm[] = []): ConditionFilterTerm[] {
  return terms.map((item) => ({
    ...item,
    value: Array.isArray(item.value) ? [...item.value] : item.value,
    terms: Array.isArray(item.terms) ? cloneTerms(item.terms as ConditionFilterTerm[]) as ConditionFilterTerm['terms'] : item.terms,
  }))
}

function handleFilterTermsUpdate(terms: ConditionFilterTerm[] = []) {
  filterTerms.value = cloneTerms(terms)
}

function handleFilterSearch(payload?: { terms?: ConditionFilterTerm[] }) {
  const terms = cloneTerms(payload?.terms ?? filterTerms.value)
  filterTerms.value = terms
  submittedTerms.value = terms
  selectedGroup.value = null
  currentPage.value = 1
  refreshKey.value += 1
}

function handleOk() {
  if (!selectedGroup.value) {
    formError.value = $t('IotDeviceList.assignGroup.selectRequired')
    return
  }
  formError.value = ''
  emit('save', selectedGroup.value)
}
</script>

<style scoped lang="less">
.assign-group-modal {
  display: grid;
  gap: var(--space-3);
}

.assign-group-modal__error {
  margin: 0;
  color: var(--jet-theme-error);
  font-size: var(--fs-meta);
}

.assign-group-modal__name {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.assign-group-modal__name strong {
  color: var(--ink-1);
}

.assign-group-modal__name small,
.assign-group-modal__description {
  color: var(--ink-3);
  font-size: var(--fs-tiny);
}
</style>
