<template>
  <IotTodoHandlerDrawer
    v-model:open="todoHandlerOpen"
    :todo="handlingTodo"
    :project-id="projectId"
    :all-devices="workbench?.devices ?? []"
    :busy="todoBusyId === handlingTodo?.id"
    @complete="onCompleteTodo"
    @snooze="onSnoozeTodo"
  />

  <IotAddDeviceDrawer
    v-model:open="editDrawerOpen"
    :project-id="projectId"
    :device="device"
    @saved="onDeviceSaved"
  />

  <IotDeviceTagEditorModal
    v-model:open="tagEditorOpen"
    :tags="thingModelTags"
    :saving="savingTags"
    @save="saveTags"
  />

  <JlDrawerShell
    :open="ruleInfoOpen"
    :width="440"
    icon="BranchesOutlined"
    :title="ruleInfoTitle"
    :sub="ruleInfoSub"
    @update:open="(value) => { ruleInfoOpen = value; if (!value) activeRuleTodo = null }"
  >
    <div class="dd-rule-panel">
      <p v-if="activeRuleTodo" class="dd-rule-panel__summary">
        {{ activeRuleTodo.detail }}
      </p>
      <ul v-if="activeRuleRows.length" class="dd-rules">
        <li v-for="rule in activeRuleRows" :key="rule.id">
          <div>
            <strong>{{ rule.name }}</strong>
            <small>{{ rule.trigger }}</small>
          </div>
          <p>{{ rule.action }}</p>
          <IotDeviceStatusPill :label="rule.status" :risk="rule.status === '建议调整' ? 'watch' : 'normal'" />
        </li>
      </ul>
      <CloudEmpty v-else class="dd-empty" :description="$t('IotDeviceDetail.detail.emptyRelatedRule')" />
    </div>
    <template #foot>
      <a-button @click="ruleInfoOpen = false; activeRuleTodo = null">{{ $t('IotDeviceDetail.common.close') }}</a-button>
    </template>
  </JlDrawerShell>

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

    <section
      class="dd-hero"
      :class="{ 'is-tags-expanded': tagsExpanded }"
      :style="{ '--dd-tags-expanded-shift': `${-tagsExpandedOffset / 2}px` }"
    >
      <a-button class="dd-hero__back" type="text" @click="backToDeviceList">
        <template #icon><AIcon type="LeftOutlined" /></template>
        {{ $t('IotDeviceDetail.common.back') }}
      </a-button>
      <div class="dd-hero__icon" :data-category="categoryKey ?? 'sensor'">
        <IconValueView v-if="device.imageUrl" :value="device.imageUrl" :fallback-text="device.name" :size="52" />
        <AIcon v-else :type="categoryIcon" aria-hidden="true" />
      </div>
      <div class="dd-hero__main">
        <div class="dd-hero__headline">
          <a-tooltip :title="deviceNameText">
            <h1>{{ deviceNameText }}</h1>
          </a-tooltip>
          <IotDeviceStatusPill :status="device.status" />
        </div>
        <div class="dd-hero__summary">
          <div class="dd-summary-line">
            <div class="dd-summary-row dd-summary-row--id">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.deviceId') }}</span>
              <a-tooltip :title="deviceSnText">
                <span class="dd-summary-value">{{ deviceSnText }}</span>
              </a-tooltip>
            </div>
            <div class="dd-summary-row">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.product') }}</span>
              <a-tooltip :title="productNameText">
                <span class="dd-summary-value">{{ productNameText }}</span>
              </a-tooltip>
            </div>
            <div class="dd-summary-row">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.deviceType') }}</span>
              <a-tooltip :title="deviceTypeAccessText">
                <span class="dd-summary-value">{{ deviceTypeAccessText }}</span>
              </a-tooltip>
            </div>
          </div>
          <div class="dd-summary-line">
            <div class="dd-summary-row">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.area') }}</span>
              <a-tooltip :title="regionFullText">
                <span class="dd-summary-value">{{ regionText }}</span>
              </a-tooltip>
            </div>
            <div class="dd-summary-row">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.businessGroup') }}</span>
              <a-tooltip :title="businessGroupFullText">
                <span class="dd-summary-value">{{ businessGroupText }}</span>
              </a-tooltip>
            </div>
            <div class="dd-summary-row">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.lastReport') }}</span>
              <a-tooltip :title="lastSeenText">
                <span class="dd-summary-value">{{ lastSeenText }}</span>
              </a-tooltip>
            </div>
          </div>
          <div v-if="thingModelTags.length" class="dd-summary-line">
            <div class="dd-summary-row dd-summary-row--tags">
              <div class="dd-tags-title">
                <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.tags') }}</span>
                <a-tooltip :title="$t('IotDeviceDetail.detail.editThingModelTags')">
                  <a-button
                    type="text"
                    size="small"
                    class="dd-tags-edit-action"
                    :aria-label="$t('IotDeviceDetail.detail.editThingModelTags')"
                    @click="tagEditorOpen = true"
                  >
                    <template #icon><AIcon type="EditOutlined" /></template>
                  </a-button>
                </a-tooltip>
              </div>
              <div
                ref="tagsListRef"
                class="dd-tags-list"
                :class="{ 'is-expanded': tagsExpanded }"
              >
                <a-tooltip v-for="tag in thingModelTags" :key="getTagKey(tag)" :title="formatTagTooltipValueOnly(tag)">
                  <span class="dd-tag-text">{{ formatTagLine(tag) }}</span>
                </a-tooltip>
              </div>
              <a-button
                v-if="tagsOverflow"
                type="text"
                size="small"
                class="dd-tags-action"
                @click="toggleTagsExpanded"
              >
                {{ tagsExpanded ? $t('IotDeviceDetail.detail.collapseTags') : $t('IotDeviceDetail.detail.expandTags') }}
              </a-button>
            </div>
          </div>
        </div>
      </div>
      <div class="dd-hero__actions">
        <a-button size="small" :disabled="Boolean(actionBusyId)" @click="openEditDrawer">
          <template #icon><AIcon type="EditOutlined" /></template>
          {{ $t('IotDeviceDetail.detail.edit') }}
        </a-button>
        <a-popconfirm
          :title="isDeviceDisabled
            ? $t('IotDeviceList.confirm.enableOne', { name: device.name })
            : $t('IotDeviceList.confirm.disableOne', { name: device.name })"
          :ok-button-props="{ loading: actionBusyId === device.id && actionKind === 'toggle' }"
          @confirm="toggleDeviceEnabled"
        >
          <a-button
            size="small"
            :loading="actionBusyId === device.id && actionKind === 'toggle'"
            :disabled="Boolean(actionBusyId && actionKind !== 'toggle')"
          >
            <template #icon><AIcon :type="isDeviceDisabled ? 'CheckSquareOutlined' : 'StopOutlined'" /></template>
            {{ isDeviceDisabled ? $t('IotDeviceDetail.detail.enable') : $t('IotDeviceDetail.detail.disable') }}
          </a-button>
        </a-popconfirm>
        <a-popconfirm
          :title="$t('IotDeviceList.confirm.deleteOne', { name: device.name })"
          :disabled="deleteActionDisabled"
          :ok-button-props="{ loading: actionBusyId === device.id && actionKind === 'delete' }"
          @confirm="confirmDeleteDevice"
        >
          <a-button
            size="small"
            danger
            :loading="actionBusyId === device.id && actionKind === 'delete'"
            :disabled="deleteActionDisabled"
          >
            <template #icon><AIcon type="DeleteOutlined" /></template>
            {{ $t('IotDeviceDetail.detail.delete') }}
          </a-button>
        </a-popconfirm>
      </div>
    </section>

    <section class="dd-tab-shell" :aria-label="$t('IotDeviceDetail.detail.contentAria')">
      <a-tabs
        class="dd-detail-tabs"
        :active-key="activeTab"
        @change="(key) => setActiveTab(key as DeviceDetailTab)"
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { onlyMessage } from '@jetlinks-web/utils'
import { IconValueView } from '@jetlinks-web-core/components/IconValue'
import {
  deleteDevice_api,
  deployDevice_api,
  undeployDevice_api,
} from '@device-manager-ui/api/device'
import { DEVICE_CATEGORY_META } from '../hooks/useDeviceLibraryMeta'
import { useDeviceLibrary } from '../hooks/useDeviceLibrary'
import { useIotDataAccessRefresh } from '../hooks/useIotDataAccessRefresh'
import { buildIotDeviceHealthPath, buildIotDeviceListPath, resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import { getIotDeviceConnectionStatus } from '../hooks/useIotDeviceStatus'
import type { DeviceCategory, DeviceTemplate } from '../services/device-library/types'
import { iotDeviceService } from '../services/iotDevice.service'
import {
  extractRows,
  formatApiTime,
  iotDeviceDetailRealApi,
  subscribeDeviceProperties,
  subscribeDeviceStatus,
  type DevicePropertyValue,
} from '../services/iotDeviceDetailReal.service'
import type {
  IotDevice,
  IotDeviceCommandDefinition,
  IotDeviceCommandExecution,
  IotDeviceHealthDiagnosis,
  IotDeviceTodo,
  IotDeviceWorkbench,
  IotTelemetryPoint,
} from '../types'
import type {
  IotDeviceLibraryConnectionHealthRule,
  IotDeviceLibraryThingModelProperty,
} from '../deviceLibrary.types'
import JlDrawerShell from './common/JlDrawerShell.vue'
import IotAddDeviceDrawer from './IotAddDeviceDrawer.vue'
import IotDeviceTagEditorModal from './IotDeviceTagEditorModal.vue'
import IotDeviceStatusPill from './IotDeviceStatusPill.vue'
import IotTodoHandlerDrawer from './IotTodoHandlerDrawer.vue'
import IotDeviceAccessDetailTab from './device-detail/IotDeviceAccessDetailTab.vue'
import IotDeviceCommandCenterTab from './device-detail/IotDeviceCommandCenterTab.vue'
import IotDeviceDataTableTab from './device-detail/IotDeviceDataTableTab.vue'
import IotDeviceAlarmTab from './device-detail/IotDeviceAlarmTab.vue'
import IotDeviceLogsSearchTableTab from './device-detail/IotDeviceLogsSearchTableTab.vue'
import IotDeviceOverviewTab from './device-detail/IotDeviceOverviewTab.vue'
import type {
  RealtimeAccessMode,
  RealtimeEventLevel,
  RealtimeEventRow,
  RealtimePropertyRow,
  RealtimeServiceRow,
  SimulatorActionMode,
  SimulatorDirection,
  SimulatorLog,
  SimulatorPreset,
  SimulatorSession,
  SimulatorStatus,
  SimulatorTrace,
  SimulatorTraceStep,
} from './device-detail/iotDeviceDetail.types'
import {
  buildThingModelDefinitionFromMetadata,
  buildTemplateHealthConfigFromTemplate,
  buildThingModelDefinitionFromTemplate,
} from '@device-manager-ui/views/device/shared/standard-model/standardModelMappers'

type DeviceDetailTab = 'overview' | 'access' | 'commands' | 'data' | 'alarm' | 'logs'
type DataInnerTab = 'property' | 'event' | 'function' | 'trace'
type RecordsInnerTab = 'alarm' | 'log' | 'threshold'
type AdvancedInnerTab = 'connection' | 'thing-model' | 'parsing' | 'children' | 'health' | 'threshold'
type ThingModelKind = 'properties' | 'events' | 'functions' | 'tags'

const route = useRoute()
const router = useRouter()
const { t: $t } = useI18n()

const projectId = computed(() => resolveIotProjectId(route))
const deviceId = computed(() => String(route.params.deviceId ?? route.params.id))
const healthPath = computed(() => buildIotDeviceHealthPath(projectId.value, deviceId.value, undefined, route))

const device = ref<IotDevice | null>(null)
const hasTransparentCodec = computed(() =>
  Boolean(device.value?.features?.some((item: any) => item?.id === 'transparentCodec')),
)
const workbench = ref<IotDeviceWorkbench | null>(null)
const healthDiagnosis = ref<IotDeviceHealthDiagnosis | null>(null)
const deviceCommands = ref<IotDeviceCommandDefinition[]>([])
const commandExecution = ref<IotDeviceCommandExecution | null>(null)
const commandBusy = ref(false)
const deviceLibrary = useDeviceLibrary()

const todoHandlerOpen = ref(false)
const handlingTodo = ref<IotDeviceTodo | null>(null)
const todoBusyId = ref('')
const ruleInfoOpen = ref(false)
const activeRuleTodo = ref<IotDeviceTodo | null>(null)
const savingTags = ref(false)
const tagEditorOpen = ref(false)
const tagsListRef = ref<HTMLElement | null>(null)
const tagsExpanded = ref(false)
const tagsOverflow = ref(false)
const tagsExpandedOffset = ref(0)
const editDrawerOpen = ref(false)
const actionBusyId = ref('')
const actionKind = ref<'toggle' | 'delete' | ''>('')
const actionError = ref('')

const realtimeKeyword = ref('')
const realtimeAccessFilter = ref<'all' | RealtimeAccessMode>('all')
const realtimePropertyValues = ref<Record<string, DevicePropertyValue>>({})
const realtimeStatusSubscription = ref<any>()
const realtimePropertySubscription = ref<any>()
const realtimeStatusSubscriptionKey = ref('')
const realtimePropertySubscriptionKey = ref('')
const liveSimulatorTraces = ref<SimulatorTrace[]>([])
const childDeviceCount = ref(0)
const OVERVIEW_PROPERTY_LIMIT = 5
const propertyPageRealtimeKeys = ref<string[]>([])

const DATA_TAB_KEYS: DataInnerTab[] = ['property', 'event', 'function', 'trace']
const RECORDS_TAB_KEYS: RecordsInnerTab[] = ['alarm', 'log', 'threshold']
const ADVANCED_TAB_KEYS: AdvancedInnerTab[] = ['connection', 'thing-model', 'parsing', 'children', 'health', 'threshold']
const THING_MODEL_KIND_KEYS: ThingModelKind[] = ['properties', 'events', 'functions', 'tags']

function normalizeDataInnerTab(value: unknown): DataInnerTab {
  return typeof value === 'string' && DATA_TAB_KEYS.includes(value as DataInnerTab) ? value as DataInnerTab : 'property'
}

function normalizeRecordsInnerTab(value: unknown): RecordsInnerTab {
  return typeof value === 'string' && RECORDS_TAB_KEYS.includes(value as RecordsInnerTab) ? value as RecordsInnerTab : 'alarm'
}

function normalizeAdvancedInnerTab(value: unknown): AdvancedInnerTab {
  if (value === 'function') return 'connection'
  if (value === 'deviation') return 'health'
  return typeof value === 'string' && ADVANCED_TAB_KEYS.includes(value as AdvancedInnerTab) ? value as AdvancedInnerTab : 'connection'
}

function normalizeThingModelKind(value: unknown): ThingModelKind {
  return typeof value === 'string' && THING_MODEL_KIND_KEYS.includes(value as ThingModelKind)
    ? value as ThingModelKind
    : 'properties'
}

const dataInnerTab = computed<DataInnerTab>(() => {
  if (activeTab.value !== 'data') return 'property'
  if (route.query.tab === 'commands' || route.query.tab === 'function') return 'function'
  return normalizeDataInnerTab(route.query.sub)
})
const recordsInnerTab = computed<RecordsInnerTab>(() => route.query.tab === 'records' ? normalizeRecordsInnerTab(route.query.sub) : 'alarm')
const advancedInnerTab = computed<AdvancedInnerTab>(() => {
  if (route.query.tab !== 'advanced' && activeTab.value !== 'access') return 'connection'
  const tab = normalizeAdvancedInnerTab(route.query.sub)
  if (tab === 'parsing' && !hasTransparentCodec.value) return 'connection'
  if (tab === 'children' && !isGatewayDevice.value) return 'connection'
  return tab
})

const thingModelKind = computed<ThingModelKind>(() => normalizeThingModelKind(route.query.thingModelKind))

const simulatorPaused = ref(false)
const simulatorActiveMode = ref<SimulatorActionMode>('property-report')
const simulatorTarget = ref('')
const simulatorPayload = ref('')
const simulatorDrawerOpen = ref(false)
const simulatorSelectedTraceId = ref('')
const accessDetailRef = ref<{
  refresh?: () => Promise<void>
  accessDetail?: { configuration?: Record<string, unknown> }
  addressRows?: Array<{ address: string; health?: number }>
  configGroups?: Array<{ name: string; properties: AccessConfigProperty[] }>
  principalRows?: Array<{ fields: Array<{ label: string; value: string; copyValue?: string }> }>
  connectionRows?: Array<{ label: string; value: string }>
} | null>(null)

type AccessConfigProperty = {
  property: string
  name: string
  type?: {
    type?: string
    elements?: Array<{ text: string; value: unknown }>
    trueText?: string
    trueValue?: unknown
    falseText?: string
    falseValue?: unknown
  }
  value?: string
}

const DEFAULT_DETAIL_TAB: DeviceDetailTab = 'overview'
const DEVICE_DETAIL_TAB_KEYS: DeviceDetailTab[] = ['overview', 'access', 'commands', 'data', 'alarm', 'logs']

function normalizeDetailTab(value: unknown): DeviceDetailTab {
  if (typeof value !== 'string') return DEFAULT_DETAIL_TAB
  if (DEVICE_DETAIL_TAB_KEYS.includes(value as DeviceDetailTab)) return value as DeviceDetailTab
  const legacyMap: Record<string, DeviceDetailTab> = {
    realtime: 'data',
    alarms: 'alarm',
    records: 'logs',
    logs: 'logs',
    commands: 'commands',
    function: 'commands',
    advanced: 'access',
    identity: 'access',
    links: 'access',
    health: 'access',
    children: 'access',
    simulator: 'commands',
  }
  return legacyMap[value] ?? DEFAULT_DETAIL_TAB
}

const activeTab = computed<DeviceDetailTab>(() => normalizeDetailTab(route.query.tab))

function setActiveTab(tab: DeviceDetailTab) {
  const nextQuery: Record<string, string> = {
    ...route.query,
    tab,
  } as Record<string, string>

  if (tab === 'access') {
    nextQuery.sub = 'connection'
  } else if (tab === 'commands') {
    delete nextQuery.sub
  } else if (tab === 'data') {
    delete nextQuery.sub
  } else if (tab === 'alarm') {
    delete nextQuery.sub
  } else if (tab === 'logs') {
    delete nextQuery.sub
  } else {
    delete nextQuery.sub
  }

  router.replace({
    query: nextQuery,
  })
}

function setInnerTab(tab: 'data', sub: DataInnerTab): void
function setInnerTab(tab: 'records', sub: RecordsInnerTab): void
function setInnerTab(tab: 'advanced', sub: AdvancedInnerTab): void
function setInnerTab(tab: 'data' | 'records' | 'advanced', sub: string) {
  const tabMap: Record<string, DeviceDetailTab> = {
    data: sub === 'function' ? 'commands' : 'data',
    records: 'logs',
    advanced: 'access',
  }
  router.replace({
    query: {
      ...route.query,
      tab: tabMap[tab],
      ...(tabMap[tab] === 'access' ? { sub: 'connection' } : {}),
    },
  })
}

function openThingModelTab() {
  const kindMap: Record<Extract<DataInnerTab, 'property' | 'event' | 'function'>, ThingModelKind> = {
    property: 'properties',
    event: 'events',
    function: 'functions',
  }
  router.replace({
    query: {
      ...route.query,
      tab: 'advanced',
      sub: 'thing-model',
      thingModelKind: kindMap[dataInnerTab.value as Extract<DataInnerTab, 'property' | 'event' | 'function'>] || 'properties',
    },
  })
}

function openEditDrawer() {
  actionError.value = ''
  editDrawerOpen.value = true
}

function backToDeviceList() {
  void router.push(buildIotDeviceListPath(projectId.value, route))
}

async function onDeviceSaved() {
  editDrawerOpen.value = false
  await loadAll()
}

async function toggleDeviceEnabled() {
  const current = device.value
  if (!current?.id) return
  actionError.value = ''
  actionBusyId.value = current.id
  actionKind.value = 'toggle'
  try {
    if (isDeviceDisabled.value) {
      await deployDevice_api(current.id)
      onlyMessage($t('IotDeviceDetail.detail.enabledMessage', { name: current.name }))
    } else {
      await undeployDevice_api(current.id)
      onlyMessage($t('IotDeviceDetail.detail.disabledMessage', { name: current.name }))
    }
    await loadAll()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : $t('IotDeviceDetail.detail.updateStatusFailed')
    onlyMessage(actionError.value, 'error')
  } finally {
    actionBusyId.value = ''
    actionKind.value = ''
  }
}

async function confirmDeleteDevice() {
  const current = device.value
  if (!current?.id) return
  actionError.value = ''
  if (!isDeviceDisabled.value) {
    actionError.value = $t('IotDeviceDetail.detail.disableBeforeDelete')
    return
  }
  actionBusyId.value = current.id
  actionKind.value = 'delete'
  try {
    await deleteDevice_api(current.id)
    onlyMessage($t('IotDeviceDetail.detail.deletedMessage', { name: current.name }))
    await router.push(buildIotDeviceListPath(projectId.value, route))
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : $t('IotDeviceDetail.detail.deleteFailed')
    onlyMessage(actionError.value, 'error')
  } finally {
    actionBusyId.value = ''
    actionKind.value = ''
  }
}

function displayText(value?: string | null) {
  return value && String(value).trim() ? String(value) : '--'
}

function displayRealText(value?: string | null, placeholders: string[] = []) {
  const text = displayText(value)
  return text !== '--' && !placeholders.includes(text) ? text : '--'
}

function uniqueDisplayTexts(values: Array<string | undefined | null>) {
  return [...new Set(values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value && !['--', '未分组', '未设置位置'].includes(value)))]
}

