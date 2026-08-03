<template>
  <section class="children-tab">
    <header class="children-tab__head">
      <span class="children-tab__summary">{{ $t('IotDeviceChildren.summary', { total: pagination.total }) }}</span>
      <a-space>
        <a-button v-if="canCreateChild" type="primary" @click="openCreate">
          <template #icon>
            <AIcon type="PlusOutlined" aria-hidden="true" />
          </template>
          {{ $t('IotDeviceChildren.create.button') }}
        </a-button>
        <a-button type="primary" @click="openBind">
          <template #icon>
            <AIcon type="LinkOutlined" aria-hidden="true" />
          </template>
          {{ $t('IotDeviceChildren.bind.button') }}
        </a-button>
        <a-popconfirm
          v-if="selectedRowKeys.length"
          :title="$t('IotDeviceChildren.unbind.confirmBatch')"
          :ok-text="$t('IotDeviceChildren.unbind.ok')"
          :cancel-text="$t('IotDeviceChildren.unbind.cancel')"
          @confirm="unbindSelected"
        >
          <a-button danger :disabled="!selectedRowKeys.length">
            <template #icon>
              <AIcon type="DisconnectOutlined" aria-hidden="true" />
            </template>
            {{ $t('IotDeviceChildren.unbind.batch') }}
          </a-button>
        </a-popconfirm>
        <a-button v-else danger disabled>
          <template #icon>
            <AIcon type="DisconnectOutlined" aria-hidden="true" />
          </template>
          {{ $t('IotDeviceChildren.unbind.batch') }}
        </a-button>
      </a-space>
    </header>

    <IotDeviceAssetSearchBar
      :filter-fields="filterFields"
      :common-filter-fields="commonFilterFields"
      :filter-terms="filterTerms"
      :placeholder="$t('IotDeviceChildren.filter.conditionPlaceholder')"
      @update:filter-terms="handleFilterTermsUpdate"
      @search="handleFilterSearch"
    />

    <a-table
      class="children-table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      :row-key="(record) => record.id"
      :row-selection="rowSelection"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'id'">
          <a-button type="link" class="children-table__id" @click="viewChild(record)">
            {{ record.id }}
          </a-button>
        </template>
        <template v-else-if="column.key === 'state'">
          <a-badge :status="stateStatus(record.stateValue)" :text="record.stateText" />
        </template>
        <template v-else-if="column.key === 'registryTime'">
          {{ formatTime(record.registryTime) }}
        </template>
        <template v-else-if="column.key === 'describe'">
          <a-tooltip :title="record.describe || '--'">
            <span class="children-table__ellipsis">{{ record.describe || '--' }}</span>
          </a-tooltip>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space :size="12">
            <a-tooltip :title="$t('IotDeviceChildren.action.view')">
              <a-button type="text" class="children-icon-btn" @click="viewChild(record)">
                <template #icon>
                  <AIcon type="EyeOutlined" aria-hidden="true" />
                </template>
              </a-button>
            </a-tooltip>
            <a-tooltip
              :title="
                isChildDisabled(record)
                  ? $t('IotDeviceChildren.action.enable')
                  : $t('IotDeviceChildren.action.disable')
              "
            >
              <a-button
                type="text"
                class="children-icon-btn"
                :danger="!isChildDisabled(record)"
                :loading="rowActionBusyId === record.id"
                @click="toggleChildEnabled(record)"
              >
                <template #icon>
                  <AIcon
                    :type="isChildDisabled(record) ? 'CheckSquareOutlined' : 'StopOutlined'"
                    aria-hidden="true"
                  />
                </template>
              </a-button>
            </a-tooltip>
            <a-popconfirm
              :title="$t('IotDeviceChildren.unbind.confirmOne')"
              :ok-text="$t('IotDeviceChildren.unbind.ok')"
              :cancel-text="$t('IotDeviceChildren.unbind.cancel')"
              @confirm="unbindOne(record)"
            >
              <a-tooltip :title="$t('IotDeviceChildren.unbind.ok')">
                <a-button type="text" danger class="children-icon-btn">
                  <template #icon>
                    <AIcon type="DisconnectOutlined" aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
      <template #emptyText>
        <CloudEmpty :description="$t('IotDeviceChildren.empty')" />
      </template>
    </a-table>

    <a-modal
      v-model:open="bindOpen"
      :title="$t('IotDeviceChildren.bind.title')"
      :width="960"
      :ok-text="$t('IotDeviceChildren.bind.ok')"
      :cancel-text="$t('IotDeviceChildren.unbind.cancel')"
      :confirm-loading="bindLoading"
      @ok="bindSelected"
      @cancel="closeBind"
    >
      <div class="children-bind__filters">
        <a-input
          v-model:value="bindFilters.id"
          allow-clear
          :placeholder="$t('IotDeviceChildren.bind.idPlaceholder')"
          @press-enter="searchBindable"
        />
        <a-input
          v-model:value="bindFilters.name"
          allow-clear
          :placeholder="$t('IotDeviceChildren.bind.namePlaceholder')"
          @press-enter="searchBindable"
        />
        <a-select
          v-model:value="bindFilters.productId"
          allow-clear
          show-search
          option-filter-prop="label"
          :placeholder="$t('IotDeviceChildren.bind.productPlaceholder')"
          :options="productOptions"
        />
        <a-space>
          <a-button type="primary" @click="searchBindable">{{ $t('IotDeviceChildren.bind.search') }}</a-button>
          <a-button @click="resetBindableSearch">{{ $t('IotDeviceChildren.bind.reset') }}</a-button>
        </a-space>
      </div>
      <a-table
        :columns="bindColumns"
        :data-source="bindRows"
        :loading="bindListLoading"
        :pagination="bindPagination"
        :row-key="(record) => record.id"
        :row-selection="bindRowSelection"
        @change="onBindTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'state'">
            <a-badge :status="stateStatus(record.stateValue)" :text="record.stateText" />
          </template>
          <template v-else-if="column.key === 'registryTime'">
            {{ formatTime(record.registryTime) }}
          </template>
        </template>
        <template #emptyText>
          <CloudEmpty :description="$t('IotDeviceChildren.bind.empty')" />
        </template>
      </a-table>
    </a-modal>

    <IotAddDeviceDrawer
      v-model:open="createOpen"
      :project-id="projectId"
      device-type="childrenDevice"
      :parent-id="props.device.id"
      @created="onChildDeviceCreated"
    />
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import IotAddDeviceDrawer from '../IotAddDeviceDrawer.vue'
import IotDeviceAssetSearchBar from '../IotDeviceAssetSearchBar.vue'
import { useIotDeviceChildren } from '../../hooks/useIotDeviceChildren'
import type { IotDevice } from '../../types'

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
})

const emit = defineEmits<{
  (event: 'count-change', count: number): void
}>()
const { t: $t } = useI18n()

const {
  bindColumns,
  bindFilters,
  bindListLoading,
  bindLoading,
  bindOpen,
  bindPagination,
  bindRows,
  bindRowSelection,
  bindSelected,
  canCreateChild,
  closeBind,
  columns,
  commonFilterFields,
  createOpen,
  filterFields,
  filterTerms,
  formatTime,
  handleFilterSearch,
  handleFilterTermsUpdate,
  isChildDisabled,
  loading,
  onBindTableChange,
  onChildDeviceCreated,
  onTableChange,
  openBind,
  openCreate,
  pagination,
  productOptions,
  projectId,
  refresh,
  resetBindableSearch,
  rowActionBusyId,
  rowSelection,
  rows,
  searchBindable,
  selectedRowKeys,
  stateStatus,
  toggleChildEnabled,
  unbindOne,
  unbindSelected,
  viewChild,
} = useIotDeviceChildren(props, (count) => emit('count-change', count))

defineExpose({
  refresh,
})
</script>

<style scoped lang="less" src="./IotDeviceChildrenTab.less"></style>
