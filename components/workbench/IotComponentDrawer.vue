<template>
  <Teleport to="body">
    <Transition name="component-drawer">
      <div v-if="open" class="component-drawer" role="dialog" aria-modal="true" :aria-label="$t('IotWorkbench.drawer.aria')">
        <div class="component-drawer__panel">
          <header class="component-drawer__head">
            <div>
              <p>{{ mode === 'settings' ? $t('IotWorkbench.drawer.pageSettings') : $t('IotWorkbench.drawer.components') }}</p>
              <h3>{{ title }}</h3>
            </div>
            <a-button class="component-drawer__close" type="text" :aria-label="$t('IotWorkbench.drawer.close')" @click="emit('close')">
                <template #icon>
                    <AIcon :type="'CloseOutlined'" aria-hidden="true" />
                </template>
            </a-button>
          </header>

          <div class="component-drawer__body">
            <template v-if="mode === 'components'">
              <section class="component-drawer__section">
                <div class="component-drawer__section-head">
                  <h4>{{ $t('IotWorkbench.drawer.add') }}</h4>
                  <span>{{ $t('IotWorkbench.drawer.defaultCount', { total: templates.length }) }}</span>
                </div>
                <div class="component-palette">
                  <div
                    v-for="template in templates"
                    :key="template.kind"
                    class="widget-palette-row"
                    @click="emit('add', template.kind)"
                  >
                    <AIcon :type="template.icon" aria-hidden="true" />
                    <span>
                      <strong>{{ template.title }}</strong>
                      <small>{{ template.groupLabel }} · {{ template.desc }}</small>
                    </span>
                    <AIcon :type="'PlusOutlined'" aria-hidden="true" />
                  </div>
                </div>
              </section>

              <section class="component-drawer__section">
                <div class="component-drawer__section-head">
                  <h4>{{ $t('IotWorkbench.drawer.enabled') }}</h4>
                  <span>{{ $t('IotWorkbench.drawer.enabledCount', { total: widgets.length }) }}</span>
                </div>
                <div class="enabled-widget-list">
                  <div
                    v-for="widget in widgets"
                    :key="widget.id"
                    class="enabled-widget-list__button"
                    :class="{ 'is-active': selectedWidgetId === widget.id }"
                    @click="emit('select', widget.id)"
                  >
                    <span>
                      <strong>{{ widget.title }}</strong>
                      <small>{{ widgetTemplate(widget.kind).groupLabel }} · {{ widget.config.timeRange }}</small>
                    </span>
                    <AIcon :type="'SettingOutlined'" aria-hidden="true" />
                  </div>
                </div>
              </section>

              <section v-if="selectedWidget" class="component-drawer__section">
                <div class="component-drawer__section-head">
                  <h4>{{ $t('IotWorkbench.drawer.config') }}</h4>
                  <span>{{ $t('IotWorkbench.drawer.current') }}</span>
                </div>
                <div class="config-form">
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.widgetTitle') }}</span>
                    <a-input :value="selectedWidget.title" @update:value="updateSelectedWidgetTitle" />
                  </label>
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.source') }}</span>
                    <a-select :value="selectedWidget.config.source" :options="widgetSourceOptions" @update:value="updateSelectedWidgetSource" />
                  </label>
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.timeRange') }}</span>
                    <a-select :value="selectedWidget.config.timeRange" :options="widgetTimeRangeOptions" @update:value="updateSelectedWidgetTimeRange" />
                  </label>
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.refresh') }}</span>
                    <a-select :value="selectedWidget.config.refresh" :options="refreshOptions" @update:value="updateSelectedWidgetRefresh" />
                  </label>
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.chartType') }}</span>
                    <a-select :value="selectedWidget.config.chart" :options="widgetChartOptions" @update:value="updateSelectedWidgetChart" />
                  </label>
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.size') }}</span>
                    <a-select :value="selectedWidget.size" :options="widgetSizeOptions" @update:value="updateSelectedWidgetSize" />
                  </label>
                </div>
                <p v-if="feedback" class="component-drawer__feedback">{{ feedback }}</p>
              </section>
            </template>

            <template v-else>
              <section class="component-drawer__section">
                <div class="component-drawer__section-head">
                  <h4>{{ $t('IotWorkbench.drawer.pageSettings') }}</h4>
                  <span>{{ $t('IotWorkbench.drawer.currentPage') }}</span>
                </div>
                <div class="config-form">
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.dashboardName') }}</span>
                    <a-input :value="pageSettings.name" @update:value="updatePageSettingName" />
                  </label>
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.defaultView') }}</span>
                    <a-select v-model:value="activeDashboardView" :options="dashboardViewOptions" />
                  </label>
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.refresh') }}</span>
                    <a-select :value="pageSettings.refresh" :options="refreshOptions" @update:value="updatePageSettingRefresh" />
                  </label>
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.density') }}</span>
                    <a-select :value="pageSettings.density" :options="pageDensityOptions" @update:value="updatePageSettingDensity" />
                  </label>
                  <label>
                    <span>{{ $t('IotWorkbench.drawer.scope') }}</span>
                    <a-select :value="pageSettings.scope" :options="pageScopeOptions" @update:value="updatePageSettingScope" />
                  </label>
                </div>
                <a-button class="component-drawer__save" type="primary" @click="emit('save', pageSettings.scope)">
                  {{ $t('IotWorkbench.drawer.saveSettings') }}
                </a-button>
                <p v-if="feedback" class="component-drawer__feedback">{{ feedback }}</p>
              </section>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DashboardViewKey, DashboardWidget, DashboardWidgetPatch, PageSettings, WidgetKind, WidgetTemplate } from '../useIotDeviceWorkbench'