function limitedDisplayText(values: string[]) {
  if (!values.length) return '--'
  const visible = values.slice(0, 2).join($t('IotDeviceList.presentation.separator'))
  return values.length > 2 ? $t('IotDeviceDetail.detail.moreItems', { value: visible, count: values.length }) : visible
}

const deviceNameText = computed(() => displayText(device.value?.name))
const deviceSnText = computed(() => displayText(device.value?.identifier || device.value?.id))
const productNameText = computed(() => displayText(productTemplate.value?.name || device.value?.productName))
const accessModeText = computed(() => displayText(device.value?.accessName || device.value?.accessMode))
const deviceTypeText = computed(() => {
  const value = device.value?.deviceTypeValue || device.value?.deviceType
  if (value === 'gateway') return $t('IotDeviceList.deviceType.gateway')
  if (value === 'childrenDevice') return $t('IotDeviceList.deviceType.childrenDevice')
  if (value === 'device') return $t('IotDeviceList.deviceType.device')
  return displayText(device.value?.deviceType)
})
const deviceTypeAccessText = computed(() => `${deviceTypeText.value} / ${accessModeText.value}`)
const regionItems = computed(() => uniqueDisplayTexts([
  ...(device.value?.areaBindings ?? []).map((item) => item.area),
  device.value?.area,
]))
const regionText = computed(() => limitedDisplayText(regionItems.value))
const regionFullText = computed(() => displayText(regionItems.value.join($t('IotDeviceList.presentation.separator'))))
const deviceAddressText = computed(() => displayRealText((device.value as any)?.address || device.value?.location, ['未设置位置']))
const businessGroupItems = computed(() => uniqueDisplayTexts([
  ...(device.value?.groupBindings ?? []).map((item) => item.name),
  device.value?.groupName,
]))
const businessGroupText = computed(() => limitedDisplayText(businessGroupItems.value))
const businessGroupFullText = computed(() => displayText(businessGroupItems.value.join($t('IotDeviceList.presentation.separator'))))
const lastSeenText = computed(() => displayText(device.value?.lastSeen))
const isDeviceDisabled = computed(() => device.value ? getIotDeviceConnectionStatus(device.value) === 'disabled' : false)
// 启用状态或其他操作执行中时，删除入口和确认弹层必须同时禁用。
const deleteActionDisabled = computed(() => Boolean(actionBusyId.value && actionKind.value !== 'delete') || !isDeviceDisabled.value)

