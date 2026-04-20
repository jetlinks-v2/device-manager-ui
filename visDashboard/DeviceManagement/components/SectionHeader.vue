<template>
  <div class="section-header">
    <div class="title">{{ title }}</div>
    <div class="extra">
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<style scoped lang="less">
.section-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-left: 18px;
  font-weight: 700;
  font-size: 18px;

  &::after {
    position: absolute;
    top: 50%;
    left: 0;
    width: 8px;
    height: 8px;
    background-color: @primary-color;
    border: 1px solid #b4c0da;
    transform: translateY(-50%);
    content: '';
  }
}

.extra {
  font-size: 14px;
  font-weight: 400;
}
</style>
