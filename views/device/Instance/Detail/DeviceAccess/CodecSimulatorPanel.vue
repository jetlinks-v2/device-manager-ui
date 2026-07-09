<template>
  <div class="codec-simulator-panel">
    <div ref="simulatorContainerRef" class="codec-simulator-panel__main">
      <div v-if="list.length === 0" class="codec-simulator-panel__empty">
        <div class="codec-simulator-panel__empty-actions">
          <div class="codec-simulator-panel__add-card uplink" @click="handleAdd('uplink')">
            <AIcon type="PlusCircleOutlined" />
            <span>{{ $t('InstanceDeviceAccess.codecDebug.addUplink') }}</span>
          </div>
          <div class="codec-simulator-panel__add-card downlink" @click="handleAdd('downlink')">
            <AIcon type="PlusCircleOutlined" />
            <span>{{ $t('InstanceDeviceAccess.codecDebug.addDownlink') }}</span>
          </div>
        </div>
      </div>

      <template v-else>
        <CodecSimulatorItem
          v-for="(item, index) in list"
          :key="item.id"
          v-model="list[index]"
          :type="item.type"
          @delete="handleDelete(index)"
          @send="handleSend"
          @move-up="handleMove(index, -1)"
          @move-down="handleMove(index, 1)"
        />
        <div class="codec-simulator-panel__footer">
          <div class="codec-simulator-panel__footer-btn uplink" @click="handleAdd('uplink')">
            <AIcon type="PlusOutlined" />
            {{ $t('InstanceDeviceAccess.codecDebug.addUplinkShort') }}
          </div>
          <div class="codec-simulator-panel__footer-btn downlink" @click="handleAdd('downlink')">
            <AIcon type="PlusOutlined" />
            {{ $t('InstanceDeviceAccess.codecDebug.addDownlinkShort') }}
          </div>
        </div>
      </template>
    </div>

    <aside class="codec-simulator-panel__log">
      <div class="codec-simulator-panel__log-header">
        <AIcon type="RightOutlined" />
        {{ $t('InstanceDeviceAccess.codecDebug.executionLog') }}
      </div>
      <div class="codec-simulator-panel__log-body">
        <div v-if="logs.length === 0" class="codec-simulator-panel__log-empty">
          <AIcon type="MessageOutlined" />
          <p>{{ $t('InstanceDeviceAccess.codecDebug.noLogs') }}</p>
        </div>
        <div v-else>
          <div v-for="(log, index) in logs" :key="index" :class="['codec-simulator-panel__log-item', log.type]">
            <span>{{ log.time }}</span>
            <span>{{ log.text }}</span>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useInstanceStore } from '../../../../../store/instance'
import CodecSimulatorItem from './CodecSimulatorItem.vue'
import { useCodecSimulator } from './composables/useCodecSimulator'

const { t: $t } = useI18n()
const instanceStore = useInstanceStore()

const {
  list,
  logs,
  simulatorContainerRef,
  handleAdd,
  handleDelete,
  handleMove,
  handleSend,
  reset,
  fillData,
} = useCodecSimulator(instanceStore, $t)

defineExpose({ reset, fillData })
</script>

<style scoped lang="less">
.codec-simulator-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 4px;
  background: #f0f2f5;
}

.codec-simulator-panel__main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 24px;
}

.codec-simulator-panel__empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.codec-simulator-panel__empty-actions {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.codec-simulator-panel__add-card {
  display: flex;
  width: 380px;
  height: 80px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s;
}

.codec-simulator-panel__add-card.uplink,
.codec-simulator-panel__footer-btn.uplink {
  color: #1890ff;
  border-color: #91d5ff;
}

.codec-simulator-panel__add-card.downlink,
.codec-simulator-panel__footer-btn.downlink {
  color: #722ed1;
  border-color: #d3adf7;
}

.codec-simulator-panel__add-card:hover,
.codec-simulator-panel__footer-btn:hover {
  border-style: solid;
  background: #fff;
}

.codec-simulator-panel__footer {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}

.codec-simulator-panel__footer-btn {
  display: flex;
  flex: 1;
  height: 48px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}

.codec-simulator-panel__log {
  display: flex;
  width: 320px;
  flex-direction: column;
  border-left: 1px solid #f0f0f0;
  background: #fff;
}

.codec-simulator-panel__log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  font-weight: 500;
}

.codec-simulator-panel__log-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.codec-simulator-panel__log-empty {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.25);
}

.codec-simulator-panel__log-empty :deep(.anticon) {
  margin-bottom: 12px;
  font-size: 32px;
}

.codec-simulator-panel__log-item {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}

.codec-simulator-panel__log-item span:first-child {
  min-width: 60px;
  color: rgba(0, 0, 0, 0.45);
}

.codec-simulator-panel__log-item span:last-child {
  color: rgba(0, 0, 0, 0.65);
  word-break: break-all;
}

.codec-simulator-panel__log-item.success span:last-child {
  color: #52c41a;
}

.codec-simulator-panel__log-item.warn span:last-child {
  color: #faad14;
}

.codec-simulator-panel__log-item.process span:last-child {
  color: #1890ff;
}

.codec-simulator-panel__log-item.operation span:last-child {
  color: #4f84ff;
}
</style>
