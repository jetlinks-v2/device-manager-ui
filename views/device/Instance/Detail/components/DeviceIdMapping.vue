<template>
  <span v-if="isPluginGateway" class="device-id-mapping">
    <a-tooltip>
      <template #title>
        <p v-if="loading">{{ $t('DeviceIdMapping.loading') }}</p>
        <p v-else-if="loadFailed">{{ $t('DeviceIdMapping.loadFailed') }}</p>
        <template v-else><p v-if="iconOnly">{{ mappingStatus }}</p><p v-if="inklingDeviceId">{{ $t('DeviceIdMapping.externalId', { id: inklingDeviceId }) }}</p><p v-if="!iconOnly">{{ $t('Info.index.208636-3') }}</p><span v-if="!inklingDeviceId">{{ $t('Info.index.208636-4') }}</span></template>
      </template>
      <a-button
        v-if="canUpdate"
        :type="iconOnly ? 'text' : buttonType"
        size="small"
        class="device-id-mapping__trigger"
        :class="{ 'device-id-mapping__trigger--inline': !iconOnly && buttonType === 'link', 'device-id-mapping__indicator': iconOnly }"
        :data-state="mappingState"
        :loading="!iconOnly && loading"
        :aria-busy="loading || undefined"
        :aria-label="$t('DeviceIdMapping.accessibleLabel', { status: iconOnly ? mappingStatus : mappingLabel })"
        @click="openInklingModal"
      >
        <template #icon><SkeletonText v-if="iconOnly && loading" :width="12" :height="12" /><AIcon v-else :style="iconOnly ? { transform:'none' } : undefined" :type="iconOnly ? mappingIcon : 'LinkOutlined'" aria-hidden="true" /></template>
        <span v-if="!iconOnly">{{ mappingLabel }}</span>
      </a-button>
      <span v-else-if="iconOnly" class="device-id-mapping__indicator" :data-state="mappingState" role="img" :aria-label="$t('DeviceIdMapping.accessibleLabel', { status: mappingStatus })" tabindex="0"><SkeletonText v-if="loading" :width="12" :height="12" /><AIcon v-else style="transform:none" :type="mappingIcon" aria-hidden="true" /></span>
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
import SkeletonText from '@jetlinks-web-core/components/SkeletonText'

const props = withDefaults(defineProps<DeviceIdMappingProps & { buttonType?: 'link' | 'text'; iconOnly?: boolean }>(), { canUpdate: true, buttonType: 'link', iconOnly:false })
const emit = defineEmits<{ saved: [deviceId: string] }>()
const { t: $t } = useI18n()
const { target, isPluginGateway, inkingVisible, inklingDeviceId, channelId, loading, loadFailed, openInklingModal, saveInkling } = useDeviceIdMapping(props, id => emit('saved', id))
// ID 相同时可不配置映射；入口使用操作名称，避免将缺省映射显示为接入异常。
const mappingLabel = computed(() => $t(inklingDeviceId.value ? 'Info.index.208636-6' : 'DeviceIdMapping.action'))
const mappingState = computed(() => loading.value ? 'loading' : loadFailed.value ? 'error' : inklingDeviceId.value ? 'mapped' : 'unmapped')
const mappingStatus = computed(() => $t(loading.value ? 'DeviceIdMapping.loading' : loadFailed.value ? 'DeviceIdMapping.loadFailed' : inklingDeviceId.value ? 'Info.index.208636-6' : 'Info.index.208636-5'))
const mappingIcon = computed(() => loadFailed.value ? 'ExclamationCircleOutlined' : inklingDeviceId.value ? 'LinkOutlined' : 'DisconnectOutlined')
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
.device-id-mapping__trigger--inline.ant-btn {
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
.device-id-mapping__indicator { display:inline-flex; flex:none; align-items:center; justify-content:center; width:24px; height:24px; padding:0; border:0; border-radius:4px; color:var(--jet-theme-text-secondary); font-size:12px; line-height:1; }
.device-id-mapping__indicator[data-state="mapped"] { color:var(--jet-theme-primary); }
.device-id-mapping__indicator[data-state="error"] { color:var(--jet-theme-error); }
.device-id-mapping__indicator[aria-busy="true"] { cursor:wait; }
</style>
