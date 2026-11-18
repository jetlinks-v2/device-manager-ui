<template>
  <header class="add-device-modal__title">
    <span class="add-device-modal__icon">
      <AIcon :type="icon || (editMode ? 'EditOutlined' : 'PlusOutlined')" aria-hidden="true" />
    </span>
    <h3>{{ title }}</h3>
    <a-tooltip v-if="resolvedHelpText" :title="resolvedHelpText">
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
  creationSource: { type: String, default: 'product' },
  titleText: { type: String, default: '' },
  helpText: { type: String, default: undefined },
  icon: { type: String, default: '' },
})

const { t: $t } = useI18n()
const title = computed(() => {
  if (props.titleText) return props.titleText
  if (props.editMode) return $t('IotDeviceList.add.editTitle')
  if (props.creating) return $t('IotDeviceList.add.installTitle')
  return props.currentStep === 0
    ? $t('IotDeviceList.add.selectDeviceTitle')
    : $t('IotDeviceList.add.basicInfoTitle')
})
const resolvedHelpText = computed(() => props.helpText ?? (props.editMode
  ? ''
  : props.currentStep === 0
    ? $t(props.creationSource === 'library' ? 'IotDeviceList.add.libraryDesc' : 'IotDeviceList.add.productSourceDesc')
    : $t('IotDeviceList.add.basicInfoHelp')))
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
