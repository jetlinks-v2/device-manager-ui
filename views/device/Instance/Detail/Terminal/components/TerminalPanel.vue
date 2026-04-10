<template>
  <div class="terminal-wrapper">
    <a-tabs
      v-model:activeKey="activeKey"
      type="editable-card"
      @edit="onEdit"
      :destroyInactiveTabPane="false"
      :animated="false"
      :forceRender="true"
    >
      <a-tab-pane v-for="tab in tabs" :key="tab.key" :tab="tab.title">
        <TerminalSession
          :ref="(el) => setSessionRef(el, tab.key)"
          :device-id="deviceId"
          :online="online"
          :active="activeKey === tab.key"
        />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { randomString } from '@jetlinks-web/utils'
import { closeWs } from '../websocket'
import TerminalSession from './TerminalSession.vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  deviceId: string
  online: boolean
}>()

const { t: $t } = useI18n()

const tabs = ref([{ key: randomString(8), title: `${$t('Terminal.index.remote-0')} 1` }])
const activeKey = ref(tabs.value[0].key)
const sessionRefs = ref<Record<string, any>>({})

const setSessionRef = (el: any, key: string) => {
  if (el) {
    sessionRefs.value[key] = el
  } else {
    delete sessionRefs.value[key]
  }
}

const fitActiveSession = () => {
  const ref = sessionRefs.value[activeKey.value]
  ref?.fitTerminal?.()
}

const fitAfterVisible = () => {
  nextTick(() => {
    fitActiveSession()
    requestAnimationFrame(() => fitActiveSession())
    setTimeout(() => fitActiveSession(), 80)
  })
}

defineExpose({
  fitActiveSession,
  fitAfterVisible
})

const addTab = () => {
  const nextIndex = tabs.value.length + 1
  const item = { key: randomString(8), title: `${$t('Terminal.index.remote-0')} ${nextIndex}` }
  tabs.value.push(item)
  activeKey.value = item.key
  fitAfterVisible()
}

const removeTab = (targetKey: string) => {
  if (tabs.value.length === 1) return
  const idx = tabs.value.findIndex((tab) => tab.key === targetKey)
  tabs.value = tabs.value.filter((tab) => tab.key !== targetKey)
  if (activeKey.value === targetKey) {
    const next = tabs.value[Math.max(0, idx - 1)] || tabs.value[0]
    activeKey.value = next.key
  }
  fitAfterVisible()
}

const onEdit = (targetKey: string | MouseEvent, action: 'add' | 'remove') => {
  if (action === 'add') {
    addTab()
    return
  }
  if (typeof targetKey === 'string') {
    removeTab(targetKey)
  }
}

onBeforeUnmount(() => {
  // 终端 websocket 使用共享连接，离开组件时统一关闭。
  closeWs()
})

watch(activeKey, () => {
  fitAfterVisible()
})
</script>

<style scoped lang="less">
.terminal-wrapper {
  height: 100%;
}

.terminal-wrapper :deep(.ant-tabs) {
  height: 100%;
}

.terminal-wrapper :deep(.ant-tabs-content-holder) {
  height: 100%;
}

.terminal-wrapper :deep(.ant-tabs-content) {
  height: 100%;
}

.terminal-wrapper :deep(.ant-tabs-tabpane) {
  height: 100%;
  min-height: 0;
}

/* 去重边框：editable-card Tabs 自带 card 边框，避免与外层容器/内容再叠加 */
.terminal-wrapper :deep(.ant-tabs-card) {
  border: none !important;
  box-shadow: none !important;
}

.terminal-wrapper :deep(.ant-tabs-card > .ant-tabs-nav),
.terminal-wrapper :deep(.ant-tabs-card > .ant-tabs-content-holder) {
  border: none !important;
  background: transparent !important;
}

.terminal-wrapper :deep(.ant-tabs-card .ant-tabs-tabpane) {
  background: transparent !important;
}

/* 单一分隔线，避免双线 */
.terminal-wrapper :deep(.ant-tabs-card > .ant-tabs-nav::before) {
  border-bottom: none !important;
}

/* 优化 editable-card tab 尺寸/间距（减少顶部留白、让 tab 更紧凑） */
.terminal-wrapper :deep(.ant-tabs-card > .ant-tabs-nav) {
  margin-bottom: 0;
}

.terminal-wrapper :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-nav-list) {
  gap: 0;
}

.terminal-wrapper :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab) {
  padding: 6px 14px !important;
  margin-right: 0 !important;
  height: 30px !important;
  line-height: 22px !important;
  border-radius: 8px 8px 0 0;
  border: none !important;
  background: rgba(250, 250, 250, 0.65) !important;
  box-shadow: inset 0 -1px 0 #f0f0f0 !important;
}

.terminal-wrapper :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-btn) {
  font-size: 14px !important;
}

.terminal-wrapper :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-nav-add) {
  padding: 0 !important;
  width: 32px !important;
  height: 30px !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  margin-right: 0 !important;
  border: none !important;
}

/* 激活态：只用底部内描边区分，避免双线/叠边 */
.terminal-wrapper :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active) {
  background: #fff !important;
  border: none !important;
  box-shadow: inset 0 -2px 0 #1677ff !important;
  position: relative;
  z-index: 1;
}

.terminal-wrapper :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #1677ff !important;
}
</style>
