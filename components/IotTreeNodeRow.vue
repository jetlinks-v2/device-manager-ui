<template>
  <span
    class="iot-tree-node-row"
    :class="{ 'iot-tree-node-row--with-action': props.showAction || props.reserveActionSpace }"
  >
    <span class="iot-tree-node-row__content">
      <span class="iot-tree-node-row__icon"><slot name="icon" /></span>
      <span class="iot-tree-node-row__label">
        <j-ellipsis class="iot-tree-node-row__ellipsis"><slot name="label" /></j-ellipsis>
      </span>
    </span>
    <span class="iot-tree-node-row__count">
      <a-tooltip v-if="props.countTooltip" :title="props.countTooltip">
        <span class="iot-tree-node-row__count-value">{{ props.count }}</span>
      </a-tooltip>
      <span v-else>{{ props.count }}</span>
    </span>
    <span v-if="props.showAction || props.reserveActionSpace" class="iot-tree-node-row__action">
      <a-dropdown v-if="props.showAction" :trigger="['click']">
        <a-button
          class="iot-tree-node-row__action-button"
          type="text"
          size="small"
          :aria-label="props.actionAriaLabel"
          @click.stop
        >
          <AIcon type="EllipsisOutlined" aria-hidden="true" />
        </a-button>
        <template #overlay>
          <a-menu><slot name="action" /></a-menu>
        </template>
      </a-dropdown>
    </span>
  </span>
</template>

<script setup lang="ts">
interface IotTreeNodeRowProps {
  count?: string | number
  countTooltip?: string
  showAction?: boolean
  reserveActionSpace?: boolean
  actionAriaLabel?: string
}

// 统一树节点的列宽、更多菜单触发方式和悬浮反馈；调用方只提供对象特有的菜单项。
const props = withDefaults(defineProps<IotTreeNodeRowProps>(), {
  count: '',
  countTooltip: '',
  showAction: false,
  reserveActionSpace: false,
  actionAriaLabel: '',
})
</script>

<style scoped>
.iot-tree-node-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(1.25rem, max-content);
  gap: var(--space-1);
  align-items: center;
  min-width: 0;
  box-sizing: border-box;
  white-space: nowrap;
}

.iot-tree-node-row--with-action {
  grid-template-columns: minmax(0, 1fr) minmax(1.25rem, max-content) 1.5rem;
}

/* 没有更多按钮时，为数量保留与操作列相近的呼吸空间，避免贴近侧栏边界。 */
.iot-tree-node-row:not(.iot-tree-node-row--with-action) {
  padding-inline-end: var(--space-2);
}

.iot-tree-node-row__content {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  min-width: 0;
}

.iot-tree-node-row__icon,
.iot-tree-node-row__count,
.iot-tree-node-row__action {
  flex: 0 0 auto;
}

.iot-tree-node-row__icon {
  display: inline-flex;
  align-items: center;
}

.iot-tree-node-row__label {
  display: block;
  flex: 1 1 0;
  width: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iot-tree-node-row__ellipsis {
  display: block;
  width: 100%;
  min-width: 0;
}

.iot-tree-node-row__count {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-style: normal;
  text-align: right;
}

.iot-tree-node-row__count-value {
  cursor: default;
}

.iot-tree-node-row__action {
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
  align-items: center;
  justify-content: center;
}

.iot-tree-node-row__action-button {
  display: inline-flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  line-height: 1;
  opacity: 0;
}

.iot-tree-node-row__action-button :deep(.anticon) {
  margin: 0;
  line-height: 1;
}

.iot-tree-node-row:hover .iot-tree-node-row__action-button,
.iot-tree-node-row:focus-within .iot-tree-node-row__action-button {
  opacity: 1;
}
</style>
