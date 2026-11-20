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
            <DeviceDetailTabs v-model:active-key="activePane" class="command-panel__tabbar">

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
            </DeviceDetailTabs>
            <a-input-search
              class="command-panel__search"
              allow-clear
              :placeholder="$t('IotDeviceDetail.commandCenter.searchPlaceholder')"
              @search="handleKeywordSearch"
            />

          </header>

          <div v-if="activePane === 'property'" class="runtime-list">
            <article v-for="item in filteredProperties" :key="item.id" class="runtime-row">
            <span class="runtime-row__badge" :data-mode="propertyAccessMode(item)">
              {{ propertyAccessText(item) }}
            </span>
              <div class="runtime-row__body">
                <a-tooltip :title="item.name"><strong class="runtime-row__name">{{ item.name }}</strong></a-tooltip>
                <a-tooltip :title="item.identifier"><small class="runtime-row__identifier">{{ item.identifier }}</small></a-tooltip>
              </div>
              <a-tooltip :title="propertyTypeLabel(item)"><span class="runtime-row__type">{{ propertyTypeLabel(item) }}</span></a-tooltip>
              <div class="runtime-row__value">
                <a-tooltip :title="item.value"><strong>{{ item.value }}</strong></a-tooltip>
              </div>
              <div class="runtime-row__actions">
                <a-tooltip :title="propertyActionHint(item, 'read')">
                  <span>
                    <a-button :disabled="!canReadProperty(item)" size="small" @click="openRead(item)">
                      {{ $t('IotDeviceDetail.commandCenter.read') }}
                    </a-button>
                  </span>
                </a-tooltip>
                <a-tooltip :title="propertyActionHint(item, 'write')">
                  <span>
                    <a-button :disabled="!canWriteProperty(item)" type="primary" size="small" @click="openWrite(item)">
                      {{ $t('IotDeviceDetail.commandCenter.write') }}
                    </a-button>
                  </span>
                </a-tooltip>
              </div>
            </article>
            <CloudEmpty v-if="!filteredProperties.length" :description="$t('IotDeviceDetail.commandCenter.noProperties')" />
          </div>

          <div v-else class="runtime-list">
            <article v-for="command in filteredCommands" :key="command.id" class="runtime-row runtime-row--function">
              <span class="runtime-row__badge" :data-mode="command.callMode">{{ commandCallModeText(command) }}</span>
              <div class="runtime-row__body">
                <a-tooltip :title="command.description ? command.name + '：' + command.description : command.name"><strong class="runtime-row__name">{{ command.name }}</strong></a-tooltip>
                <a-tooltip :title="command.identifier"><small class="runtime-row__identifier">{{ command.identifier }}</small></a-tooltip>
              </div>
              <div class="runtime-row__param runtime-row__param--input">
                <span class="runtime-row__param-label">{{ $t('IotDeviceDetail.commandCenter.inputParameters') }}</span>
                <a-tooltip :title="commandParameterTooltip(command.inputParams)"><span class="runtime-row__param-value">{{ commandInputSummary(command) }}</span></a-tooltip>
              </div>
              <div class="runtime-row__param runtime-row__param--output">
                <span class="runtime-row__param-label">{{ $t('IotDeviceDetail.commandCenter.outputParameters') }}</span>
                <a-tooltip v-if="hasCommandOutput(command)" :title="commandParameterTooltip(command.outputParams)"><span class="runtime-row__param-value">{{ commandParameterNames(command.outputParams) }}</span></a-tooltip>
                <span v-else class="runtime-row__param-value">--</span>
              </div>
              <div class="runtime-row__actions">
                <a-button class="runtime-row__invoke" type="primary" size="small" :disabled="!command.enabled" @click="openInvoke(command)">
                  <template #icon><AIcon type="CodeOutlined" /></template>
                  {{ $t('IotDeviceDetail.commandCenter.invoke') }}
                </a-button>
              </div>
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
              <div class="history-row__identity">
                <span :data-action="row.action">{{ row.actionText }}</span>
                <a-tooltip :title="row.name"><strong class="history-row__name">{{ row.name }}</strong></a-tooltip>
                <a-tooltip :title="row.identifier"><code class="history-row__identifier">{{ row.identifier }}</code></a-tooltip>
              </div>
              <a-tooltip :title="row.time"><time>{{ row.time }}</time></a-tooltip>
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
import DeviceDetailTabs from '@device-manager-ui/views/device/components/DeviceDetailTabs.vue'
import IotDeviceCommandInvokeModal from './IotDeviceCommandInvokeModal.vue'
import IotDevicePropertyReadModal from './IotDevicePropertyReadModal.vue'
import IotDevicePropertyWriteModal from './IotDevicePropertyWriteModal.vue'
import { useI18n } from 'vue-i18n'
import { useCommandCenter, type CommandCenterProps, type CommandCenterEmits } from './useCommandCenter'
const props = defineProps<CommandCenterProps>()
const emit = defineEmits<CommandCenterEmits>()
const { t: $t } = useI18n()
const { propertyTypeLabel, activePane, filteredProperties, filteredCommands, selectedProperty, selectedTone, readOpen, writeOpen, reading, writing, openRead, openWrite, readSelectedProperty, writeSelectedProperty, invokeOpen, activeCommand, historyRows, propertyAccessMode, propertyAccessText, propertyActionHint, canReadProperty, canWriteProperty, commandCallModeText, commandInputSummary, commandParameterNames, commandParameterTooltip, hasCommandOutput, openInvoke, onExecuteCommand, handleKeywordSearch } = useCommandCenter(props, emit)
</script>

<style scoped src="./IotDeviceCommandCenterTab.css"></style>
