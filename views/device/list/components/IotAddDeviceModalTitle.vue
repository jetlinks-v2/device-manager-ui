<template>
  <header class="add-device-modal__title">
    <span class="add-device-modal__icon">
      <AIcon :type="editMode ? 'EditOutlined' : 'PlusOutlined'" aria-hidden="true" />
    </span>
    <h3>{{ title }}</h3>
    <a-tooltip v-if="helpText" :title="helpText">
      <AIcon type="QuestionCircleOutlined" class="add-device-modal__title-help" aria-hidden="true" />
    </a-tooltip>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  editMode: { type: Boolean, default: false },
  currentStep: { type: Number, default: 0 },
  creating: { type: Boolean, default: false },
})

const { t: $t } = useI18n()
const title = computed(() => {
  if (props.editMode) return $t('IotDeviceList.add.editTitle')
  if (props.creating) return $t('IotDeviceList.add.installTitle')
  return props.currentStep === 0
    ? $t('IotDeviceList.add.selectDeviceTitle')
    : $t('IotDeviceList.add.basicInfoTitle')
})
const helpText = computed(() => props.editMode
  ? ''
  : props.currentStep === 0
    ? $t('IotDeviceList.add.libraryDesc')
    : $t('IotDeviceList.add.basicInfoHelp'))
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