const props = defineProps<{
  open: boolean
  mode: 'components' | 'settings'
  title: string
  templates: WidgetTemplate[]
  widgets: DashboardWidget[]
  selectedWidgetId: string
  widgetTemplate: (kind: WidgetKind) => WidgetTemplate
  selectedWidget: DashboardWidget | null
  feedback: string
  pageSettings: PageSettings
  activeDashboardView: DashboardViewKey
  dashboardViewOptions: Array<{ value: DashboardViewKey; label: string }>
  widgetSourceOptions: Array<{ value: DashboardWidget['config']['source']; label: string }>
  widgetTimeRangeOptions: Array<{ value: string; label: string }>
  refreshOptions: Array<{ value: string; label: string }>
  widgetChartOptions: Array<{ value: DashboardWidget['config']['chart']; label: string }>
  widgetSizeOptions: Array<{ value: DashboardWidget['size']; label: string }>
  pageDensityOptions: Array<{ value: string; label: string }>
  pageScopeOptions: Array<{ value: 'personal' | 'team'; label: string }>
}>()

const emit = defineEmits<{
  close: []
  add: [kind: WidgetKind]
  select: [widgetId: string]
  'update-widget': [widgetId: string, patch: DashboardWidgetPatch]
  'update-page-settings': [patch: Partial<PageSettings>]
  save: [scope: 'personal' | 'team']
  'update:activeDashboardView': [value: DashboardViewKey]
}>()

const activeDashboardView = computed({
  get: () => props.activeDashboardView,
  set: value => emit('update:activeDashboardView', value),
})

function updateSelectedWidget(patch: DashboardWidgetPatch) {
  if (!props.selectedWidget) return
  emit('update-widget', props.selectedWidget.id, patch)
}

function updateSelectedWidgetTitle(value: string) {
  updateSelectedWidget({ title: value })
}

function updateSelectedWidgetSource(value: unknown) {
  const source = String(value) as DashboardWidget['config']['source']
  updateSelectedWidget({ config: { source } })
}

function updateSelectedWidgetTimeRange(value: unknown) {
  updateSelectedWidget({ config: { timeRange: String(value) } })
}

function updateSelectedWidgetRefresh(value: unknown) {
  updateSelectedWidget({ config: { refresh: String(value) } })
}

function updateSelectedWidgetChart(value: unknown) {
  const chart = String(value) as DashboardWidget['config']['chart']
  updateSelectedWidget({ config: { chart } })
}

function updateSelectedWidgetSize(value: unknown) {
  updateSelectedWidget({ size: String(value) as DashboardWidget['size'] })
}

function updatePageSettingName(value: string) {
  emit('update-page-settings', { name: value })
}

function updatePageSettingRefresh(value: unknown) {
  emit('update-page-settings', { refresh: String(value) })
}

function updatePageSettingDensity(value: unknown) {
  emit('update-page-settings', { density: String(value) })
}

function updatePageSettingScope(value: unknown) {
  emit('update-page-settings', { scope: String(value) as PageSettings['scope'] })
}

const { t: $t } = useI18n()
</script>
