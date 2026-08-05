<template>
  <div class="card-container">
    <config-item :label="$t('DeviceList.Config.100034-0')" labelWidth="90">
      <a-switch
        v-model:checked="config.showDeviceType"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('DeviceList.Config.100034-1')" labelWidth="90">
      <a-switch
        v-model:checked="config.showOnlineStatus"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('DeviceList.Config.100034-2')" labelWidth="90">
      <a-switch
        v-model:checked="config.showActiveTime"
        @change="onChange"
      />
    </config-item>
    <!-- <config-item label="告警状态">
      <a-switch
        v-model:checked="config.showAlarmStatus"
        @change="onChange"
      />
    </config-item> -->
    <!-- <config-item label="关联属性">
      <a-switch
        v-model:checked="config.showRelatedProps"
        @change="onChange"
      />
    </config-item> -->
    <config-item :label="$t('DeviceList.Config.100034-3')" labelWidth="90">
      <a-radio-group
        v-model:value="config.tableSize"
        button-style="solid"
        @change="onChange"
        style="width: 300px; display: flex"
      >
        <a-radio-button
          value="large"
          style="flex: 1; text-align: center"
        >
          {{ $t('DeviceList.Config.100034-4') }}
        </a-radio-button>
        <a-radio-button
          value="middle"
          style="flex: 1; text-align: center"
        >
          {{ $t('DeviceList.Config.100034-5') }}
        </a-radio-button>
        <a-radio-button
          value="small"
          style="flex: 1; text-align: center"
        >
          {{ $t('DeviceList.Config.100034-6') }}
        </a-radio-button>
      </a-radio-group>
    </config-item>
    <config-item :label="$t('DeviceList.Config.100034-7')" labelWidth="90">
      <a-switch
        v-model:checked="config.showColumnDivider"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('DeviceList.Config.100034-8')" labelWidth="90">
      <ColorPicker
        v-model:value="config.selectedRowBgColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('DeviceList.Config.100034-9')" labelWidth="90">
      <a-switch
        v-model:checked="config.selectFirstByDefault"
        @change="onChange"
      />
      <template #tip>{{ $t('DeviceList.Config.100034-10') }}</template>
    </config-item>
  </div>
</template>

<script lang="ts" setup>
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep, throttle } from 'lodash-es'
import { useI18n } from 'vue-i18n'

const { ConfigItem, ColorPicker } = moduleRegistry.getResource('visualization-designer-ui', 'components')
const { t: $t } = useI18n()

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  },
  type: {
    type: String,
    default: 'deviceList'
  }
})

const emits = defineEmits(['change'])
const config = ref<any>({})

const emitChange = throttle(() => {
  emits('change', config.value, props.type)
}, 20)

const onChange = () => {
  emitChange()
}

watch(
  () => props.configData?.componentProps?.[props.type],
  (newVal) => {
    if (newVal) {
      config.value = cloneDeep(newVal)
    }
  },
  { deep: true, immediate: true }
)
</script>

<style lang="less" scoped>
.card-container {
  color: #fff;
  gap: 12px;
  display: flex;
  flex-direction: column;
}
</style>
