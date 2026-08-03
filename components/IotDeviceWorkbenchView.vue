<template>
  <div class="iot-dashboard" :class="{ 'iot-dashboard--fullscreen': fullscreen, 'is-editing': editMode }">
    <section class="dashboard-overview" :aria-label="$t('IotWorkbench.overview.aria')">
      <IotDeviceStatPanel
        :items="deviceStatCards"
        :format-value="formatStatValue"
      />

      <IotOnlineRatePanel
        :trend-window-label="onlineRateTrendWindowLabel"
        :online-rate-trend-range="onlineRateTrendRange"
        :trend-range-options="trendRangeOptions"
        :online-rate-trend-values="onlineRateTrendValues"
        :online-rate-trend-points="onlineRateTrendPoints"
        @update-trend-range="updateOnlineRateTrendRange"
      />

      <IotActivityPanel
        :activity-metrics="activityMetrics"
        :trend-window-label="messageTrendWindowLabel"
        :message-trend-range="messageTrendRange"
        :trend-range-options="trendRangeOptions"
        :active-trend-values="activeTrendValues"
        :active-trend-points="activeTrendPoints"
        @update-trend-range="updateMessageTrendRange"
      />
    </section>

    <IotDashboardTabs
      v-model="activeDashboardView"
      :views="dashboardViews"
      :active-desc="activeDashboardViewMeta.desc"
    />

    <IotDashboardWorkspace
      :widgets="activeDashboardWidgets"
      :selected-widget-id="selectedWidgetId"
      :widget-template="widgetTemplate"
      :trend-icon="trendIcon"
      :activity-metrics="activityMetrics"
      :trend-window-label="onlineRateTrendWindowLabel"
      :active-device-count="activeDeviceCount"
      :online-rate-trend-range="onlineRateTrendRange"
      :alarm-trend-range="alarmTrendRange"
      :alarm-rank-range="alarmRankRange"
      :trend-range-options="trendRangeOptions"
      :online-rate-trend-values="onlineRateTrendValues"
      :online-rate-trend-points="onlineRateTrendPoints"
      :alarm-record-trend-values="alarmRecordTrendValues"
      :alarm-record-trend-points="alarmRecordTrendPoints"
      :status-distribution="statusDistribution"
      :alert-top-devices="alertTopDevices"
      :alert-type-rows="alertTypeRows"
      :area-rows="areaRows"
      :connection-metrics="connectionMetrics"
      :realtime-messages="realtimeMessages"
      :alarm-rank-page-index="alarmRankPageIndex"
      :alarm-rank-page-total="alarmRankPageTotal"
      :latest-alarm-page-index="latestAlarmPageIndex"
      :latest-alarm-page-total="latestAlarmPageTotal"
      @select="selectWidget"
      @remove="removeWidget"
      @apply="applyMetricTarget"
      @update-trend-range="updateOnlineRateTrendRange"
      @update-alarm-trend-range="updateAlarmTrendRange"
      @update-alarm-rank-range="updateAlarmRankRange"
      @change-alarm-rank-page="changeAlarmRankPage"
      @change-latest-alarm-page="changeLatestAlarmPage"
      @open-device-alarm="goDeviceAlarmRecord"
      @focus-area="focusArea"
    />

    <IotComponentDrawer
      :open="componentPanelOpen"
      :mode="componentPanelMode"
      :title="componentPanelTitle"
      :templates="availableWidgetTemplates"
      :widgets="activeWidgets"
      :selected-widget-id="selectedWidgetId"
      :widget-template="widgetTemplate"
      :selected-widget="selectedWidget"
      :feedback="layoutFeedback"
      :page-settings="pageSettings"
      :active-dashboard-view="activeDashboardView"
      :dashboard-view-options="dashboardViewOptions"
      :widget-source-options="widgetSourceOptions"
      :widget-time-range-options="widgetTimeRangeOptions"
      :refresh-options="refreshOptions"
      :widget-chart-options="widgetChartOptions"
      :widget-size-options="widgetSizeOptions"
      :page-density-options="pageDensityOptions"
      :page-scope-options="pageScopeOptions"
      @close="componentPanelOpen = false"
      @add="addWidget"
      @select="selectedWidgetId = $event"
      @update-widget="updateWidget"
      @update-page-settings="updatePageSettings"
      @save="saveLayout"
      @update:active-dashboard-view="activeDashboardView = $event"
    />

    <IotFloatTools
      v-if="showFloatTools"
      v-model:open="floatToolsOpen"
      v-model:menu-open="floatMenuOpen"
      @open-components="openComponentPanel()"
      @open-settings="openPageSettings"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IotActivityPanel from './workbench/IotActivityPanel.vue'
import IotComponentDrawer from './workbench/IotComponentDrawer.vue'
import IotDashboardTabs from './workbench/IotDashboardTabs.vue'
import IotDashboardWorkspace from './workbench/IotDashboardWorkspace.vue'
import IotDeviceStatPanel from './workbench/IotDeviceStatPanel.vue'
import IotFloatTools from './workbench/IotFloatTools.vue'
import IotOnlineRatePanel from './workbench/IotOnlineRatePanel.vue'
import { useIotDeviceWorkbench } from './useIotDeviceWorkbench'
import './IotDeviceWorkbenchView.css'

const { t: $t } = useI18n()
const showFloatTools = false

const {
  editMode,
  fullscreen,
  selectedWidgetId,
  componentPanelOpen,
  componentPanelMode,
  activeDashboardView,
  layoutFeedback,
  floatToolsOpen,
  floatMenuOpen,
  deviceStatCards,
  formatStatValue,
  trendIcon,
  applyMetricTarget,
  dashboardViews,
  activeDashboardViewMeta,
  activeDashboardWidgets,
  selectedWidget,
  componentPanelTitle,
  availableWidgetTemplates,
  activeWidgets,
  widgetTemplate,
  addWidget,
  removeWidget,
  updateWidget,
  selectWidget,
  openComponentPanel,
  openPageSettings,
  saveLayout,
  updatePageSettings,
  pageSettings,
  dashboardViewOptions,
  widgetSourceOptions,
  widgetTimeRangeOptions,
  refreshOptions,
  widgetChartOptions,
  widgetSizeOptions,
  pageDensityOptions,
  pageScopeOptions,
  activityMetrics,
  messageTrendWindowLabel,
  onlineRateTrendWindowLabel,
  activeDeviceCount,
  messageTrendRange,
  onlineRateTrendRange,
  alarmTrendRange,
  alarmRankRange,
  trendRangeOptions,
  activeTrendValues,
  activeTrendPoints,
  onlineRateTrendValues,
  onlineRateTrendPoints,
  alarmRecordTrendValues,
  alarmRecordTrendPoints,
  statusDistribution,
  alertTopDevices,
  alertTypeRows,
  areaRows,
  realtimeMessages,
  connectionMetrics,
  alarmRankPageIndex,
  alarmRankPageTotal,
  latestAlarmPageIndex,
  latestAlarmPageTotal,
  updateMessageTrendRange,
  updateOnlineRateTrendRange,
  updateAlarmTrendRange,
  updateAlarmRankRange,
  changeAlarmRankPage,
  changeLatestAlarmPage,
  goDeviceAlarmRecord,
  focusArea,
} = useIotDeviceWorkbench()
</script>
