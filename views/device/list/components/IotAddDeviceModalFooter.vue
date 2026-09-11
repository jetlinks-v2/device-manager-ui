<template>
  <a-space>
	  <a-button @click="$emit('close')">{{ $t('IotDeviceList.action.cancel') }}</a-button>
	  <a-button v-if="showPrevious" @click="$emit('previous')">
		  {{ previousText || $t('IotDeviceList.add.prev') }}
	  </a-button>
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
  previousText: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  submitDisabled: { type: Boolean, default: false },
  submitText: { type: String, required: true },
})

defineEmits<{
  (e: 'close'): void
  (e: 'previous'): void
  (e: 'submit'): void
}>()

const { t: $t } = useI18n()
</script>
