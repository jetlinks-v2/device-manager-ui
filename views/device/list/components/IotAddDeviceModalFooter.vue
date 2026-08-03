<template>
  <a-space>
	  <a-button @click="$emit('close')">{{ $t('IotDeviceList.action.cancel') }}</a-button>
	  <a-button v-if="showPrevious" @click="$emit('previous')">
		  {{ $t('IotDeviceList.add.prev') }}
	  </a-button>
	  <a-tooltip v-if="showExtraSubmit" :title="extraSubmitDisabled ? extraSubmitTooltip : ''">
    <span class="add-device-footer__tooltip-anchor">
      <a-button
	      :loading="extraBusy"
	      :disabled="extraSubmitDisabled"
	      @click="$emit('extra-submit')"
      >
        <template #icon>
          <AIcon type="SyncOutlined" aria-hidden="true" />
        </template>
        {{ extraSubmitText }}
      </a-button>
    </span>
	  </a-tooltip>
	  <a-button type="primary" :loading="busy" :disabled="submitDisabled" @click="$emit('submit')">
		  <template #icon>
			  <AIcon type="CheckOutlined" aria-hidden="true" />
		  </template>
		  {{ submitText }}
	  </a-button>
  </a-space>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps({
  showPrevious: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  submitDisabled: { type: Boolean, default: false },
  submitText: { type: String, required: true },
  showExtraSubmit: { type: Boolean, default: false },
  extraBusy: { type: Boolean, default: false },
  extraSubmitDisabled: { type: Boolean, default: false },
  extraSubmitText: { type: String, default: '' },
  extraSubmitTooltip: { type: String, default: '' },
})

defineEmits<{
  (e: 'close'): void
  (e: 'previous'): void
  (e: 'submit'): void
  (e: 'extra-submit'): void
}>()

const { t: $t } = useI18n()
</script>

<style scoped>
.add-device-footer__tooltip-anchor {
  display: inline-block;
}
</style>
