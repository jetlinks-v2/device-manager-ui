<template>
  <section class="iot-health-section">
    <header class="iot-health-section__head">
      <h4>{{ title }}</h4>
      <span v-if="meta">{{ meta }}</span>
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps({
  title: {
    type: String,
    required: true,
  },
  meta: {
    type: String,
    default: '',
  },
})
</script>

<style scoped>
.iot-health-section {
  padding: var(--space-4);
  height: 100%;
  background: var(--jet-theme-bg-container);
  border: var(--jet-theme-stroke-width) solid var(--jet-theme-border-secondary);
  border-radius: var(--jet-theme-radius-lg);
}

.iot-health-section__head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.iot-health-section__head h4 {
  flex: 1;
  margin: 0;
  color: var(--jet-theme-text-title);
  font-size: var(--fs-18);
  font-weight: 700;
}

.iot-health-section__head span {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}
</style>
