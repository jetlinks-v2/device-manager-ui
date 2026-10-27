<template>
  <section class="invalid-tab" :aria-label="$t('IotDeviceDetail.invalidData.aria')">
    <ConditionFilter
      v-model="filterTerms"
      :fields="filterFields"
      :common-fields="filterCommonFields"
      :placeholder="$t('IotDeviceList.filter.conditionPlaceholder')"
      @change="handleSearch"
    />

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
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import { useIotDeviceInvalidData } from '../../hooks/useIotDeviceInvalidData'
import type { IotDevice } from '../../types'

const props = defineProps({
  device: {
    type: Object as PropType<IotDevice>,
    required: true,
  },
})

const { t: $t } = useI18n()
const {
  columns,
  filterCommonFields,
  filterFields,
  filterTerms,
  handleSearch,
  loading,
  onTableChange,
  pagination,
  rows,
} = useIotDeviceInvalidData(() => props.device)
</script>

<style scoped>
.invalid-tab {
  display: grid;
  gap: 0.875rem;
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

</style>
