<template>
  <section class="add-device-quota-exceeded">
    <header>
      <span><AIcon type="ExclamationCircleOutlined" aria-hidden="true" /></span>
      <div>
        <h4>{{ $t('IotDeviceList.add.quotaExceededTitle') }}</h4>
        <p>{{ $t('IotDeviceList.add.quotaExceededDescription') }}</p>
      </div>
    </header>

    <a-spin :spinning="state.loading">
      <div v-if="hasRuntimeMetric" class="add-device-quota-exceeded__usage">
        <span>{{ state.metricName }}</span>
        <strong>{{ usageText }}</strong>
      </div>
      <p v-else class="add-device-quota-exceeded__unavailable">
        {{ $t('IotDeviceList.add.quotaExceededUnavailable') }}
      </p>
    </a-spin>

    <footer>
      <a-qrcode value="https://www.jetlinks.cn/" :size="96" />
      <div>
        <strong>{{ $t('IotDeviceList.add.quotaExceededContactTitle') }}</strong>
        <p>{{ $t('IotDeviceList.add.quotaExceededContactDescription') }}</p>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IotDeviceQuotaExceededState } from '../hooks/useIotDeviceQuotaExceeded'

const props = defineProps({
  state: {
    type: Object as PropType<IotDeviceQuotaExceededState>,
    required: true,
  },
})

const { t: $t } = useI18n()
const hasRuntimeMetric = computed(() => props.state.usage !== null || props.state.limit !== null)
const usageText = computed(() => {
  const unit = props.state.unit ? ` ${props.state.unit}` : ''
  const usage = props.state.usage ?? '--'
  const limit = props.state.limit === -1 ? $t('IotDeviceList.add.quotaExceededUnlimited') : props.state.limit ?? '--'
  return `${usage} / ${limit}${unit}`
})
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
