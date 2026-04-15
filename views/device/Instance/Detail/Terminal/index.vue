<template>
  <div class="remote-access-wrap">
    <div class="remote-access-side">
      <a-menu
        v-model:selectedKeys="modeSelectedKeys"
        mode="inline"
        class="mode-menu"
        @select="onModeSelect"
      >
        <a-menu-item key="terminal">
          <AIcon type="CodeOutlined" />
          <span>{{ $t('Terminal.index.remote-0') }}</span>
          <a-tooltip :title="$t('Terminal.index.remote-22')">
            <AIcon type="QuestionCircleOutlined" class="mode-help-icon" />
          </a-tooltip>
        </a-menu-item>
        <a-menu-item key="browser">
          <AIcon type="GlobalOutlined" />
          <span>{{ $t('Terminal.index.remote-1') }}</span>
          <a-tooltip :title="$t('Terminal.index.remote-23')">
            <AIcon type="QuestionCircleOutlined" class="mode-help-icon" />
          </a-tooltip>
        </a-menu-item>
        <a-menu-item key="remoteDesktop">
          <AIcon type="DesktopOutlined" />
          <span>{{ $t('Terminal.index.remote-24') }}</span>
          <a-tooltip :title="$t('Terminal.index.remote-25')">
            <AIcon type="QuestionCircleOutlined" class="mode-help-icon" />
          </a-tooltip>
        </a-menu-item>
        <a-menu-item key="fileManager">
          <AIcon type="FolderOpenOutlined" />
          <span>{{ $t('Terminal.index.remote-99') }}</span>
          <a-tooltip :title="$t('Terminal.index.remote-100')">
            <AIcon type="QuestionCircleOutlined" class="mode-help-icon" />
          </a-tooltip>
        </a-menu-item>
        <a-menu-item key="networkDebug">
          <AIcon type="ApiOutlined" />
          <span>{{ $t('Terminal.index.remote-59') }}</span>
          <a-tooltip :title="$t('Terminal.index.remote-60')">
            <AIcon type="QuestionCircleOutlined" class="mode-help-icon" />
          </a-tooltip>
        </a-menu-item>
      </a-menu>
    </div>
    <div class="remote-access-main">
      <TerminalPanel
        ref="terminalPanelRef"
        v-show="accessMode === 'terminal'"
        :device-id="current?.id || ''"
        :online="current?.state?.value === 'online'"
      />
      <BrowserPanel v-show="accessMode === 'browser'" :device-id="current?.id || ''" />
      <RemoteDesktopPanel
        v-show="accessMode === 'remoteDesktop'"
        :device-id="current?.id || ''"
        :online="current?.state?.value === 'online'"
      />
      <FileManagerPanel
        v-show="accessMode === 'fileManager'"
        :device-id="current?.id || ''"
        :online="current?.state?.value === 'online'"
      />
      <NetworkDebugPanel
        v-show="accessMode === 'networkDebug'"
        :device-id="current?.id || ''"
        :online="current?.state?.value === 'online'"
      />
    </div>
  </div>
</template>

<script setup lang="ts" name="Terminal">
import { useInstanceStore } from "../../../../../store/instance";
import { storeToRefs } from "pinia";
import TerminalPanel from "./components/TerminalPanel.vue";
import BrowserPanel from "./components/BrowserPanel.vue";
import RemoteDesktopPanel from "./components/RemoteDesktopPanel.vue";
import FileManagerPanel from "./components/FileManagerPanel.vue";
import NetworkDebugPanel from "./components/NetworkDebugPanel.vue";

const instanceStore = useInstanceStore();
const { current } = storeToRefs(instanceStore);
const accessMode = ref<'terminal' | 'browser' | 'remoteDesktop' | 'fileManager' | 'networkDebug'>('terminal')
const modeSelectedKeys = ref<string[]>(['terminal'])
const terminalPanelRef = ref<any>()

const onModeSelect = ({ key }: { key: string }) => {
  accessMode.value = key as 'terminal' | 'browser' | 'remoteDesktop' | 'fileManager' | 'networkDebug'
}

watch(accessMode, (val) => {
  modeSelectedKeys.value = [val]
  if (val === 'terminal') {
    terminalPanelRef.value?.fitAfterVisible?.()
  }
})
</script>

<style scoped lang="less">
.remote-access-wrap {
  height: 100%;
  display: flex;
  gap: 0;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  border-right: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  overflow: hidden;
}

.remote-access-side {
  width: 180px;
  flex: 0 0 180px;
  padding-top: 10px;
  padding-left: 12px;
  padding-right: 12px;
  border-right: none;
  position: relative;
}

.remote-access-side::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 1px;
  height: 100%;
  background: #f0f0f0;
  pointer-events: none;
}

.mode-menu {
  border-inline-end: none !important;
}

.mode-help-icon {
  margin-left: 6px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
}

.remote-access-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* 选中项融入左侧面板：蓝色底色 + 左内描边，不与菜单整体边界割裂 */
.mode-menu :deep(.ant-menu-item) {
  border-radius: 0;
}

.mode-menu :deep(.ant-menu-item-selected) {
  background: rgba(22, 119, 255, 0.08) !important;
  box-shadow: inset 3px 0 0 rgba(22, 119, 255, 0.85);
  margin-right: -1px !important; /* 覆盖分割线，避免割裂感 */
  padding-right: 0 !important;
}
</style>
