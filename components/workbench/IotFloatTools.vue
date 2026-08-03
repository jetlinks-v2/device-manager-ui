<template>
  <div class="dashboard-float-tools" @mouseenter="emit('update:open', true)" @mouseleave="emit('update:open', false)">
    <Transition name="float-actions">
      <div v-if="open || menuOpen" class="dashboard-float-tools__menu">
        <a-button class="dashboard-float-tools__menu-button" type="text" @click="emit('open-components')">
          <AIcon :type="'PlusOutlined'" aria-hidden="true" />
          {{ $t('IotWorkbench.float.add') }}
        </a-button>
        <a-button class="dashboard-float-tools__menu-button" type="text" @click="emit('open-settings')">
          <AIcon :type="'ProjectOutlined'" aria-hidden="true" />
          {{ $t('IotWorkbench.float.settings') }}
        </a-button>
      </div>
    </Transition>
    <a-button
      class="dashboard-float-tools__trigger"
      type="text"
      :aria-label="$t('IotWorkbench.float.aria')"
      @click="emit('update:menuOpen', !menuOpen)"
    >
      <AIcon :type="'SettingOutlined'" aria-hidden="true" />
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  open: boolean
  menuOpen: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:menuOpen': [value: boolean]
  'open-components': []
  'open-settings': []
}>()

const { t: $t } = useI18n()
</script>
