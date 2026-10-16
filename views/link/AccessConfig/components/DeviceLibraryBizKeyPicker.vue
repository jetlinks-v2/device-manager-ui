<template>
  <a-form-item v-if="available" name="bizKey" :label="label">
    <a-input
      class="biz-key-input"
      :value="modelValue"
      :placeholder="placeholder"
      @update:value="emit('update:modelValue', $event)"
    />
  </a-form-item>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { probeDeviceLibraryCapability_api } from '@device-manager-ui/api/device-library'

defineProps({
  modelValue: { type: String, default: '' },
  provider: { type: String, required: true },
})

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
const { t } = useI18n()
const available = ref(false)

const label = computed(() => t('AccessConfig.bizKey.label'))
const placeholder = computed(() => t('AccessConfig.bizKey.placeholder'))

onMounted(async () => {
  try {
    available.value = await probeDeviceLibraryCapability_api()
  } catch {
    // 未部署或不可访问设备库时隐藏入口，已有业务标识仍由父表单原样保存。
    available.value = false
  }
})
</script>

<style scoped lang="less">
.biz-key-input {
  width: 240px;
}
</style>
