<template>
  <div
    v-if="isPluginGateway"
    class="device-id-mapping"
  >
    <a-tooltip>
      <template #title>
        <p class="device-id-mapping__tip">
          {{ inklingDeviceId
            ? $t('DeviceIdMapping.externalId', { id: inklingDeviceId })
            : $t('Info.index.208636-5') }}
        </p>
        <p class="device-id-mapping__tip">{{ $t('Info.index.208636-3') }}</p>
        <span v-if="!inklingDeviceId">{{ $t('Info.index.208636-4') }}</span>
      </template>
      <a-button
        type="link"
        size="small"
        class="device-id-mapping__trigger"
        :aria-label="$t('DeviceIdMapping.accessibleLabel', {
          status: $t(inklingDeviceId ? 'Info.index.208636-6' : 'Info.index.208636-5')
        })"
        @click="openInklingModal"
      >
        <AIcon type="LinkOutlined" aria-hidden="true" />
        <span class="device-id-mapping__label">{{ mappingLabel }}</span>
      </a-button>
    </a-tooltip>
    <InkingModal
      v-if="inkingVisible"
      :id="inklingDeviceId"
      :accessId="instanceStore.current.accessId"
      :pluginId="channelId"
      @cancel="inkingVisible = false"
      @submit="saveInkling"
    />
  </div>
</template>

<script lang="ts" setup>
import { useInstanceStore } from '../../../../../store/instance'
import { detail as queryPluginAccessDetail } from '../../../../../api/link/accessConfig'
import { getPluginData } from '../../../../../api/link/plugin'
import InkingModal from '../Info/components/InklingModal'
import { useI18n } from 'vue-i18n'

type Emit = {
  (e: 'saved'): void
}

const emit = defineEmits<Emit>()
const { t: $t } = useI18n()
const instanceStore = useInstanceStore()
const inkingVisible = ref(false)
const inklingDeviceId = ref<string>()
const channelId = ref<string>()

const isPluginGateway = computed(() => instanceStore.current?.accessProvider === 'plugin_gateway')

// 双方 ID 一致时无需单独映射，未配置状态使用操作名称，避免被理解为接入异常。
const mappingLabel = computed(() => $t(
  inklingDeviceId.value ? 'Info.index.208636-6' : 'DeviceIdMapping.action'
))

const refreshInstance = async () => {
  if (!instanceStore.current?.id) return
  const refreshPromise = instanceStore.refresh(instanceStore.current.id)
  if (refreshPromise && typeof refreshPromise.then === 'function') {
    await refreshPromise
  }
  // 映射保存会影响实例详情；Info 页还需要同步刷新接入身份信息。
  emit('saved')
}

const saveInkling = async () => {
  inkingVisible.value = false
  await refreshInstance()
  await queryInkling()
}

const openInklingModal = async () => {
  if (!channelId.value) {
    await queryInkling()
  }
  inkingVisible.value = true
}

const queryInkling = async () => {
  if (!isPluginGateway.value || !instanceStore.current?.accessId || !instanceStore.current?.id) {
    inklingDeviceId.value = undefined
    channelId.value = undefined
    return
  }

  const res = await queryPluginAccessDetail(instanceStore.current.accessId)
  if (!res.success) return

  channelId.value = res.result?.channelId
  const pluginRes = await getPluginData(
    'device',
    instanceStore.current.accessId,
    instanceStore.current.id
  )
  if (pluginRes.success) {
    inklingDeviceId.value = pluginRes.result?.externalId
  }
}

watch(
  () => [
    instanceStore.current?.id,
    instanceStore.current?.accessId,
    instanceStore.current?.accessProvider
  ],
  () => {
    void queryInkling()
  },
  { immediate: true }
)
</script>

<style lang="less" scoped>
.device-id-mapping {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-width: 0;
}

.device-id-mapping__trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  height: auto;
  font-size: inherit;
  line-height: inherit;

  > .device-id-mapping__label {
    margin-inline-start: 0;
  }
}

.device-id-mapping__tip {
  margin-bottom: 4px;
  overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .device-id-mapping__label {
    display: none;
  }
}
</style>
