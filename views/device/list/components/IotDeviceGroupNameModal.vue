<template>
  <a-modal
    :open="open"
    :title="dialogTitle"
    :confirm-loading="saving"
    :ok-text="$t('IotDeviceList.scope.confirm')"
    :cancel-text="$t('IotDeviceList.scope.cancel')"
    centered
    destroy-on-close
    @update:open="$emit('update:open', $event)"
    @ok="handleSave"
  >
    <a-form layout="vertical">
      <a-form-item :label="$t('IotDeviceList.scope.groupName')" required>
        <a-input
          v-model:value="name"
          :maxlength="128"
          :placeholder="$t('IotDeviceList.scope.groupNamePlaceholder')"
          @press-enter="handleSave"
        />
      </a-form-item>
    </a-form>
    <p v-if="visibleError" class="iot-device-group-name-modal__error">{{ visibleError }}</p>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

type GroupDialogMode = 'create' | 'createChild' | 'edit'

const props = defineProps<{
  open: boolean
  mode: GroupDialogMode
  initialName?: string
  saving?: boolean
  error?: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'save', name: string): void
}>()

const { t: $t } = useI18n()
const name = ref('')
const localError = ref('')
const visibleError = computed(() => localError.value || props.error || '')
const dialogTitle = computed(() => $t(`IotDeviceList.scope.groupDialog.${props.mode}`))

watch(() => props.open, (open) => {
  if (!open) return
  name.value = props.initialName || ''
  localError.value = ''
})

function handleSave() {
  const value = name.value.trim()
  if (!value) {
    localError.value = $t('IotDeviceList.scope.groupNameRequired')
    return
  }
  localError.value = ''
  emit('save', value)
}
</script>

<style scoped>
.iot-device-group-name-modal__error {
  margin: 0;
  color: var(--jet-theme-error);
  font-size: var(--fs-14);
}
</style>
