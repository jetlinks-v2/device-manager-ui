<template>
  <section class="command-center">
    <IotDevicePropertyReadModal
      v-model:open="readOpen"
      :property="selectedProperty"
      :tone="selectedTone"
      :loading="reading"
      @confirm="readSelectedProperty"
    />
    <IotDevicePropertyWriteModal
      v-model:open="writeOpen"
      :property="selectedProperty"
      :loading="writing"
      @confirm="writeSelectedProperty"
    />
    <IotDeviceCommandInvokeModal
      v-model:open="invokeOpen"
      :command="activeCommand"
      :busy="busy"
      @execute="onExecuteCommand"
    />

    <FullPage>
      <div class="command-center__main">
        <section class="command-panel">
          <header class="command-panel__tabs">
            <a-tabs v-model:active-key="activePane" class="command-panel__tabbar">
              <template #rightExtra>
                <a-input-search
                  class="command-panel__search"
                  :placeholder="$t('IotDeviceDetail.commandCenter.searchPlaceholder')"
                  @search="handleKeywordSearch"
                />
              </template>
              <a-tab-pane key="property">
                <template #tab>
                  {{ $t('IotDeviceDetail.commandCenter.tab.property') }} <span class="command-panel__tab-count">{{ properties.length }}</span>
                </template>
              </a-tab-pane>
              <a-tab-pane key="function">
                <template #tab>
                  {{ $t('IotDeviceDetail.commandCenter.tab.function') }} <span class="command-panel__tab-count">{{ commands.length }}</span>
                </template>
              </a-tab-pane>
            </a-tabs>
          </header>

          <div v-if="activePane === 'property'" class="runtime-list">
            <article v-for="item in filteredProperties" :key="item.id" class="runtime-row">
            <span class="runtime-row__badge" :data-mode="propertyAccessMode(item)">
              {{ propertyAccessText(item) }}
            </span>
              <div class="runtime-row__body">
                <strong>{{ item.name }}</strong>
                <small>{{ item.identifier }}</small>
              </div>
              <code>{{ item.valueType?.type }}</code>
              <div class="runtime-row__value">
                <strong>{{ item.value }}</strong>
              </div>
              <div class="runtime-row__actions">
                <a-button v-if="canReadProperty(item)" size="small" @click="openRead(item)">{{ $t('IotDeviceDetail.commandCenter.read') }}</a-button>
                <a-button v-if="canWriteProperty(item)" type="primary" size="small" @click="openWrite(item)">{{ $t('IotDeviceDetail.commandCenter.write') }}</a-button>
              </div>
            </article>
            <CloudEmpty v-if="!filteredProperties.length" :description="$t('IotDeviceDetail.commandCenter.noProperties')" />
          </div>

          <div v-else class="runtime-list">
            <article v-for="command in filteredCommands" :key="command.id" class="runtime-row runtime-row--function">
              <div class="runtime-row__icon">
                <AIcon :type="commandIcon(command)" />
              </div>
              <div class="runtime-row__body">
                <a-space>
                  <strong>{{ command.name }}</strong><small>{{ command.identifier }}</small>
                </a-space>
                <div class="runtime-row__description">
                  <a-tag color="processing" class="runtime-row__call-mode">
                    {{ commandCallModeText(command) }}
                  </a-tag>
                  <j-ellipsis v-if="command.description" class="runtime-row__description-text">
                    {{ command.description }}
                  </j-ellipsis>
                </div>
                <div
                  class="runtime-row__params"
                  :class="{ 'is-single': !hasCommandOutput(command) }"
                >
                  <a-tooltip :title="commandParameterTooltip(command.inputParams)">
                    <span class="runtime-row__param">
                      <span class="runtime-row__param-label">{{ $t('IotDeviceDetail.commandCenter.inputParameters') }}</span>
                      <j-ellipsis class="runtime-row__param-value">
                        {{ commandInputSummary(command) }}
                      </j-ellipsis>
                    </span>
                  </a-tooltip>
                  <a-tooltip v-if="hasCommandOutput(command)" :title="commandParameterTooltip(command.outputParams)">
                    <span class="runtime-row__param">
                      <span class="runtime-row__param-label">{{ $t('IotDeviceDetail.commandCenter.outputParameters') }}</span>
                      <j-ellipsis class="runtime-row__param-value">
                        {{ commandParameterNames(command.outputParams) }}
                      </j-ellipsis>
                    </span>
                  </a-tooltip>
                </div>
              </div>
              <a-button type="primary" size="small" :disabled="!command.enabled" @click="openInvoke(command)">
                <template #icon><AIcon type="CodeOutlined" /></template>
                {{ $t('IotDeviceDetail.commandCenter.invoke') }}
              </a-button>
            </article>
            <CloudEmpty v-if="!filteredCommands.length" :description="$t('IotDeviceDetail.commandCenter.noFunctions')" />
          </div>
        </section>

        <aside class="command-history">
          <header>
            <strong>{{ $t('IotDeviceDetail.commandCenter.historyTitle') }}</strong>
            <span>{{ $t('IotDeviceDetail.commandCenter.historyCount', { count: historyRows.length }) }}</span>
          </header>
          <article v-for="row in historyRows" :key="row.id" class="history-row">
            <div class="history-row__head">
              <a-space :size="6">
                <span :data-action="row.action">{{ row.actionText }}</span>
                <strong>{{ row.name }}</strong>
                <code>{{ row.identifier }}</code>
              </a-space>
              <time>{{ row.time }}</time>
            </div>
            <div v-if="row.replyPayload" class="history-row__payloads">
              <section class="history-row__payload-block">
                <span>{{ $t('IotDeviceDetail.commandCenter.input') }}</span>
                <pre>{{ row.payload }}</pre>
              </section>
              <section class="history-row__payload-block">
                <span>{{ $t('IotDeviceDetail.commandCenter.reply') }}</span>
                <pre>{{ row.replyPayload }}</pre>
              </section>
            </div>
            <pre v-else>{{ row.payload }}</pre>
          </article>
          <CloudEmpty v-if="!historyRows.length" :description="$t('IotDeviceDetail.commandCenter.noHistory')" />
        </aside>
      </div>
    </FullPage>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IotDeviceCommandDefinition, IotDeviceCommandExecution, IotDeviceLog } from '../../types'
