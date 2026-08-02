<template>
  <span
    class="i18n-input-trigger-wrapper"
    @mousedown="stopPropagation"
    @click="configure"
  >
    <a-tooltip :title="$t('I18n.configure')">
      <AIcon class="i18n-input-trigger" type="GlobalOutlined" />
    </a-tooltip>
  </span>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'configure'): void
}>()

function stopPropagation(event?: Event) {
  event?.stopPropagation()
}

function configure(event?: Event) {
  event?.stopPropagation()
  emit('configure')
}
</script>

<style scoped lang="less">
.i18n-input-trigger-wrapper {
  display: inline-flex;
}

.i18n-input-trigger {
  color: var(--jet-theme-primary);
  cursor: pointer;
}
</style>