const productTemplate = computed(() => {
  if (!device.value?.productKey) return null
  return (deviceLibrary.devices.value.find((item) =>
    item.id === device.value?.productKey || item.type=== device.value?.productName,
  ) ?? null) as DeviceTemplate | null
})

const isGatewayDevice = computed(() => device.value?.deviceTypeValue === 'gateway')

const thingModelTags = computed<Record<string, any>[]>(() => {
  const definitions = device.value?.thingModelMetadata?.tags || []
  const values = device.value?.thingModelTags || []
  if (!definitions.length) return values

  const valuesByKey = new Map(values.map((tag: any) => [getTagKey(tag), tag]))
  // 产品物模型定义决定哪些标签应展示；设备标签仅覆盖当前实例已填写的值。
  return definitions.map((definition: any) => ({
    ...definition,
    ...valuesByKey.get(getTagKey(definition)),
    value: valuesByKey.get(getTagKey(definition))?.value ?? definition.value,
    formatValue: valuesByKey.get(getTagKey(definition))?.formatValue ?? definition.formatValue,
  }))
})

function getTagKey(item: Record<string, any>) {
  return String(item.key || item.id || item.name || '')
}

function getTagLabel(item: Record<string, any>) {
  return String(item.name || item.key || item.id || '')
}

function formatTagValue(item: Record<string, any>) {
  let name: string | undefined
  if (item.dataType) {
    let arr = item.dataType?.elements || []
    if (item.dataType?.type === 'boolean') {
      arr = [
        { text: item.dataType.trueText, value: item.dataType.trueValue },
        { text: item.dataType.falseText, value: item.dataType.falseValue },
      ]
    }
    name = arr.find((i: any) => `${i.value}` === `${item.value}`)?.text
  }
  return name ?? item.formatValue ?? item.value
}

function isTagValueEmpty(item: Record<string, any>) {
  const value = formatTagValue(item)
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value.trim() === '') return true
  return false
}

function formatTagLine(item: Record<string, any>) {
  const label = getTagLabel(item)
  if (isTagValueEmpty(item)) return $t('IotDeviceDetail.detail.tagUnsetLine', { label })
  const value = formatTagValue(item)
  return $t('IotDeviceDetail.detail.tagValueLine', { label, value: value !== null && typeof value === 'object' ? JSON.stringify(value) : value })
}

