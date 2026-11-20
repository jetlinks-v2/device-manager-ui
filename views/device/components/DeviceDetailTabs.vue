<template>
  <a-tabs class="device-detail-tabs" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </a-tabs>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<style scoped lang="less">
.device-detail-tabs {
  min-width: 0;
  :deep(> .ant-tabs-nav) {
    margin-bottom: var(--space-3);
    padding: var(--space-1);
    border-radius: var(--r-2);
    background: var(--jet-theme-bg-layout);
    &::before { border: 0; }
    .ant-tabs-nav-list { gap: var(--space-1); }
    .ant-tabs-tab {
      margin: 0;
      padding: var(--space-1) var(--space-3);
      border: 0;
      border-radius: var(--r-1);
      background: transparent;
    }
    .ant-tabs-tab-active {
      background: var(--jet-theme-bg-container);
      .ant-tabs-tab-btn { color: var(--jet-theme-primary); }
    }
    .ant-tabs-ink-bar { display: none; }
    .ant-tabs-extra-content { padding-inline: var(--space-2); }
  }
}
</style>
