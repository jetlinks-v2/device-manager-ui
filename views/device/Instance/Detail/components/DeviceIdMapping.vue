<template>
  <span v-if="isPluginGateway" class="device-id-mapping">
    <a-tooltip>
      <template #title>
        <p v-if="loadFailed">{{ $t('DeviceIdMapping.loadFailed') }}</p>
        <p v-else-if="inklingDeviceId">{{ $t('DeviceIdMapping.externalId', { id: inklingDeviceId }) }}</p>
        <p>{{ $t('Info.index.208636-3') }}</p>
        <span v-if="!inklingDeviceId">{{ $t('Info.index.208636-4') }}</span>
      </template>
      <a-button
        v-if="canUpdate"
        type="link"
        size="small"
        class="device-id-mapping__trigger"
        :loading="loading"
        :aria-label="$t('DeviceIdMapping.accessibleLabel', { status: mappingLabel })"
        @click="openInklingModal"
      >
        <AIcon type="LinkOutlined" aria-hidden="true" />
        <span>{{ mappingLabel }}</span>
      </a-button>
      <span v-else>{{ mappingLabel }}</span>
    </a-tooltip>
    <InkingModal
      v-if="canUpdate && inkingVisible"
      :key="target.id + ':' + target.accessId"
      :id="inklingDeviceId"
      :internal-id="target.id"
      :accessId="target.accessId"
      :pluginId="channelId"
      @cancel="inkingVisible = false"
      @submit="saveInkling"
    />
  </span>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkingModal from '../Info/components/InklingModal'
import { useDeviceIdMapping, type DeviceIdMappingProps } from './useDeviceIdMapping'

const props = withDefaults(defineProps<DeviceIdMappingProps>(), { canUpdate: true })
const emit = defineEmits<{ saved: [deviceId: string] }>()
const { t: $t } = useI18n()
const { target, isPluginGateway, inkingVisible, inklingDeviceId, channelId, loading, loadFailed, openInklingModal, saveInkling } = useDeviceIdMapping(props, id => emit('saved', id))
// ID 相同时可不配置映射；入口使用操作名称，避免将缺省映射显示为接入异常。
const mappingLabel = computed(() => $t(inklingDeviceId.value ? 'Info.index.208636-6' : 'DeviceIdMapping.action'))
</script>

<style lang="less" scoped>
.device-id-mapping {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-width: 0;
  line-height: inherit;
  vertical-align: top;
}
.device-id-mapping__trigger.ant-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0;
  border: 0;
  height: auto;
  font-size: inherit;
  line-height: inherit;
  > span { margin-inline-start: 0; }
}
</style>
