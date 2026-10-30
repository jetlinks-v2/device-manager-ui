<template>
  <a-row :gutter="12">
    <a-col :span="12"><a-form-item :label="lowerLabel ?? $t('DeviceAlarm.form.lower')" required>
      <a-input-number :value="lower" :addon-after="unit || undefined" style="width: 100%" @update:value="$emit('update:lower', $event ?? undefined)" />
    </a-form-item></a-col>
    <a-col :span="12"><a-form-item :label="upperLabel ?? $t('DeviceAlarm.form.upper')" required>
      <a-input-number :value="upper" :addon-after="unit || undefined" style="width: 100%" @update:value="$emit('update:upper', $event ?? undefined)" />
    </a-form-item></a-col>
  </a-row>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ lower?: number | null; upper?: number | null; lowerLabel?: string; upperLabel?: string; unit?: string }>()
defineEmits<{ (e: 'update:lower', value: number | undefined): void; (e: 'update:upper', value: number | undefined): void }>()
const { t: $t } = useI18n()
</script>
