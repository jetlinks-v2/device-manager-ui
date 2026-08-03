<template>
  <a-modal
    :open="open"
    :title="title"
    :ok-text="$t('DeviceAlarm.record.confirm')"
    :cancel-text="$t('DeviceAlarm.action.cancel')"
    :confirm-loading="loading"
    :ok-button-props="{ disabled: readonly }"
    destroy-on-close
    @ok="handleSubmit"
    @cancel="close"
  >
    <a-form ref="formRef" layout="vertical" :model="form" :rules="rules">
      <a-form-item :label="$t('DeviceAlarm.record.handleDescription')" name="describe">
        <a-textarea
          v-model:value="form.describe"
          :disabled="readonly"
          :rows="6"
          :maxlength="200"
          show-count
          :placeholder="$t('DeviceAlarm.record.handleDescriptionPlaceholder')"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'

const props = defineProps<{
  open: boolean
  record?: Record<string, any> | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'success'): void
}>()

const { t: $t } = useI18n()
const loading = ref(false)
const formRef = ref()
const form = reactive({ describe: '' })
const title = computed(() => (props.readonly ? $t('DeviceAlarm.record.detail') : $t('DeviceAlarm.record.handle')))
const rules = computed(() => ({
  describe: [{ required: !props.readonly, message: $t('DeviceAlarm.record.handleDescriptionPlaceholder') }],
}))

watch(
  () => [props.open, props.record?.id, props.readonly] as const,
  async ([open]) => {
    if (!open) return
    form.describe = props.readonly ? await loadLatestHandleDescription() : ''
  },
  { immediate: true },
)

async function loadLatestHandleDescription() {
  const recordId = String(props.record?.id ?? '')
  if (!recordId) return ''
  const resp: any = await iotDeviceDetailRealApi.queryAlarmHandleHistory(recordId, {
    sorts: [{ name: 'handleTime', order: 'desc' }],
    terms: [{ column: 'alarmRecordId', termType: 'eq', value: recordId }],
  })
  const row = resp?.result?.data?.[0]
  return row?.description || row?.describe || ''
}

async function handleSubmit() {
  if (props.readonly) {
    close()
    return
  }
  await formRef.value?.validate()
  loading.value = true
  try {
    const record = props.record ?? {}
    await iotDeviceDetailRealApi.handleAlarmByDevice({
      describe: form.describe,
      type: 'user',
      state: 'normal',
      alarmRecordId: record.id || '',
      alarmConfigId: record.alarmConfigId || '',
      alarmTime: record.alarmTime || '',
    })
    message.success($t('DeviceAlarm.record.handleSuccess'))
    emit('success')
    close()
  } finally {
    loading.value = false
  }
}

function close() {
  emit('update:open', false)
}
</script>
