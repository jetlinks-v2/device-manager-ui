<template>
<div class="mm-main-left">
        <div class="mm-link-type-bar">
          <span class="mm-link-type-lbl">{{ t('ModbusMapping.ui.linkType') }}</span>
          <a-radio-group v-model:value="modbusLinkType" size="small" button-style="solid">
            <a-radio-button value="PDU">PDU</a-radio-button>
            <a-radio-button value="TCP">TCP</a-radio-button>
            <a-radio-button value="RTU">RTU</a-radio-button>
          </a-radio-group>
          <span class="mm-link-type-hint">{{ t('ModbusMapping.ui.linkHint') }}</span>
        </div>
        <div ref="tableScrollEl" class="mm-table-scroll">
      <a-table
        :data-source="mappings"
        :columns="columns"
        :pagination="false"
        size="small"
        :loading="loading"
        :scroll="{ x: 872, y: tableBodyScrollY }"
        class="mm-table"
        :row-key="(_: unknown, index?: number) => index!"
      >
      <template #headerCell="{ column }">
        <template v-if="column.key === 'action'">
          <div class="mm-action-header">
            <span class="mm-action-header-title">{{ t('ModbusMapping.ui.actions') }}</span>
            <a-button type="link" size="small" class="mm-action-header-add" @click.stop="addMapping">
              <template #icon><PlusOutlined /></template>{{ " " + t('ModbusMapping.ui.addPoint') + " " }}</a-button>
          </div>
        </template>
      </template>
      <template #bodyCell="{ column, record, index }">
        <!-- 属性：下方展示物模型说明 + 读写标签（与 Modbus 区功能码是否支持读/写校验） -->
        <template v-if="column.key === 'property'"><PropertyField :model="model" :record="record as ModbusSimpleMapping" :index="index" /></template>

        <!-- 寄存器地址 -->
        <template v-else-if="column.key === 'register'"><RegisterField :model="model" :record="record as ModbusSimpleMapping" /></template>

        <!-- 解析：类型 + 布局同一行；缩放/小数在下方（与抽屉一致逻辑） -->
        <template v-else-if="column.key === 'codecLayout'"><CodecFields :model="model" :record="record as ModbusSimpleMapping" /></template>

        <!-- 操作 -->
        <template v-else-if="column.key === 'action'">
          <a-space :size="0">
            <a-tooltip :title="t('ModbusMapping.ui.edit')">
              <a-button type="link" size="small" @click="openDrawer(record as ModbusSimpleMapping, index)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip :title="t('ModbusMapping.ui.copy')">
              <a-button type="link" size="small" @click="copyMapping(index)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-popconfirm
              :title="t('ModbusMapping.ui.deleteConfirm')"
              :ok-text="t('ModbusMapping.ui.delete')"
              :cancel-text="t('ModbusMapping.ui.cancel')"
              @confirm="removeMapping(index)"
            >
              <a-button type="link" size="small" danger>
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>

      <template #emptyText>
        <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t('ModbusMapping.ui.noMappings')">
          <a-button size="small" type="primary" @click="addMapping">{{ t('ModbusMapping.ui.addPoint') }}</a-button>
        </a-empty>
      </template>
      </a-table>
        </div>
      </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusMappingView } from '../useModbusMapping'
import type { ModbusSimpleMapping } from '../types'
import { PlusOutlined, DeleteOutlined, EditOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { Empty } from 'ant-design-vue'
import PropertyField from './PropertyField.vue'
import RegisterField from './RegisterField.vue'
import CodecFields from './CodecFields.vue'
const props = defineProps<{
  model: Pick<
    ModbusMappingView,
    | 'focusedPropertyIndex'
    | 'columns'
    | 'onPropertyInputBlur'
    | 'onPropertyAcUpdate'
    | 'onTableScaleFactorChange'
    | 'onTableScaleChange'
    | 'onCodecChange'
    | 'onRegisterStrChange'
    | 'openDrawer'
    | 'addMapping'
    | 'removeMapping'
    | 'copyMapping'
    | 'getPropertyUiMeta'
    | 'propertyOptions'
    | 'getPropNameById'
    | 'isPropertyNotInThingModel'
    | 'filterPropertyACOption'
    | 'doParseRegisterStr'
    | 'isHoldingWordBitSlice'
    | 'getRegisterHintData'
    | 'shortCodecLabel'
    | 'getCodecOptionsForCount'
    | 'getCodecFilterHint'
    | 'isNumericCodec'
    | 'layoutShortLabel'
    | 'getLayoutOptions'
    | 'tableScrollEl'
    | 'tableBodyScrollY'
    | 'mappings'
    | 'loading'
    | 'modbusLinkType'
  >
}>()
const model = props.model
const {
  columns,
  openDrawer,
  addMapping,
  removeMapping,
  copyMapping,
  tableScrollEl,
  tableBodyScrollY,
  mappings,
  loading,
  modbusLinkType
} = toRefs(model)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./MappingTable.less" />
