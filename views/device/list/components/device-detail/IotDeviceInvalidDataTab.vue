<template>
  <section class="invalid-tab" :aria-label="$t('IotDeviceDetail.invalidData.aria')">
    <div class="invalid-filters">
      <a-range-picker
        v-model:value="filters.createTime"
        show-time
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        @change="search"
      />
      <a-input
        v-model:value="filters.value"
        class="invalid-filters__value"
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
      class="invalid-table"
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
        <template v-else-if="column.key === 'description'">
          <a-tooltip :title="record.description">
            <span class="invalid-table__ellipsis">{{ record.description }}</span>
          </a-tooltip>
        </template>
        <template v-else-if="column.key === 'value'">
          <a-tooltip :title="record.value">
            <code class="invalid-table__ellipsis">{{ record.value }}</code>
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
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import { extractRows, formatApiTime, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../../types'

interface InvalidDataRow {
  id: string
  createTime: string
  description: string
  value: string
}

const props = defineProps({
  device: {
    type: Object as PropType<IotDevice>,
    required: true,
  },
})

const { t: $t } = useI18n()

const columns = computed(() => [
  {
    title: $t('IotDeviceDetail.runtime.time'),
    dataIndex: 'createTime',
    key: 'createTime',
    width: 190,
  },
  {
    title: $t('IotDeviceDetail.threshold.description'),
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
  {
    title: $t('IotDeviceDetail.trace.value'),
    dataIndex: 'value',
    key: 'value',
    ellipsis: true,
  },
])

const loading = ref(false)
const rows = ref<InvalidDataRow[]>([])
const total = ref(0)
const pageCurrent = ref(1)
const pageSize = ref(10)
const filters = ref<{
  createTime?: [string, string]
  value?: string
}>({})

const pagination = computed(() => ({
  current: pageCurrent.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (value: number) => $t('IotDeviceDetail.common.count.item', { count: value }),
}))

async function loadRows() {
  if (!props.device.id) {
    rows.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const resp: any = await iotDeviceDetailRealApi.queryInvalidData({
      pageIndex: pageCurrent.value - 1,
      pageSize: pageSize.value,
      sorts: [{ name: 'createTime', order: 'desc' }],
      terms: buildTerms(),
    })
    const result = resp?.result ?? resp
    const nextRows = extractRows(result).map((item: any, index) => ({
      id: item.id || `${item.createTime || index}-${item.thingId || props.device.id}`,
      createTime: formatApiTime(item.createTime),
      description: item.description || item.reason || '--',
      value: item.value == null || item.value === '' ? '--' : String(item.value),
    }))
    rows.value = nextRows
    total.value = Number(result?.total ?? result?.page?.total ?? nextRows.length)
  } finally {
    loading.value = false
  }
}

function buildTerms() {
  const terms: any[] = [{
    terms: [{
      column: 'thingId',
      value: props.device.id,
      termType: 'eq',
    }],
    type: 'and',
  }]

  if (filters.value.value?.trim()) {
    terms.push({
      column: 'value',
      value: filters.value.value.trim(),
      termType: 'like',
    })
  }

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
  () => props.device.id,
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
.invalid-tab {
  display: grid;
  gap: 0.875rem;
}

.invalid-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.invalid-filters__value {
  width: 15rem;
}

.invalid-table {
  min-width: 0;
}

.invalid-table time,
.invalid-table code {
  color: var(--jet-theme-text);

}

.invalid-table__ellipsis {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

@media (max-width: 53.75rem) {
  .invalid-filters {
    align-items: stretch;
    flex-direction: column;
  }

  .invalid-filters__value {
    width: 100%;
  }
}
</style>