function formatTagTooltipValueOnly(item: Record<string, any>) {
  if (isTagValueEmpty(item)) return $t('IotDeviceDetail.detail.unset')
  const value = formatTagValue(item)
  if (value !== null && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function updateTagsOverflow() {
  void nextTick(() => {
    const el = tagsListRef.value
    if (!el) {
      tagsOverflow.value = false
      tagsExpandedOffset.value = 0
      return
    }
    tagsExpandedOffset.value = Math.max(el.scrollHeight - 26, 0)
    tagsOverflow.value = tagsExpandedOffset.value > 0
    if (!tagsOverflow.value) tagsExpanded.value = false
  })
}

function toggleTagsExpanded() {
  tagsExpanded.value = !tagsExpanded.value
  void nextTick(updateTagsOverflow)
}

function isEmptyTagValue(value: unknown) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

async function saveTags(tags: Record<string, any>[]) {
  if (!device.value?.id || savingTags.value) return
  savingTags.value = true
  try {
    const tagsToSave = tags.filter((tag) => getTagKey(tag) && !isEmptyTagValue(tag.value))
    const tagsToDelete = tags.filter((tag) => getTagKey(tag) && isEmptyTagValue(tag.value) && tag.id)
    if (tagsToSave.length) {
      await iotDeviceDetailRealApi.saveTags(device.value.id, tagsToSave)
    }
    if (tagsToDelete.length) {
      await Promise.all(tagsToDelete.map((tag) => iotDeviceDetailRealApi.deleteTag(device.value!.id, String(tag.id))))
    }
    if (tagsToSave.length || tagsToDelete.length) {
      onlyMessage($t('IotDeviceDetail.detail.saveSuccess'))
      await loadDevice()
    }
    tagEditorOpen.value = false
  } finally {
    savingTags.value = false
  }
}

const thingModelDefinition = computed(() => {
  const metadata = device.value?.thingModelMetadata
  if (metadata && (
    metadata.properties?.length
    || metadata.events?.length
    || metadata.functions?.length
    || metadata.tags?.length
  )) {
    return buildThingModelDefinitionFromMetadata(metadata)
  }
  return buildThingModelDefinitionFromTemplate(productTemplate.value)
})

const showDataThingModelAction = computed(() => (
  activeTab.value === 'data'
  && (dataInnerTab.value === 'property' || dataInnerTab.value === 'event' || dataInnerTab.value === 'function')
))

const overviewConnectionSnapshot = computed(() => {
  const principalFields = accessDetailRef.value?.principalRows?.[0]?.fields ?? []
  const connectionRows = accessDetailRef.value?.connectionRows ?? []
  const identifier = principalFields.find((item) => item.label === $t('IotDeviceDetail.connection.field.identifier'))?.value || device.value?.identifier || '-'
  const tokenField = principalFields.find((item) => item.label === 'Token' || item.label === $t('IotDeviceDetail.accessDetail.username'))
  const connectionAddress = connectionRows.find((item) => item.label === $t('IotDeviceDetail.connection.field.address'))?.value || '-'
  const protocol = connectionRows.find((item) => item.label === $t('IotHealthPage.detail.field.protocol'))?.value || device.value?.accessMode || '-'
  const transport = connectionRows.find((item) => item.label === $t('IotDeviceDetail.accessDetail.transport'))?.value || '-'
  const recentCommunication = connectionRows.find((item) => item.label === $t('IotDeviceDetail.connection.field.lastCommunication'))?.value || device.value?.lastSeen || '-'

  return [
    { label: $t('IotHealthPage.detail.field.id'), value: device.value?.identifier || device.value?.id || '-' },
    { label: $t('IotDeviceDetail.connection.field.address'), value: connectionAddress },
    { label: $t('IotHealthPage.detail.field.protocol'), value: protocol },
    { label: $t('IotDeviceDetail.accessDetail.transport'), value: transport },
    { label: $t('IotDeviceDetail.detail.authIdentifier'), value: identifier },
    { label: $t('IotDeviceDetail.connection.field.lastCommunication'), value: recentCommunication },
    ...(tokenField ? [{ label: tokenField.label, value: tokenField.value }] : []),
  ]
})

const overviewAccessSummary = computed(() => ({
  addressRows: accessDetailRef.value?.addressRows ?? [],
  configGroups: (accessDetailRef.value?.configGroups ?? []).map((group) => ({
    ...group,
    properties: group.properties.map((item) => ({
      ...item,
      value: formatAccessConfigValue(item, accessDetailRef.value?.accessDetail?.configuration?.[item.property]),
    })),
  })),
  principalRows: accessDetailRef.value?.principalRows ?? [],
}))

const categoryKey = computed<DeviceCategory | null>(() => productTemplate.value?.category ?? null)

const categoryIcon = computed<string>(() => {
  if (categoryKey.value) return DEVICE_CATEGORY_META[categoryKey.value].icon
  return 'HddOutlined'
})

function isNumericPoint(point: IotTelemetryPoint): boolean {
  if (!point.unit) return false
  return !Number.isNaN(Number(point.value))
}

const deviceTodos = computed(() => {
  const todos = workbench.value?.todos ?? []
  return todos.filter((todo) => todo.deviceIds.includes(deviceId.value))
})

const relatedActionTodos = computed(() => {
  return deviceTodos.value.filter((todo) => todo.actionKind === 'verify-alarm' || todo.actionKind === 'adjust-rule')
})

const activeRuleRows = computed(() => {
  if (!device.value || !activeRuleTodo.value) return []
  if (activeRuleTodo.value.actionKind === 'verify-alarm') return device.value.rules
  if (activeRuleTodo.value.actionKind === 'adjust-rule') {
    const suggestedRules = device.value.rules.filter((rule) => rule.status === '建议调整')
    return suggestedRules.length ? suggestedRules : device.value.rules
  }
  return []
})

const ruleInfoTitle = computed(() => activeRuleTodo.value ? $t('IotDeviceDetail.detail.relatedRules') : $t('IotDeviceDetail.detail.ruleInfo'))
const ruleInfoSub = computed(() => activeRuleTodo.value?.title ?? '')

const dataPointByKey = computed(() => {
  const map = new Map<string, any>()
  for (const property of device.value?.thingModelMetadata?.properties ?? []) {
    if (property.id) map.set(property.id, property)
  }
  for (const point of productTemplate.value?.dataPoints ?? []) {
    if (point.key && !map.has(point.key)) {
      map.set(point.key, {
        id: point.key,
        name: point.name,
        description: point.desc,
        isKeyMetric: point.isKeyMetric,
        expands: (point as any).expands,
        valueType: { type: point.kind === 'status' ? 'enum' : point.kind },
      })
    }
  }
  return map
})

const realtimeProperties = computed<RealtimePropertyRow[]>(() => {
  const source = device.value?.thingModelMetadata?.properties?.length
    ? (device.value.thingModelMetadata.properties || []).map((property: any) => {
        const current = realtimePropertyValues.value[property.id] || {}
        return {
          key: property.id,
          name: property.name || property.id,
          value: current.formatValue ?? current.value ?? '--',
          unit: formatPropertyUnit(property.valueType),
          status: current.property ? 'normal' : device.value?.status === 'online' ? 'stale' : 'stale',
          updatedAt: current.timeString || formatApiTime(current.timestamp, $t('IotDeviceDetail.detail.noReport')),
          hint: property.description || '',
        } as IotTelemetryPoint
      })
    : (device.value?.telemetry ?? [])

  return source.map((point) => {
    const template = dataPointByKey.value.get(point.key)
    const valueType = template?.valueType?.type || template?.kind || 'string'
    const numeric = ['int', 'long', 'float', 'double', 'number'].includes(valueType) || isNumericPoint(point)
    const typeList = normalizePropertyAccessTypes(template?.expands?.type)
    const readable = typeList.includes('read')
    const writable = typeList.includes('write')
    const accessMode: RealtimeAccessMode = writable && readable ? 'readwrite' : writable ? 'write' : readable ? 'read' : 'none'
    return {
      id: point.key,
      name: template?.name || point.name,
      identifier: point.key,
      value: serializeRealtimePropertyValue(point.value),
      unit: formatPropertyUnit(template?.valueType ?? point.unit),
      dataType: numeric ? 'number' : valueType,
      valueType: template?.valueType,
      accessMode,
      writable,
      updatedAt: point.updatedAt,
      groupId: template?.expands?.groupId || '__default__',
      groupName: template?.expands?.groupName || $t('IotDeviceDetail.detail.defaultGroup'),
      description: template?.description ?? template?.desc ?? point.hint,
      tone: point.status,
      expands: template?.expands,
      metricEnabled: ['number', 'string', 'boolean', 'enum'].includes(numeric ? 'number' : template?.kind === 'status' ? 'enum' : template?.kind ?? 'string'),
      focused: isFocusedProperty(template),
    }
  })
})

function formatPropertyUnit(unit: any): string | undefined {
  if (!unit) return undefined
  if (typeof unit === 'string') return unit
  if (unit.unitName || unit.unitText || unit.unitLabel) return unit.unitName || unit.unitText || unit.unitLabel
  const unitValue = unit.unit
  if (unitValue && typeof unitValue === 'object') {
    return unitValue.name || unitValue.text || unitValue.label || unitValue.symbol || unitValue.id || undefined
  }
  if (typeof unitValue === 'string') return unitValue
  return unit.name || unit.text || unit.label || unit.symbol || unit.id || undefined
}

function normalizePropertyAccessTypes(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

const realtimePropertyKeys = computed(() => {
  const keys = new Set<string>()
  for (const property of device.value?.thingModelMetadata?.properties ?? []) {
    const key = property?.id || property?.property || property?.key || property?.name
    if (key) keys.add(String(key))
  }
  for (const point of device.value?.telemetry ?? []) {
    if (point.key) keys.add(String(point.key))
  }
  for (const point of productTemplate.value?.dataPoints ?? []) {
    if (point.key) keys.add(String(point.key))
  }
  return [...keys]
})

const overviewRealtimePropertyKeys = computed(() => {
  const source = device.value?.thingModelMetadata?.properties?.length
    ? device.value.thingModelMetadata.properties
    : device.value?.telemetry?.length
      ? device.value.telemetry
      : productTemplate.value?.dataPoints ?? []

  const rows = source
    .map((item: any) => ({
      key: item?.id || item?.property || item?.key || item?.name,
      focused: isFocusedProperty(item),
    }))
    .filter((item: { key?: string }) => item.key)

  const focusedRows = rows.filter((item: { focused: boolean }) => item.focused)
  return (focusedRows.length ? focusedRows : rows)
    .map((item: { key: string }) => String(item.key))
    .slice(0, OVERVIEW_PROPERTY_LIMIT)
})

const activeRealtimePropertyKeys = computed(() => (
  activeTab.value === 'overview'
    ? overviewRealtimePropertyKeys.value
    : activeTab.value === 'data' && dataInnerTab.value === 'property'
      ? propertyPageRealtimeKeys.value
    : realtimePropertyKeys.value
))

const activeRealtimePropertyKeySignature = computed(() => activeRealtimePropertyKeys.value.join(','))

const overviewRealtimeProperties = computed(() => {
  const keys = new Set(overviewRealtimePropertyKeys.value.map((item) => item.toLowerCase()))
  return realtimeProperties.value.filter((item) => keys.has(item.identifier.toLowerCase()))
})

const filteredRealtimeProperties = computed(() => {
  const value = realtimeKeyword.value.trim().toLowerCase()
  return realtimeProperties.value.filter((item) => {
    const matchesAccess = realtimeAccessFilter.value === 'all' || item.accessMode === realtimeAccessFilter.value
    const matchesKeyword = !value || [
      item.name,
      item.identifier,
      item.groupName,
      item.description,
    ].join(' ').toLowerCase().includes(value)
    return matchesAccess && matchesKeyword
  })
})

const realtimeEvents = computed<RealtimeEventRow[]>(() => {
  const events = device.value?.thingModelMetadata?.events ?? []
  return events.map((event: any) => {
    const level = event.expands?.level || event.level
    const outputSource = event.outputs ?? event.output ?? event.valueType
    const outputs = Array.isArray(outputSource)
      ? outputSource
      : Array.isArray(outputSource?.properties)
        ? outputSource.properties
        : []
    return {
      id: event.id || event.name,
      name: event.name || event.id,
      level: level === 'critical' || level === 'urgent' ? 'critical' : level === 'major' || level === 'warn' ? 'major' : 'info',
      time: '-',
      description: event.description,
      valueType: event.valueType,
      outputs,
      expands: event.expands,
    }
  }).filter((item: RealtimeEventRow) => item.id)
})

function isFocusedProperty(property: any): boolean {
  const expands = property?.expands ?? property ?? {}
  return [
    expands.focus,
    expands.focused,
    expands.attention,
    expands.concern,
    expands.keyMetric,
    expands.isKeyMetric,
    expands.showInOverview,
    property?.isKeyMetric,
  ].some((value) => value === true || value === 'true' || value === 1 || value === '1')
}

const realtimeServices = computed<RealtimeServiceRow[]>(() => {
  if (!device.value) return []
  const enabled = device.value.status !== 'offline' && device.value.status !== 'no-data' && device.value.status !== 'disabled'
  return [
    {
      id: 'read-properties',
      name: $t('IotDeviceDetail.trace.messageType.readProperty'),
      identifier: 'readProperties',
      callMode: 'sync',
      inputCount: 1,
      outputCount: device.value.telemetry.length,
      status: enabled ? 'enabled' : 'disabled',
    },
    {
      id: 'sync-config',
      name: $t('IotDeviceDetail.simulator.syncConfig'),
      identifier: 'syncConfig',
      callMode: 'sync',
      inputCount: device.value.rules.length,
      outputCount: 1,
      status: enabled && device.value.rules.length > 0 ? 'enabled' : 'disabled',
    },
    {
      id: 'run-diagnosis',
      name: $t('IotDeviceDetail.simulator.runDiagnosis'),
      identifier: 'runDiagnosis',
      callMode: 'async',
      inputCount: 1,
      outputCount: 4,
      status: 'enabled',
    },
  ]
})

const simulatorPresets = computed<SimulatorPreset[]>(() => {
  const propertyOptions = realtimeProperties.value.map((item) => ({ key: item.identifier, label: item.name }))
  const eventOptions = realtimeEvents.value.length
    ? realtimeEvents.value.map((item) => ({ key: item.id, label: item.name }))
    : [{ key: 'status-report', label: $t('IotDeviceDetail.simulator.statusReport') }]
  const serviceOptions = realtimeServices.value.map((item) => ({ key: item.identifier, label: item.name }))
  const defaultProperty = propertyOptions[0]?.key ?? 'status'
  const defaultEvent = eventOptions[0]?.key ?? 'status-report'
  const defaultService = serviceOptions[0]?.key ?? 'readProperties'

  return [
    {
      mode: 'property-report',
      label: $t('IotDeviceDetail.connection.log.propertyReport'),
      description: $t('IotDeviceDetail.simulator.propertyReportDescription'),
      payload: buildSimulatorPayload('property-report', defaultProperty),
      targetOptions: propertyOptions.length ? propertyOptions : [{ key: 'status', label: $t('IotDeviceGroups.field.status') }],
      defaultTarget: defaultProperty,
    },
    {
      mode: 'event-report',
      label: $t('IotSceneLinkage.operator.reportEvent'),
      description: $t('IotDeviceDetail.simulator.eventReportDescription'),
      payload: buildSimulatorPayload('event-report', defaultEvent),
      targetOptions: eventOptions,
      defaultTarget: defaultEvent,
    },
    {
      mode: 'service-call',
      label: $t('IotDeviceDetail.simulator.serviceCall'),
      description: $t('IotDeviceDetail.simulator.serviceCallDescription'),
      payload: buildSimulatorPayload('service-call', defaultService),
      targetOptions: serviceOptions.length ? serviceOptions : [{ key: 'readProperties', label: $t('IotDeviceDetail.trace.messageType.readProperty') }],
      defaultTarget: defaultService,
    },
  ]
})

const simulatorSession = computed<SimulatorSession>(() => {
  const current = device.value
  const online = current?.status === 'online' || current?.status === 'alarm'
  const traces = liveSimulatorTraces.value.length ? liveSimulatorTraces.value : buildSimulatorTraces()
  return {
    subjectId: current?.id ?? '',
    subjectName: current?.name ?? $t('DeviceAlarm.source.device'),
    connection: {
      online,
      connectionCount: online ? 1 : 0,
      connectionAddress: current?.gatewayName ? `${current.gatewayName} / ${current.identifier}` : current?.identifier ?? '',
      accessMode: current?.accessMode ?? '-',
      protocol: current?.productName ?? '-',
      connectedAt: online ? current?.lastSeen ?? '' : '',
      lastCommunicatedAt: current?.lastSeen ?? '',
      pendingMessages: current?.status === 'no-data' ? 2 : 0,
    },
    presets: simulatorPresets.value,
    traces,
    logs: buildSimulatorLogs(traces),
    selectedTraceId: traces[0]?.traceId ?? '',
  }
})

const simulatorActivePreset = computed(() => {
  return simulatorSession.value.presets.find((item) => item.mode === simulatorActiveMode.value) ?? simulatorSession.value.presets[0]
})

const selectedSimulatorTrace = computed(() => {
  return simulatorSession.value.traces.find((item) => item.traceId === simulatorSelectedTraceId.value) ?? simulatorSession.value.traces[0]
})

const simulatorTraceLogs = computed(() => {
  return simulatorSession.value.logs.filter((item) => item.traceId === selectedSimulatorTrace.value?.traceId)
})

const simulatorGeneratedAlarms = computed(() => device.value?.alarms.length ?? 0)

const simulatorTargetLabel = computed(() => {
  if (simulatorActiveMode.value === 'service-call') return $t('IotDeviceDetail.commandInvokeModal.emptyHint')
  if (simulatorActiveMode.value === 'event-report') return $t('IotDeviceDetail.dataTable.selectEvent')
  return $t('IotSceneLinkage.placeholder.property')
})

watch(
  simulatorSession,
  (session) => {
    const preset = session.presets.find((item) => item.mode === simulatorActiveMode.value) ?? session.presets[0]
    simulatorActiveMode.value = preset?.mode ?? 'property-report'
    simulatorTarget.value = preset?.defaultTarget ?? ''
    simulatorPayload.value = preset?.payload ?? ''
    simulatorSelectedTraceId.value = session.selectedTraceId || session.traces[0]?.traceId || ''
  },
  { immediate: true },
)

const childDeviceRelations = computed(() => {
  return device.value?.relations.filter((relation) => /子设备|从设备|child/i.test(`${relation.label} ${relation.value} ${relation.hint}`)) ?? []
})

const deviatingHealthPoints = computed(() =>
  (healthDiagnosis.value?.features.points ?? []).filter((point) => point.isDeviating),
)

const healthConnectionRules = computed<IotDeviceLibraryConnectionHealthRule[]>(() => {
  if (productTemplate.value) {
    return buildTemplateHealthConfigFromTemplate(productTemplate.value, {
      accessMode: device.value?.accessMode,
      risk: device.value?.risk,
    }).connectionRules
  }
  if (!device.value) return []
  const observation = healthDiagnosis.value?.timeline.observation ?? $t('IotDeviceDetail.health.noAdditionalDiagnosis')
  const lastSeen = device.value.lastSeen || '-'
  const status = device.value.status
  return ([{
    enabled: status === 'no-data',
    title: $t('IotDeviceMeta.business.noData'),
    condition: $t('IotDeviceDetail.health.noDataCondition', { lastSeen }),
    severity: 'watch',
    description: observation,
    suggestion: $t('IotDeviceDetail.health.noDataSuggestion'),
  }, {
    enabled: status === 'offline',
    title: $t('IotStandardModel.mapper.deviceOffline'),
    condition: $t('IotDeviceDetail.health.offlineCondition', { lastSeen }),
    severity: 'urgent',
    description: observation,
    suggestion: $t('IotDeviceDetail.health.offlineSuggestion'),
  }, {
    enabled: status === 'online' || status === 'alarm',
    title: $t('IotDeviceDetail.connectionHealth.anomaly.fluctuation'),
    condition: $t('IotDeviceDetail.health.fluctuationCondition', { lastSeen }),
    severity: device.value.risk === 'urgent' ? 'urgent' : 'watch',
    description: observation,
    suggestion: $t('IotDeviceDetail.health.fluctuationSuggestion'),
  }].filter((item) => item.enabled)) as IotDeviceLibraryConnectionHealthRule[]
})

const healthDeviationProperties = computed<IotDeviceLibraryThingModelProperty[]>(() => {
  if (productTemplate.value) {
    return buildTemplateHealthConfigFromTemplate(productTemplate.value, {
      accessMode: device.value?.accessMode,
      risk: device.value?.risk,
    }).deviationProperties
  }
  return deviatingHealthPoints.value.map((point) => ({
    id: point.pointKey,
    name: point.name,
    identifier: point.pointKey,
    dataType: 'number',
    accessMode: 'read',
    source: $t('IotStandardModel.common.deviceReport'),
    tags: [],
    description: point.normalRange?.hint || healthDiagnosis.value?.timeline.observation || '',
    expandedConfig: {
      displayName: point.name,
      valueType: 'number',
      reportStrategy: $t('IotDeviceDetail.runtime.source.deviceReport'),
      items: [
        { identifier: 'accessMode', name: $t('IotStandardModel.thingModel.meta.accessMode'), dataType: $t('IotDeviceDetail.commandCenter.access.read') },
        { identifier: 'unit', name: $t('IotSceneLinkage.editor.unit'), dataType: point.unit || '-' },
      ],
      thresholds: [],
      deviationConfig: {
        normalRange: formatHealthNormalRange(point),
        warningRange: point.status === 'warning' ? point.currentValue : '-',
        alarmRange: point.status === 'critical' ? point.currentValue : '-',
        description: point.normalRange?.hint || healthDiagnosis.value?.timeline.observation || '-',
        suggestion: $t('IotDeviceDetail.health.deviationSuggestion'),
      },
    },
  }))
})

const connectionCount = computed(() => getDeviceConnectionCount(device.value))
const recordsCount = computed(() => (device.value?.alarms.length ?? 0) + (device.value?.logs.length ?? 0))
const advancedCount = computed(() => deviceCommands.value.length + healthConnectionRules.value.length + healthDeviationProperties.value.length + (isGatewayDevice.value ? childDeviceCount.value : 0))

const tabOptions = computed<Array<{ key: DeviceDetailTab; label: string; icon: string }>>(() => [
  { key: 'overview', label: $t('IotDeviceDetail.detail.tab.overview'), icon: 'AppstoreOutlined' },
  { key: 'access', label: $t('IotDeviceDetail.detail.tab.access'), icon: 'WifiOutlined' },
  { key: 'commands', label: $t('IotDeviceDetail.detail.tab.commands'), icon: 'CodeOutlined' },
  { key: 'data', label: $t('IotDeviceDetail.detail.tab.data'), icon: 'LineChartOutlined' },
  { key: 'alarm', label: $t('DeviceAlarm.title.page'), icon: 'AlertOutlined' },
  { key: 'logs', label: $t('IotDeviceDetail.detail.tab.logs'), icon: 'FileTextOutlined' },
])

function eventLevelFromSeverity(severity: string): RealtimeEventLevel {
  if (severity === 'urgent' || severity === 'high') return 'critical'
  if (severity === 'normal') return 'major'
  return 'info'
}

function getDeviceConnectionCount(current: IotDevice | null): number {
  return current && (current.status === 'online' || current.status === 'alarm') ? 1 : 0
}

function formatHealthNormalRange(point: NonNullable<IotDeviceHealthDiagnosis['features']>['points'][number]) {
  const range = point.normalRange
  if (!range) return '-'
  const min = range.min !== undefined ? `${range.min}` : ''
  const max = range.max !== undefined ? `${range.max}` : ''
  if (min && max) return `${min} ~ ${max}${point.unit ? ` ${point.unit}` : ''}`
  if (min) return `>= ${min}${point.unit ? ` ${point.unit}` : ''}`
  if (max) return `<= ${max}${point.unit ? ` ${point.unit}` : ''}`
  return '-'
}

function buildSimulatorPayload(mode: SimulatorActionMode, target: string) {
  const current = device.value
  const point = current?.telemetry.find((item) => item.key === target) ?? current?.telemetry[0]
  const payload = {
    deviceId: current?.identifier ?? current?.id ?? '',
    productName: current?.productName ?? '',
    target,
    timestamp: current?.lastSeen ?? $t('IotDeviceDetail.common.time.justNow'),
    data: mode === 'service-call'
      ? { service: target, params: { source: 'device-detail-simulator' } }
      : mode === 'event-report'
        ? { event: target, level: current?.risk === 'urgent' ? 'critical' : 'info', message: current?.summary ?? '' }
        : { [point?.key ?? target]: point?.value ?? '' },
  }
  return JSON.stringify(payload, null, 2)
}

function makeTraceSteps(traceId: string, direction: SimulatorDirection, status: SimulatorStatus, summary: string): SimulatorTraceStep[] {
  const now = device.value?.lastSeen ?? ''
  const ingressTitle = direction === 'uplink' ? $t('IotStandardModel.common.deviceReport') : $t('IotDeviceDetail.simulator.platformCommand')
  const egressTitle = direction === 'uplink' ? $t('IotDeviceDetail.simulator.platformStored') : $t('IotDeviceDetail.trace.operation.response')
  return [
    {
      id: `${traceId}-step-1`,
      title: ingressTitle,
      content: direction === 'uplink' ? $t('IotDeviceDetail.simulator.ingressContent') : $t('IotDeviceDetail.simulator.downlinkContent'),
      status: 'success',
      node: device.value?.gatewayName ?? $t('IotDeviceDetail.simulator.accessChannel'),
      happenedAt: now,
    },
    {
      id: `${traceId}-step-2`,
      title: $t('IotDeviceDetail.simulator.ruleProcessing'),
      content: summary,
      status,
      node: $t('IotDeviceDetail.simulator.ruleEngine'),
      happenedAt: now,
    },
    {
      id: `${traceId}-step-3`,
      title: egressTitle,
      content: direction === 'uplink' ? $t('IotDeviceDetail.simulator.uplinkCompleted') : $t('IotDeviceDetail.simulator.downlinkCompleted'),
      status: status === 'failed' ? 'waiting' : 'success',
      node: $t('IotDeviceDetail.simulator.deviceRuntime'),
      happenedAt: now,
    },
  ]
}

function buildSimulatorTraces(): SimulatorTrace[] {
  const current = device.value
  if (!current) return []
  const baseRows: Array<{
    id: string
    title: string
    direction: SimulatorDirection
    status: SimulatorStatus
    summary: string
    target: string
    request: Record<string, unknown>
    response: Record<string, unknown>
  }> = []

  const firstPoint = current.telemetry[0]
  if (firstPoint) {
    baseRows.push({
      id: `${current.id}-property-${firstPoint.key}`,
      title: $t('IotDeviceDetail.simulator.propertyReported', { name: firstPoint.name }),
      direction: 'uplink',
      status: firstPoint.status === 'critical' ? 'failed' : firstPoint.status === 'warning' ? 'running' : 'success',
      summary: `${firstPoint.value}${firstPoint.unit ?? ''} · ${firstPoint.hint}`,
      target: firstPoint.key,
      request: { [firstPoint.key]: firstPoint.value, unit: firstPoint.unit, at: firstPoint.updatedAt },
      response: { accepted: firstPoint.status !== 'critical', status: firstPoint.status },
    })
  }

  for (const alarm of current.alarms.slice(0, 2)) {
    baseRows.push({
      id: `${current.id}-alarm-${alarm.id}`,
      title: alarm.title,
      direction: 'uplink',
      status: alarm.severity === 'urgent' || alarm.severity === 'high' ? 'running' : 'success',
      summary: alarm.desc,
      target: alarm.subType,
      request: { event: alarm.subType, severity: alarm.severity, payload: alarm.payload },
      response: { accepted: true, generatedAlarm: true, status: alarm.status },
    })
  }

  const service = realtimeServices.value[0]
  if (service) {
    baseRows.push({
      id: `${current.id}-service-${service.identifier}`,
      title: service.name,
      direction: 'downlink',
      status: service.status === 'enabled' ? 'success' : 'waiting',
      summary: service.status === 'enabled' ? $t('IotDeviceDetail.simulator.readSuccess') : $t('IotDeviceDetail.simulator.deviceUnreachable'),
      target: service.identifier,
      request: { service: service.identifier, params: { deviceId: current.identifier } },
      response: { status: service.status === 'enabled' ? 'ack' : 'waiting', outputCount: service.outputCount },
    })
  }

  return baseRows.slice(0, 6).map((row, index) => {
    const traceId = `trace-${row.id}`
    const steps = makeTraceSteps(traceId, row.direction, row.status, row.summary)
    return {
      id: row.id,
      traceId,
      title: row.title,
      direction: row.direction,
      status: row.status,
      summary: row.summary,
      stepCount: steps.length,
      logCount: 3,
      duration: index === 0 ? '42ms' : `${80 + index * 36}ms`,
      requestPayload: JSON.stringify(row.request, null, 2),
      responsePayload: JSON.stringify(row.response, null, 2),
      steps,
    }
  })
}

function buildSimulatorLogs(traces: SimulatorTrace[]): SimulatorLog[] {
  return traces.flatMap((trace) => trace.steps.map((step, index) => ({
    id: `${step.id}-log`,
    time: step.happenedAt,
    level: step.status === 'failed' ? 'error' : step.status === 'waiting' ? 'warning' : index === 0 ? 'debug' : 'success',
    message: step.content,
    traceId: trace.traceId,
    node: step.node,
  })))
}

function selectSimulatorPreset(mode: SimulatorActionMode) {
  simulatorActiveMode.value = mode
  resetSimulatorPayload()
}

function resetSimulatorPayload() {
  simulatorTarget.value = simulatorActivePreset.value?.defaultTarget ?? ''
  simulatorPayload.value = simulatorActivePreset.value?.payload ?? ''
}

function openSimulatorTrace(traceId: string) {
  simulatorSelectedTraceId.value = traceId
  simulatorDrawerOpen.value = true
}

function openRelatedRules(todo: IotDeviceTodo) {
  activeRuleTodo.value = todo
  ruleInfoOpen.value = true
}

function openTodoHandler(todo: IotDeviceTodo) {
  handlingTodo.value = todo
  todoHandlerOpen.value = true
}

function formatAccessConfigValue(item: AccessConfigProperty, value: unknown): string {
  if (item.type?.type === 'enum') {
    const option = item.type.elements?.find((element) => `${element.value}` === `${value}`)
    return option?.text || (value == null || value === '' ? '--' : String(value))
  }
  if (item.type?.type === 'boolean') {
    if (`${value}` === `${item.type.trueValue}`) return item.type.trueText || $t('IotDeviceDetail.common.yes')
    if (`${value}` === `${item.type.falseValue}`) return item.type.falseText || $t('IotDeviceDetail.common.no')
  }
  return value == null || value === '' ? '--' : String(value)
}

function clearRealtimeStatusSubscription() {
  realtimeStatusSubscription.value?.unsubscribe?.()
  realtimeStatusSubscription.value = undefined
  realtimeStatusSubscriptionKey.value = ''
}

function clearRealtimePropertySubscription() {
  realtimePropertySubscription.value?.unsubscribe?.()
  realtimePropertySubscription.value = undefined
  realtimePropertySubscriptionKey.value = ''
}

function clearRealtimeSubscriptions() {
  clearRealtimeStatusSubscription()
  clearRealtimePropertySubscription()
}

function normalizeRealtimePropertyValue(value: DevicePropertyValue): DevicePropertyValue | undefined {
  const rawProperty = String(value.property || value.id || value.key || '')
  if (!rawProperty) return undefined
  const property = realtimePropertyKeys.value.find((key) => key.toLowerCase() === rawProperty.toLowerCase()) || rawProperty
  const nextValue = value.formatValue ?? value.value ?? '--'
  const nextTime = value.timeString || formatApiTime(value.timestamp, $t('IotDeviceDetail.detail.noReport'))
  return {
    ...value,
    property,
    formatValue: nextValue,
    value: nextValue,
    timeString: nextTime,
  }
}

function mergeRealtimePropertyValue(value: DevicePropertyValue) {
  const normalized = normalizeRealtimePropertyValue(value)
  if (!normalized) return
  const property = normalized.property
  realtimePropertyValues.value = {
    ...realtimePropertyValues.value,
    [property]: normalized,
  }
  if (device.value?.telemetry?.length) {
    device.value = {
      ...device.value,
      telemetry: device.value.telemetry.map((point) => point.key === property
        ? {
            ...point,
            value: serializeRealtimePropertyValue(normalized.value),
            unit: undefined,
            updatedAt: normalized.timeString,
            status: 'normal',
          }
        : point),
    }
  }
}

function serializeRealtimePropertyValue(value: unknown): string {
  if (value === undefined || value === null) return '--'
  if (typeof value !== 'object') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return '--'
  }
}

function handleRealtimePropertyValue(value: DevicePropertyValue) {
  mergeRealtimePropertyValue(value)
}

async function loadRealtimePropertySnapshot(properties = activeRealtimePropertyKeys.value) {
  const current = device.value
  const productId = current?.productKey
  if (!current?.id || !productId || !properties.length) return

  const resp: any = await iotDeviceDetailRealApi.queryDashboard([
    {
      dashboard: 'device',
      object: productId,
      measurement: 'properties',
      dimension: 'history',
      params: {
        deviceId: current.id,
        history: 1,
        properties,
      },
    },
  ])

  const values: Record<string, DevicePropertyValue> = {}
  for (const item of resp?.result ?? []) {
    const value = item?.data?.value || {}
    if (!value.property) continue
    values[value.property] = {
      timeString: item?.data?.timeString,
      timestamp: item?.data?.timestamp,
      ...value,
    }
  }
  realtimePropertyValues.value = {
    ...realtimePropertyValues.value,
    ...values,
  }
}

function mapStatePayloadToStatus(payload: any): IotDevice['status'] | undefined {
  const value = String(payload?.value?.type ?? payload?.value ?? payload?.state?.value ?? payload?.state ?? '').toLowerCase()
  if (value === 'online') return 'online'
  if (value === 'disabled' || value === 'notactive') return 'disabled'
  if (value === 'offline') return 'offline'
  return undefined
}

function startRealtimeSubscriptions() {
  const current = device.value
  const properties = activeRealtimePropertyKeys.value
  if (!current?.id) return
  const productId = current.productKey || ''

  const statusSubscriptionKey = current.id
  if (realtimeStatusSubscriptionKey.value !== statusSubscriptionKey) {
    clearRealtimeStatusSubscription()
    realtimeStatusSubscriptionKey.value = statusSubscriptionKey
    realtimeStatusSubscription.value = subscribeDeviceStatus(current.id, (payload) => {
      const status = mapStatePayloadToStatus(payload)
      if (status && device.value) {
        device.value = {
          ...device.value,
          status,
          connectionStatus: status === 'disabled' ? 'disabled' : status === 'online' ? 'online' : 'offline',
          lastSeen: formatApiTime(payload?.timestamp ?? Date.now(), device.value.lastSeen),
        }
      }
    })
  }

  const propertySubscriptionKey = `${current.id}:${productId}:${properties.join(',')}`
  if (realtimePropertySubscriptionKey.value === propertySubscriptionKey) return

  clearRealtimePropertySubscription()
  realtimePropertySubscriptionKey.value = propertySubscriptionKey

  if (properties.length) {
    realtimePropertySubscription.value = subscribeDeviceProperties(current.id, productId, properties, handleRealtimePropertyValue)
  }
}

async function loadDevice() {
  const result = await iotDeviceService.getDevice(projectId.value, deviceId.value)
  device.value = result.ok ? result.data : null
  realtimePropertyValues.value = {}
  propertyPageRealtimeKeys.value = []
  liveSimulatorTraces.value = []
  await loadRealtimePropertySnapshot()
  startRealtimeSubscriptions()
}

async function loadCommands() {
  const result = await iotDeviceService.listDeviceCommands(projectId.value, deviceId.value)
  deviceCommands.value = result.ok ? result.data : []
}

async function loadWorkbench() {
  const result = await iotDeviceService.getWorkbench({
    projectId: projectId.value,
    keyword: '',
    connectionStatus: 'all',
    businessStatus: 'all',
    risk: 'all',
    area: 'all',
    productName: 'all',
    owner: 'all',
  })
  workbench.value = result.ok ? result.data : null
}

async function loadChildDevices() {
  if (!device.value?.id || !isGatewayDevice.value) {
    childDeviceCount.value = 0
    return
  }
  const resp: any = await iotDeviceDetailRealApi.queryChildDevices({
    pageIndex: 0,
    pageSize: 100,
    terms: [{ column: 'parentId', value: device.value.id, termType: 'eq' }],
  })
  const rows = extractRows(resp?.result)
  childDeviceCount.value = Number(resp?.result?.total ?? resp?.result?.page?.total ?? rows.length)
}

async function runDiagnosis() {
  const result = await iotDeviceService.getDeviceHealthDiagnosis(projectId.value, deviceId.value)
  healthDiagnosis.value = result.ok ? result.data : null
}

async function onCompleteTodo(todoId: string, action?: string) {
  todoBusyId.value = todoId
  await iotDeviceService.completeTodo(projectId.value, todoId, action)
  todoBusyId.value = ''
  await loadWorkbench()
}

async function onSnoozeTodo(todoId: string, action?: string) {
  todoBusyId.value = todoId
  await iotDeviceService.snoozeTodo(projectId.value, todoId, action)
  todoBusyId.value = ''
  await loadWorkbench()
}

async function onExecuteDeviceCommand(commandId: string, params: Record<string, any>) {
  commandBusy.value = true
  const result = await iotDeviceService.executeDeviceCommand({
    projectId: projectId.value,
    deviceId: deviceId.value,
    commandId,
    params,
  })
  commandBusy.value = false
  if (result.ok) commandExecution.value = result.data
}

function setPropertyPageRealtimeKeys(keys: string[]) {
  propertyPageRealtimeKeys.value = keys
}

async function loadAll() {
  await loadDevice()
  await loadCommands()
  await loadWorkbench()
  await loadChildDevices()
  await runDiagnosis()
}

useIotDataAccessRefresh(projectId, async () => {
  await loadAll()
})

onMounted(() => {
  updateTagsOverflow()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateTagsOverflow)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateTagsOverflow)
  }
  clearRealtimeSubscriptions()
})

