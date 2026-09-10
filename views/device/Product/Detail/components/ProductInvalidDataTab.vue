<template>
  <section class="product-invalid-data" :aria-label="$t('IotDeviceDetail.invalidData.aria')">
    <div class="product-invalid-data__filters">
      <a-range-picker
        v-model:value="filters.createTime"
        show-time
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        @change="search"
      />
      <a-input
        v-model:value="filters.thingName"
        class="product-invalid-data__input"
        :placeholder="$t('Invalid.index.031367-4')"
        allow-clear
        @press-enter="search"
      />
      <a-input
        v-model:value="filters.value"
        class="product-invalid-data__input"
        :placeholder="$t('IotDeviceDetail.invalidData.valuePlaceholder')"
        allow-clear
        @press-enter="search"
      />
      <a-space>
        <a-button type="primary" @click="search">{{ $t('IotDeviceDetail.common.search') }}</a-button>
        <a-button @click="resetSearch">{{ $t('IotDeviceDetail.common.reset') }}</a-button>
      </a-space>
    </div>

    <a-table
      class="product-invalid-data__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      :row-key="(record) => record.id"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'createTime'">
          <time>{{ record.createTime }}</time>
        </template>
        <template v-else-if="column.key === 'thingName'">
          <span class="product-invalid-data__ellipsis">{{ record.thingName }}</span>
        </template>
        <template v-else-if="column.key === 'description'">
          <a-tooltip :title="record.description">
            <span class="product-invalid-data__ellipsis">{{ record.description }}</span>
          </a-tooltip>
        </template>
        <template v-else-if="column.key === 'value'">
          <a-tooltip :title="record.value">
            <code class="product-invalid-data__ellipsis">{{ record.value }}</code>
          </a-tooltip>
        </template>
      </template>
      <template #emptyText>
        <CloudEmpty :description="$t('IotDeviceDetail.invalidData.empty')" />
      </template>
    </a-table>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { queryInvalidData } from '@device-manager-ui/api/rule-engine/log'
import { useProductStore } from '@device-manager-ui/store/product'
import { extractRows, formatApiTime } from '@device-manager-ui/views/device/list/services/iotDeviceDetailReal.service'

interface ProductInvalidDataRow {
  id: string
  createTime: string
  thingName: string
  description: string
  value: string
}

const { t: $t } = useI18n()
const productStore = useProductStore()
const loading = ref(false)
const rows = ref<ProductInvalidDataRow[]>([])
const total = ref(0)
const pageCurrent = ref(1)
const pageSize = ref(10)
const filters = ref<{
  createTime?: [string, string]
  thingName?: string
  value?: string
}>({})

const columns = computed(() => [
  { title: $t('Invalid.index.031367-1'), dataIndex: 'createTime', key: 'createTime', width: 190 },
  { title: $t('Invalid.index.031367-4'), dataIndex: 'thingName', key: 'thingName', ellipsis: true, width: 180 },
  { title: $t('Invalid.index.031367-2'), dataIndex: 'description', key: 'description', ellipsis: true },
  { title: $t('Invalid.index.031367-3'), dataIndex: 'value', key: 'value', ellipsis: true },
])

const pagination = computed(() => ({
  current: pageCurrent.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (value: number) => $t('IotDeviceDetail.common.count.item', { count: value }),
}))

/** Queries invalid payloads under the current product and retains the original product-wide device name filter. */
async function loadRows() {
  const productId = productStore.current?.id
  if (!productId) {
    rows.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const resp: any = await queryInvalidData({
      pageIndex: pageCurrent.value - 1,
      pageSize: pageSize.value,
      sorts: [{ name: 'createTime', order: 'desc' }],
      terms: buildTerms(productId),
    })
    const result = resp?.result ?? resp
    const nextRows = extractRows(result).map((item: any, index) => ({
      id: item.id || `${item.createTime || index}-${item.thingId || productId}`,
      createTime: formatApiTime(item.createTime),
      thingName: item.thingName || item.thingId || '--',
      description: item.description || item.reason || '--',
      value: item.value == null || item.value === '' ? '--' : String(item.value),
    }))
    rows.value = nextRows
    total.value = Number(result?.total ?? result?.page?.total ?? nextRows.length)
  } finally {
    loading.value = false
  }
}

function buildTerms(productId: string) {
  const terms: any[] = [{
    terms: [{ column: 'templateId', value: productId, termType: 'eq' }],
    type: 'and',
  }]
  const keywordFields = ['thingName', 'value'] as const
  keywordFields.forEach((field) => {
    const keyword = filters.value[field]?.trim()
    if (keyword) terms.push({ column: field, value: keyword, termType: 'like' })
  })
  if (filters.value.createTime?.length) {
    const [from, to] = filters.value.createTime
    terms.push({ column: 'createTime', value: from, termType: 'gte' })
    terms.push({ column: 'createTime', value: to, termType: 'lte' })
  }
  return terms
}

function onTableChange(nextPagination: any) {
  pageCurrent.value = Number(nextPagination?.current ?? 1)
  pageSize.value = Number(nextPagination?.pageSize ?? pageSize.value)
  void loadRows()
}

function search() {
  pageCurrent.value = 1
  void loadRows()
}

function resetSearch() {
  filters.value = {}
  search()
}

watch(
  () => productStore.current?.id,
  () => {
    pageCurrent.value = 1
    rows.value = []
    total.value = 0
    void loadRows()
  },
  { immediate: true },
)
</script>

<style scoped>
.product-invalid-data { display: grid; gap: 0.875rem; }
.product-invalid-data__filters { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
.product-invalid-data__input { width: 15rem; }
.product-invalid-data__table { min-width: 0; }
.product-invalid-data__table time, .product-invalid-data__table code { color: var(--jet-theme-text); }
.product-invalid-data__ellipsis { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; white-space: nowrap; }
@media (max-width: 53.75rem) {
  .product-invalid-data__filters { align-items: stretch; flex-direction: column; }
  .product-invalid-data__input { width: 100%; }
}
</style>
