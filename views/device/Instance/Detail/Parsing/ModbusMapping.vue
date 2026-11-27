<template>
<div class="mm-wrap" :class="{ 'mm-locale-en': locale.startsWith('en') }">
    <div ref="mmMainResizeRef" class="mm-main">
      <!-- ===== 左侧：映射表格 ===== -->
      <MappingTable :model="mappingView" :style="{ width: leftMainPercent + '%' }" />

      <div
        class="mm-splitter"
        :title="t('ModbusMapping.ui.resize')"
        role="separator"
        aria-orientation="vertical"
        @mousedown.prevent="onMmMainSplitterMouseDown"
      />

      <!-- ===== 右侧：调试（sticky，不随页面滚动离开视区） ===== -->
      <aside class="mm-main-right">
    <div class="mm-debug">
      <DeviceDetailTabs size="small">
        <a-tab-pane key="decode" :tab="t('ModbusMapping.ui.decodeTab')">
          <DecodePanel :model="decodeView" />
        </a-tab-pane>

        <a-tab-pane key="encode" :tab="t('ModbusMapping.ui.encodeTab')">
          <EncodePanel :model="encodeView" />
        </a-tab-pane>
      </DeviceDetailTabs>
    </div>
      </aside>
    </div>

    <!-- ===== Config Drawer ===== -->
    <MappingDrawer :model="mappingView" />

    <FillMappingModal :model="fillView" />
  </div>
</template>
<script setup lang="ts">
import DeviceDetailTabs from '@device-manager-ui/views/device/components/DeviceDetailTabs.vue'
import { useI18n } from 'vue-i18n'
import { useModbusMapping } from './modbus/useModbusMapping'
import MappingTable from './modbus/mapping/MappingTable.vue'
import MappingDrawer from './modbus/mapping/MappingDrawer.vue'
import DecodePanel from './modbus/debug/DecodePanel.vue'
import EncodePanel from './modbus/debug/EncodePanel.vue'
import FillMappingModal from './modbus/debug/FillMappingModal.vue'

defineOptions({ name: 'ModbusMapping' })
const props = defineProps<{ thingId?: string; productId?: string }>()
const { t, locale } = useI18n()
const { mappingView, decodeView, encodeView, fillView, splitLayout, mappingConfiguration, mappingEditor, reloadConfig } =
  useModbusMapping(props)
const { mmMainResizeRef, leftMainPercent, onMmMainSplitterMouseDown } = splitLayout
const { saveConfig, loading, saving, confirmLeave } = mappingConfiguration
const { addMapping } = mappingEditor
defineExpose({ loadConfig: reloadConfig, saveConfig, addMapping, loading, saving, confirmLeave })
</script>
<style scoped lang="less" src="./modbus/layout.less" />
<style lang="less" src="./modbus/mapping/dropdown.less" />
<style lang="less" src="./modbus/responsive.less" />