await loadAll()

watch([projectId, deviceId], async ([nextProjectId, nextDeviceId], [previousProjectId, previousDeviceId]) => {
  if (nextProjectId === previousProjectId && nextDeviceId === previousDeviceId) return
  tagEditorOpen.value = false
  await loadAll()
  await nextTick(updateTagsOverflow)
})

watch(
  thingModelTags,
  () => {
    updateTagsOverflow()
  },
  { deep: true, immediate: true },
)


watch(activeRealtimePropertyKeySignature, async () => {
  if (!device.value?.id) return
  await loadRealtimePropertySnapshot()
  startRealtimeSubscriptions()
})

</script>

<style scoped>
.dd-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: center;
  min-height: 5rem;
  padding: var(--space-3) var(--space-4);
  margin-bottom: 0.875rem;
  border: 0.0625rem solid var(--jet-theme-border-secondary);
  border-radius: var(--r-6);
  background: var(--bg-trans-8);
}

.dd-hero__back.ant-btn {
  grid-column: 1 / -1;
  justify-self: start;
  height: auto;
  padding: 0;
  color: var(--jet-theme-text-secondary);
}

.dd-hero__back.ant-btn:hover,
.dd-hero__back.ant-btn:focus {
  color: var(--jet-theme-primary);
  background: transparent;
}

