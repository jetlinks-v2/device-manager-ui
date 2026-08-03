<template>
  <a-modal
    :open="open"
    :title="dialogTitle"
    :width="520"
    :confirm-loading="saving"
    :ok-text="mode === 'edit' ? $t('IotDeviceGroups.createDrawer.okTextEdit') : $t('IotDeviceGroups.createDrawer.okTextCreate')"
    :cancel-text="$t('IotDeviceDetail.common.cancel')"
    destroy-on-close
    centered
    @update:open="onUpdateOpen"
    @ok="handleSave"
    @cancel="handleClose"
  >
    <div class="type-group-modal">
      <a-form layout="vertical">
        <a-form-item :label="$t('IotDeviceGroups.createDrawer.label.code')" required>
          <a-input
            v-model:value="form.code"
            :placeholder="$t('IotDeviceGroups.createDrawer.placeholder.code')"
            :maxlength="32"
            :disabled="mode === 'edit'"
          />
        </a-form-item>

        <a-form-item :label="$t('IotDeviceGroups.createDrawer.label.name')" required>
          <a-input
            v-model:value="form.name"
            :placeholder="$t('IotDeviceGroups.createDrawer.placeholder.name')"
            :maxlength="128"
          />
        </a-form-item>
        <div class="type-group-modal__grid">
          <a-form-item :label="$t('IotDeviceGroups.createDrawer.label.sort')">
            <a-input-number
              v-model:value="form.sortIndex"
              :min="0"
              :step="1"
              style="width: 100%;"
            />
          </a-form-item>
        </div>
        <a-form-item :label="$t('IotDeviceGroups.createDrawer.label.description')">
          <a-textarea
            v-model:value="form.description"
            :auto-size="{ minRows: 3, maxRows: 5 }"
            :placeholder="$t('IotDeviceGroups.createDrawer.placeholder.description')"
            :maxlength="512"
          />
        </a-form-item>

      </a-form>

      <p v-if="visibleError" class="type-group-modal__error">{{ visibleError }}</p>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { CreateTypeGroupInput, EditTypeGroupModel } from './iotTypeGroup.types'
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n()
const props = defineProps<{
  open: boolean
  mode?: 'create' | 'edit'
  initialValue?: EditTypeGroupModel | null
  saving?: boolean
  error?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [value: CreateTypeGroupInput]
}>()

const mode = computed(() => props.mode ?? 'create')
const dialogTitle = computed(() => {
  if (mode.value === 'edit' && props.initialValue?.name) return $t('IotDeviceGroups.createDrawer.editTitle', { name: props.initialValue.name })
  return $t('IotDeviceGroups.createDrawer.createTitle')
})
const formError = ref('')
const form = ref<CreateTypeGroupInput>({
  code: '',
  name: '',
  description: '',
  sortIndex: 0,
})

const visibleError = computed(() => formError.value || props.error || '')

watch(() => props.open, (open) => {
  if (open) resetForm()
})

watch(() => props.initialValue, () => {
  if (props.open) resetForm()
})

function resetForm() {
  const initialValue = props.initialValue
  form.value = {
    code: initialValue?.code ?? '',
    name: initialValue?.name ?? '',
    description: initialValue?.description ?? '',
    sortIndex: initialValue?.sortIndex ?? 0,
  }
  formError.value = ''
}

function onUpdateOpen(value: boolean) {
  emit('update:open', value)
}

function handleClose() {
  if (props.saving) return
  emit('update:open', false)
}

function handleSave() {
  if (props.saving) return
  const code = form.value.code.trim()
  const name = form.value.name.trim()
  const description = form.value.description.trim()
  if (!code) {
    formError.value = $t('IotDeviceGroups.createDrawer.validation.codeRequired')
    return
  }
  if (!name) {
    formError.value = $t('IotDeviceGroups.createDrawer.validation.nameRequired')
    return
  }
  formError.value = ''
  emit('save', {
    ...form.value,
    code,
    name,
    description,
  })
}
</script>

<style scoped>
.type-group-modal {
  display: grid;
  gap: var(--space-4);
}

.type-group-modal__grid {
  display: grid;
  gap: var(--space-3);
}

.type-group-modal__error {
  margin: 0;
  color: var(--jet-theme-error);
  font-size: var(--fs-14);
  line-height: 1.6;
}

@media (width <= 73.75rem) {
  .type-group-modal__grid {
    grid-template-columns: 1fr;
  }
}
</style>
