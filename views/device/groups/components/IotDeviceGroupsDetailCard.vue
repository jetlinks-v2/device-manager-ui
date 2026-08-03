<template>
  <section
    v-if="selectedGroup && overview"
    class="group-detail-card"
    :aria-label="$t('IotDeviceGroups.detail.aria')"
  >
    <header class="group-detail-card__hero">
      <div class="group-detail-card__identity">
        <span class="group-detail-card__icon">
          <AIcon :type="overview.icon" aria-hidden="true" />
        </span>
        <div class="group-detail-card__summary">
          <div class="group-detail-card__path">
            <template v-for="(item, index) in overview.pathSegments" :key="`${item}-${index}`">
              <span>{{ item }}</span>
              <span v-if="index < overview.pathSegments.length - 1">/</span>
            </template>
          </div>
          <h2>
            {{ selectedGroup.name }}
            <IotDeviceStatusPill :label="overview.riskLabel" :tone="overview.riskTone" />
          </h2>
        </div>
      </div>
      <div class="group-detail-card__controls">
        <div class="group-detail-card__tabs">
          <button
            v-for="item in tabs"
            :key="item.key"
            type="button"
            class="group-detail-card__tab"
            :class="{ 'is-active': activeTab === item.key }"
            @click="$emit('update:activeTab', item.key)"
          >
            <span>{{ item.label }}</span>
            <em v-if="item.count !== undefined">{{ item.count }}</em>
          </button>
        </div>
        <div v-if="canBindDevices" class="group-detail-card__actions">
          <a-button type="primary" @click="$emit('bindGroupDevices', selectedGroup)">
            <template #icon>
              <AIcon type="LinkOutlined" aria-hidden="true" />
            </template>
            {{ $t('IotDeviceGroups.detail.bindDevice') }}
          </a-button>
        </div>
      </div>
    </header>

    <div class="group-detail-card__body" :class="{ 'group-detail-card__body--devices': activeTab === 'devices' }">
      <IotDeviceGroupsOverviewTab
        v-if="activeTab === 'overview'"
        :overview="overview"
        :selectedGroup="selectedGroup"
      />
      <IotDeviceGroupsDeviceTableTab
        v-else
        :deviceCommonFilterFieldsByView="deviceCommonFilterFieldsByView"
        :deviceFilterFields="deviceFilterFields"
        :deviceFilterTerms="deviceFilterTerms"
        :deviceTableColumns="deviceTableColumns"
        :deviceTablePagination="deviceTablePagination"
        :deviceTableParams="deviceTableParams"
        :deviceTableRequest="deviceTableRequest"
        :deviceDetailPath="deviceDetailPath"
        :deviceHealthScore="deviceHealthScore"
        :onlineDuration="onlineDuration"
        :showUnbindAction="canBindDevices"
        @unbind-device="$emit('unbindGroupDevice', selectedGroup, $event)"
        @update:deviceFilterTerms="$emit('update:deviceFilterTerms', $event)"
        @search="$emit('search', $event)"
      />
    </div>
  </section>

  <section v-else class="group-detail-card group-detail-card--empty">
    <CloudEmpty class="empty-state group-detail-card__empty" :description="$t('IotDeviceGroups.detail.empty')" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ConditionFilterCommonField, ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import type { TableColumnType } from 'ant-design-vue'

import IotDeviceStatusPill from '@device-manager-ui/components/IotDeviceStatusPill.vue'
import type { IotDevice } from '@device-manager-ui/types'

import IotDeviceGroupsDeviceTableTab from './IotDeviceGroupsDeviceTableTab.vue'
import IotDeviceGroupsOverviewTab from './IotDeviceGroupsOverviewTab.vue'
import type { GroupItem, GroupOverviewModel } from './iotDeviceGroupsPage.types'
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n()

const props = defineProps<{
  activeTab: 'overview' | 'devices'
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
  overview: GroupOverviewModel | null
  selectedGroup: GroupItem | undefined
  selectedVisibleDeviceCount: number
}>()

defineEmits<{
  (event: 'bindGroupDevices', value: GroupItem): void
  (event: 'search', payload?: unknown): void
  (event: 'unbindGroupDevice', group: GroupItem, device: IotDevice): void
  (event: 'update:activeTab', value: 'overview' | 'devices'): void
  (event: 'update:deviceFilterTerms', value: ConditionFilterTerm[]): void
}>()

const tabs = computed(() => [
  { key: 'overview' as const, label: $t('IotDeviceGroups.detail.tab.overview') },
  { key: 'devices' as const, label: $t('IotDeviceGroups.detail.tab.deviceList'), count: props.selectedVisibleDeviceCount },
])

const canBindDevices = computed(() => {
  const group = props.selectedGroup
  if (!group) return false
  if (group.view === 'type') return !group.isVirtual
  return group.view === 'area' && Boolean(group.area)
})
</script>

<style scoped src="./IotDeviceGroupsDetailCard.css"></style>