.dd-hero__icon {
  display: grid;
  place-items: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 0.75rem;
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-primary);
}

.dd-hero__icon :deep(svg) {
  width: 1.625rem;
  height: 1.625rem;
}

.dd-hero__icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.dd-hero__icon[data-category='video'] { color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
.dd-hero__icon[data-category='meter'] { color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
.dd-hero__icon[data-category='sensor'] { color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
.dd-hero__icon[data-category='industrial'] { color: var(--jet-theme-warning); background: color-mix(in srgb, var(--jet-theme-warning) 12%, var(--jet-theme-bg-container)); }
.dd-hero__icon[data-category='integration'] { color: var(--jet-theme-text-secondary); background: var(--jet-theme-bg-layout); }

.dd-hero__main {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.dd-hero__headline {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  overflow: hidden;
}

.dd-hero__headline :deep(.ant-tooltip-open) {
  min-width: 0;
}

.dd-hero__headline h1 {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: 1.3;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-hero__summary {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.dd-summary-line {
  display: grid;
  grid-template-columns: minmax(0, 16rem) minmax(0, 16rem) minmax(0, 24rem);
  align-items: center;
  justify-content: start;
  column-gap: var(--space-3);
  row-gap: var(--space-1);
  min-width: 0;
}

.dd-summary-row {
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  line-height: 1.6;
}

.dd-summary-label {
  flex: 0 0 3.75rem;
  margin-right: var(--space-2);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-weight: 400;
  text-align: left;
}

.dd-summary-value {
  display: inline-block;
  flex: 1 1 auto;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  font-weight: 400;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.dd-summary-row--tags {
  grid-column: 1 / -1;
  align-items: flex-start;
}

/* 标签扩展会增高中间列；抵消居中布局的半程位移，保持两侧原有位置。 */
.dd-hero.is-tags-expanded > .dd-hero__icon,
.dd-hero.is-tags-expanded > .dd-hero__actions {
  transform: translateY(var(--dd-tags-expanded-shift));
}

.dd-tags-title {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  margin-right: var(--space-2);
  padding-top: 0.125rem;
}

.dd-tags-title > .dd-summary-label {
  flex: 0 0 auto;
  margin-right: var(--space-1);
}

.dd-tags-list {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  gap: var(--space-1);
  max-height: 1.625rem;
  min-width: 0;
  overflow: hidden;
}

.dd-tags-list.is-expanded {
  max-height: none;
}

.dd-tag-text {
  display: inline-flex;
  align-items: center;
  padding-inline: var(--space-2);
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.625rem;
  white-space: nowrap;
}

.dd-tags-action {
  flex: 0 0 auto;
  padding-inline: 0 !important;
}

.dd-tags-edit-action {
  width: 1.5rem;
  padding-inline: 0 !important;
}

.dd-hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.dd-delete-target {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-3) 0;
  padding: var(--space-3);
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: 0.5rem;
  background: var(--jet-theme-bg-layout);
}

.dd-delete-target span {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
}

@media (max-width: 64rem) {
  .dd-hero {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .dd-hero__actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}

@media (max-width: 40rem) {
  .dd-hero {
    grid-template-columns: minmax(0, 1fr);
  }

  .dd-hero__icon {
    display: none;
  }

  .dd-hero__headline,
  .dd-hero__summary {
    align-items: flex-start;
  }

  .dd-hero__summary {
    gap: var(--space-1);
  }

  .dd-summary-line {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-1);
  }

  .dd-tags-list {
    flex-basis: calc(100% - 4.75rem);
  }

  .dd-summary-value {
    max-width: 100%;
  }

  .dd-summary-label {
    flex-basis: 3.75rem;
    text-align: left;
  }
}

.dd-tab-shell {
  border: 0.0625rem solid var(--jet-theme-border-secondary);
  border-radius: var(--r-6);
  background: var(--bg-trans-8);
  overflow: hidden;
}

.dd-detail-tabs {
  padding: 0 var(--space-4);
}

.dd-detail-tabs :deep(.ant-tabs-tab) {
  padding: 0;
}

.dd-detail-tabs :deep(.ant-tabs-tab + .ant-tabs-tab) {
  margin-left: var(--space-5);
}

.dd-detail-tabs :deep(.ant-tabs-nav),
.dd-inline-tabs :deep(.ant-tabs-nav) {
  margin: 0;
}

.dd-detail-tabs :deep(.ant-tabs-content-holder),
.dd-inline-tabs :deep(.ant-tabs-content-holder) {
  display: none;
}

.dd-detail-tabs__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.625rem;
  font-size: var(--fs-14);
  font-weight: 600;
  white-space: nowrap;
}


.dd-tab-content {
  padding: var(--space-4);
}

.dd-hidden-access {
  display: none;
}

.dd-inline-shell {
  display: grid;
  gap: 1.125rem;
}

.dd-inline-tabs {
  border-bottom: 0.0625rem solid var(--jet-theme-border);
}

.dd-inline-content {
  min-width: 0;
}

.dd-model-action {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.dd-model-action__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2rem;
  box-shadow: none !important;
}

.dd-model-action__btn:hover,
.dd-model-action__btn:focus {
  border-color: color-mix(in srgb, var(--jet-theme-primary) 36%, var(--jet-theme-border)) !important;
  color: var(--jet-theme-primary) !important;
  background: color-mix(in srgb, var(--jet-theme-primary) 4%, var(--jet-theme-bg-container)) !important;
}

.dd-model-action__arrow {
  color: currentColor;
  font-size: var(--fs-14);
  line-height: 1;
}

.dd-subsection,
.dd-subpanel {
  display: grid;
  gap: var(--space-3);
}

.dd-stacked-sections {
  display: grid;
  gap: 1.125rem;
}

.dd-section__head {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: var(--space-3);
}

.dd-section__head :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--jet-theme-primary);
}

.dd-section__head h2 {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-h3);
}

.dd-section__head span {
  margin-left: auto;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14); }

.dd-empty {
  margin: 0.25rem 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-style: italic;
}

.dd-empty-panel {
  display: grid;
  gap: 0.375rem;
  border: 0.0625rem dashed var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  padding: 0.875rem;
  background: var(--jet-theme-bg-container);
}

.dd-empty-panel strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
}