import type { DevicePropertyValue } from '../../services/iotDeviceDetailReal.service'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import IotDeviceCommandInvokeModal from './IotDeviceCommandInvokeModal.vue'
import IotDevicePropertyReadModal from './IotDevicePropertyReadModal.vue'
import IotDevicePropertyWriteModal from './IotDevicePropertyWriteModal.vue'
import { useIotDeviceCommandHistory } from './useIotDeviceCommandHistory'
import { useIotDevicePropertyOperation } from './useIotDevicePropertyOperation'

type Pane = 'property' | 'function'

const props = defineProps<{
  deviceId: string
  properties: RealtimePropertyRow[]
  commands: IotDeviceCommandDefinition[]
  logs: IotDeviceLog[]
  result: IotDeviceCommandExecution | null
  busy: boolean
}>()

const emit = defineEmits<{
  execute: [commandId: string, params: Record<string, any>]
  'property-value': [value: DevicePropertyValue]
}>()

const { t: $t } = useI18n()
const activePane = ref<Pane>('property')
const keyword = ref('')
const invokeOpen = ref(false)
const activeCommand = ref<IotDeviceCommandDefinition | null>(null)
const {
  selectedProperty,
  selectedTone,
  readOpen,
  writeOpen,
  reading,
  writing,
  openRead,
  openWrite,
  readSelectedProperty,
  writeSelectedProperty,
} = useIotDevicePropertyOperation({
  deviceId: () => props.deviceId,
  onValue: (value) => {
    emit('property-value', value)
    void loadHistory()
  },
})
const { historyRows, loadHistory } = useIotDeviceCommandHistory(
  () => props.deviceId,
  () => props.logs,
  () => props.properties,
  () => props.commands,
)

watch(() => props.result?.id, () => {
  if (props.result?.id) void loadHistory()
})

const filteredProperties = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  return props.properties.filter((item) => !value || [item.name, item.identifier, item.dataType].join(' ').toLowerCase().includes(value))
})

const filteredCommands = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  return props.commands.filter((item) => !value || [item.name, item.identifier, item.description].join(' ').toLowerCase().includes(value))
})

function propertyActionTypes(item: RealtimePropertyRow) {
  const type = item.expands?.type
  return Array.isArray(type) ? type : []
}

function canReadProperty(item: RealtimePropertyRow) {
  return propertyActionTypes(item).includes('read')
}

function canWriteProperty(item: RealtimePropertyRow) {
  return propertyActionTypes(item).includes('write')
}

function propertyAccessMode(item: RealtimePropertyRow) {
  const readable = canReadProperty(item)
  const writable = canWriteProperty(item)
  if (readable && writable) return 'rw'
  if (writable) return 'write'
  if (readable) return 'read'
  return 'report'
}

function propertyAccessText(item: RealtimePropertyRow) {
  const mode = propertyAccessMode(item)
  if (mode === 'rw') return $t('IotDeviceDetail.commandCenter.access.rw')
  if (mode === 'write') return $t('IotDeviceDetail.commandCenter.access.write')
  if (mode === 'read') return $t('IotDeviceDetail.commandCenter.access.read')
  return $t('IotDeviceDetail.commandCenter.access.report')
}

function commandIcon(command: IotDeviceCommandDefinition) {
  if (command.category === 'security') return 'SafetyOutlined'
  if (command.category === 'maintenance') return 'ToolOutlined'
  if (command.category === 'query') return 'SearchOutlined'
  return 'ReloadOutlined'
}

function commandCallModeText(command: IotDeviceCommandDefinition) {
  return command.callMode === 'async'
    ? $t('IotDeviceDetail.commands.callMode.async')
    : $t('IotDeviceDetail.commands.callMode.sync')
}

function commandInputSummary(command: IotDeviceCommandDefinition) {
  return command.inputParams.length
    ? commandParameterNames(command.inputParams)
    : $t('IotDeviceDetail.commands.noInputParams')
}

function commandParameterNames(params: IotDeviceCommandDefinition['inputParams']) {
  return params.map((param) => param.name || param.key).join('、')
}

function commandParameterTooltip(params: IotDeviceCommandDefinition['inputParams']) {
  return params
    .map((param) => `${param.name || param.key}(${param.key})-${commandParamTypeLabel(param.type)}`)
    .join('；')
}

function commandParamTypeLabel(type: IotDeviceCommandDefinition['inputParams'][number]['type']) {
  return $t(`IotDeviceDetail.commands.paramTypeText.${type}`)
}

function hasCommandOutput(command: IotDeviceCommandDefinition) {
  return command.callMode === 'sync' && command.outputParams.length > 0
}

function openInvoke(command: IotDeviceCommandDefinition) {
  activeCommand.value = command
  invokeOpen.value = true
}

function onExecuteCommand(commandId: string, params: Record<string, any>) {
  emit('execute', commandId, params)
}

function handleKeywordSearch(value: string, event?: MouseEvent | KeyboardEvent) {
  keyword.value = String(value || '')
}

</script>

<style scoped src="./IotDeviceCommandCenterTab.css"></style>
