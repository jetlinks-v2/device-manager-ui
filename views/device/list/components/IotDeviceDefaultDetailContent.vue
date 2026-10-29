<template>
  <template v-if="device">
    <div v-if="!embedded && activeTab !== 'access'" class="dd-hidden-access">
      <IotDeviceAccessDetailTab
        ref="accessDetailRef"
        :device="device"
        :product-template="productTemplate"
        :properties="realtimeProperties"
        :commands="deviceCommands"
        :session-enabled="false"
        :trace-enabled="false"
        @config-saved="onDetailContentChanged"
      />
    </div>

    <section class="dd-tab-shell" :aria-label="$t('IotDeviceDetail.detail.contentAria')">

      <div class="dd-tab-content">
        <IotDeviceOverviewTab
          v-if="activeTab === 'overview'"
          :device="device"
          :properties="overviewRealtimeProperties"
        />

        <IotDeviceAccessDetailTab
          v-else-if="activeTab === 'access'"
          ref="accessDetailRef"
          :device="device"
          :product-template="productTemplate"
          :properties="realtimeProperties"
          :commands="deviceCommands"
          @config-saved="onDetailContentChanged"
        />

        <LegacyMetadata
          v-else-if="activeTab === 'thing-model'"
          :key="`${device.id}:${device.independentMetadata ? 'independent' : 'inherited'}`"
          type="device"
          :update-permission="deviceUpdatePermission"
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

        <IotDeviceAlarmConfigTab
          v-else-if="activeTab === 'property-rules'"
          :device="device"
          :properties="device.thingModelMetadata?.properties ?? []"
          :can-update="deviceUpdatePermission"
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

        <IotDeviceInvalidDataTab
          v-else-if="activeTab === 'invalid'"
          :device="device"
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
import IotDeviceAlarmConfigTab from './device-detail/IotDeviceAlarmConfigTab.vue'
import IotDeviceAlarmTab from './device-detail/IotDeviceAlarmTab.vue'
import IotDeviceInvalidDataTab from './device-detail/IotDeviceInvalidDataTab.vue'
import IotDeviceLogsSearchTableTab from './device-detail/IotDeviceLogsSearchTableTab.vue'
import IotDeviceOverviewTab from './device-detail/IotDeviceOverviewTab.vue'
import LegacyMetadata from '@device-manager-ui/views/device/components/Metadata/index.vue'
import type { IotDeviceDetailViewState } from '../hooks/useIotDeviceDetailView'

const props = defineProps({ state: { type: Object as PropType<IotDeviceDetailViewState>, required: true }, embedded: Boolean })
const {
  $t,
  device,
  deviceCommands,
  commandExecution,
  commandBusy,
  deviceUpdatePermission,
  todoBusyId,
  accessDetailRef,
  activeTab,
  setActiveTab,
  productTemplate,
  thingModelDefinition,
  deviceTodos,
  realtimeProperties,
  overviewRealtimeProperties,
  realtimeEvents,
  healthConnectionRules,
  healthDeviationProperties,
  openRelatedRules,
  openTodoHandler,
  mergeRealtimePropertyValue,
  onExecuteDeviceCommand,
  setPropertyPageRealtimeKeys,
  activeExtension,
  onDetailContentChanged,
} = toRefs(props.state)
</script>

<style scoped src="../styles/IotDeviceDetailView.css"></style>