.dd-empty-panel p {
  margin: 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.6;
}

.dd-rule-panel {
  display: grid;
  gap: var(--space-4);
}

.dd-rule-panel__summary {
  margin: 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.6;
}

.dd-rules {
  display: grid;
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 0.0625rem solid var(--jet-theme-border);
}

.dd-rules li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  row-gap: var(--space-1);
  column-gap: var(--space-3);
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 0.0625rem solid var(--jet-theme-border);
}

.dd-rules li > div {
  display: grid;
  gap: 0.125rem;
}

.dd-rules li strong,
.dd-event-item strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
}

.dd-rules li small,
.dd-rules li p,
.dd-event-item span,
.dd-event-item time {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.dd-rules li p {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--jet-theme-text-secondary);
  line-height: 1.55;
}

.dd-event-list {
  display: grid;
  gap: var(--space-2);
}

.dd-event-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: var(--space-3);
  align-items: center;
  padding: 0.75rem 0.875rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
}

.dd-event-item[data-level='critical'] {
  border-color: color-mix(in srgb, var(--jet-theme-error) 30%, var(--jet-theme-border));
}

.dd-event-item[data-level='major'] {
  border-color: color-mix(in srgb, var(--jet-theme-warning) 30%, var(--jet-theme-border));
}

.dd-relations {
  padding-top: var(--space-3);
  border-top: 0.0625rem solid var(--jet-theme-border);
}

.dd-relations ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-1);
}

.dd-relations li {
  display: grid;
  grid-template-columns: 5rem auto auto;
  gap: var(--space-3);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.6;
}

.dd-relations li span {
  color: var(--jet-theme-text-disabled);
}

.dd-relations li strong {
  color: var(--jet-theme-text);
  font-weight: 600;
}

.dd-relations li small {
  color: var(--jet-theme-text-disabled);
}

@media (max-width: 53.75rem) {
  .dd-hero {
    grid-template-columns: 1fr;
  }

  .dd-event-item,
  .dd-relations li,
  .dd-rules li {
    grid-template-columns: 1fr;
  }

  .dd-tab-content {
    padding: var(--space-4);
  }
}</style>
