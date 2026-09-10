<template>
  <template v-if="device">
    <div v-if="activeTab !== 'access'" class="dd-hidden-access">
      <IotDeviceAccessDetailTab
        ref="accessDetailRef"
        :device="device"
        :product-template="productTemplate"
        :properties="realtimeProperties"
        :commands="deviceCommands"
        :session-enabled="false"
        :trace-enabled="false"
      />
    </div>

    <section class="dd-tab-shell" :aria-label="$t('IotDeviceDetail.detail.contentAria')">
      <a-tabs
        class="dd-detail-tabs"
        :active-key="activeTab"
        @change="(key) => setActiveTab(String(key))"
      >
        <a-tab-pane v-for="option in tabOptions" :key="option.key">
          <template #tab>
            <span class="dd-detail-tabs__item">
              <AIcon :type="option.icon" aria-hidden="true" />
              {{ option.label }}
              <span v-if="option.count !== undefined" class="dd-detail-tabs__count">{{ option.count }}</span>
            </span>
          </template>
        </a-tab-pane>
      </a-tabs>

      <div class="dd-tab-content">
        <IotDeviceOverviewTab
          v-if="activeTab === 'overview'"
          :device="device"
          :product-template="productTemplate"
          :health-path="healthPath"
          :health-diagnosis="healthDiagnosis"
          :todos="deviceTodos"
          :simulator-session="simulatorSession"
          :access-summary="overviewAccessSummary"
          :properties="overviewRealtimeProperties"
          @jump-tab="setActiveTab"
          @jump-sub-tab="setInnerTab"
        />

        <IotDeviceAccessDetailTab
          v-else-if="activeTab === 'access'"
          ref="accessDetailRef"
          :device="device"
          :product-template="productTemplate"
          :properties="realtimeProperties"
          :commands="deviceCommands"
        />

        <IotDeviceCommandCenterTab
          v-else-if="activeTab === 'commands'"
          :device-id="device.id"
          :properties="realtimeProperties"
          :commands="deviceCommands"
          :logs="device.logs"
          :result="commandExecution"
          :busy="commandBusy"
          @property-value="mergeRealtimePropertyValue"
          @execute="onExecuteDeviceCommand"
        />

        <IotDeviceDataTableTab
          v-else-if="activeTab === 'data'"
          :device-id="device.id"
          :properties="realtimeProperties"
          :events="realtimeEvents"
          @property-value="mergeRealtimePropertyValue"
          @visible-keys-change="setPropertyPageRealtimeKeys"
        />

        <IotDeviceAlarmTab
          v-else-if="activeTab === 'alarm'"
          :device="device"
          :properties="thingModelDefinition.properties"
          :todos="deviceTodos"
          :busy-id="todoBusyId"
          :has-related-rules="Boolean(healthConnectionRules.length || healthDeviationProperties.length)"
          @open-todo="openTodoHandler"
          @open-rules="openRelatedRules"
        />

        <component
          v-else-if="activeExtension"
          :is="activeExtension.component"
          :key="`${device.id}:${activeExtension.key}`"
          :device-id="device.id"
          v-bind="activeExtension.props?.(device)"
        />

        <IotDeviceLogsSearchTableTab
          v-else
          :device="device"
          :logs="device.logs"
        />
      </div>
    </section>
  </template>
</template>

<script setup lang="ts">
import { toRefs, type PropType } from 'vue'
import IotDeviceAccessDetailTab from './device-detail/IotDeviceAccessDetailTab.vue'
import IotDeviceCommandCenterTab from './device-detail/IotDeviceCommandCenterTab.vue'
import IotDeviceDataTableTab from './device-detail/IotDeviceDataTableTab.vue'
import IotDeviceAlarmTab from './device-detail/IotDeviceAlarmTab.vue'
import IotDeviceLogsSearchTableTab from './device-detail/IotDeviceLogsSearchTableTab.vue'
import IotDeviceOverviewTab from './device-detail/IotDeviceOverviewTab.vue'
import type { IotDeviceDetailViewState } from '../hooks/useIotDeviceDetailView'
import { useDeviceDetailAgent } from '../agent/useDeviceDetailAgent'

// 默认内容与自己的助手生命周期一起挂载，替换为业务内容后不重复注册助手。
const props = defineProps({ state: { type: Object as PropType<IotDeviceDetailViewState>, required: true } })
useDeviceDetailAgent()
const {
  $t,
  healthPath,
  device,
  healthDiagnosis,
  deviceCommands,
  commandExecution,
  commandBusy,
  todoBusyId,
  accessDetailRef,
  activeTab,
  setActiveTab,
  setInnerTab,
  productTemplate,
  thingModelDefinition,
  overviewAccessSummary,
  deviceTodos,
  realtimeProperties,
  overviewRealtimeProperties,
  realtimeEvents,
  simulatorSession,
  healthConnectionRules,
  healthDeviationProperties,
  tabOptions,
  openRelatedRules,
  openTodoHandler,
  mergeRealtimePropertyValue,
  onExecuteDeviceCommand,
  setPropertyPageRealtimeKeys,
  activeExtension,
} = toRefs(props.state)
</script>

<style scoped src="../styles/IotDeviceDetailView.css"></style>
