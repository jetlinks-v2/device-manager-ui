<template>
  <div class="page-actions">
    <slot />
  </div>
</template>

<style scoped>
.page-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}</style>
