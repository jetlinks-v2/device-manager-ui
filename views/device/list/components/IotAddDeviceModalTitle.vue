<template>
  <header class="add-device-modal__title">
    <span class="add-device-modal__icon">
      <AIcon :type="editMode ? 'EditOutlined' : 'PlusOutlined'" aria-hidden="true" />
    </span>
    <h3>{{ editMode ? $t('IotDeviceList.add.editTitle') : $t('IotDeviceList.add.createTitle') }}</h3>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps({
  editMode: { type: Boolean, default: false },
})

const { t: $t } = useI18n()
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
