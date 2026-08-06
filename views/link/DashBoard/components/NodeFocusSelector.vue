<template>
  <div class="node-focus">
    <div class="node-focus__summary">
      <div class="node-focus__title">
        <span>{{ $t('components.NodeFocus.title') }}</span>
        <a-tag>{{ $t('components.NodeFocus.selected', [value.length, options.length]) }}</a-tag>
      </div>
      <div class="node-focus__actions">
        <a-button type="link" size="small" @click="selectAll">
          {{ $t('components.NodeFocus.selectAll') }}
        </a-button>
        <a-button type="link" size="small" @click="emit('reset')">
          {{ $t('components.NodeFocus.reset') }}
        </a-button>
      </div>
    </div>

    <a-select
      :value="value"
      mode="multiple"
      allow-clear
      show-search
      max-tag-count="responsive"
      :placeholder="$t('components.NodeFocus.placeholder')"
      :options="selectOptions"
      :filter-option="filterOption"
      @update:value="updateValue"
    >
      <template #option="option">
        <div class="node-focus__option">
          <span class="node-focus__dot" :style="{ backgroundColor: option.color }" />
          <j-ellipsis class="node-focus__name">{{ option.label }}</j-ellipsis>
          <span v-if="option.metric" class="node-focus__metric">
            {{ option.metric }}
            <small v-if="option.detail">{{ option.detail }}</small>
          </span>
        </div>
      </template>
      <template #tagRender="tag">
        <a-tag :closable="tag.closable" @close.prevent="removeValue(tag.value)">
          <span class="node-focus__dot" :style="{ backgroundColor: colorByValue[tag.value] }" />
          {{ tag.label }}
        </a-tag>
      </template>
    </a-select>
  </div>
</template>

<script lang="ts" setup name="NodeFocusSelector">
import type { PropType } from 'vue'

interface NodeOption {
  label: string
  value: string
  color: string
  metric?: string
  detail?: string
}

const props = defineProps({
  value: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  options: {
    type: Array as PropType<NodeOption[]>,
    default: () => [],
  },
})

const emit = defineEmits(['update:value', 'reset'])
const selectOptions = computed(() => props.options.map(item => ({ ...item })))
const colorByValue = computed<Record<string, string>>(() => Object.fromEntries(
  props.options.map(item => [item.value, item.color]),
))

const filterOption = (input: string, option?: NodeOption) =>
  option?.label.toLowerCase().includes(input.toLowerCase()) ?? false

const updateValue = (value: string[]) => emit('update:value', [...value])
const removeValue = (value: string | number) => {
  emit('update:value', props.value.filter(nodeId => nodeId !== String(value)))
}
const selectAll = () => emit('update:value', props.options.map(item => item.value))
</script>

<style lang="less" scoped>
.node-focus {
  padding-top: var(--space-3, 0.75rem);
  border-top: 1px solid var(--line, #f0f0f0);

  :deep(.ant-select) {
    width: 100%;
  }
}

.node-focus__summary,
.node-focus__title,
.node-focus__actions,
.node-focus__option,
.node-focus__metric {
  display: flex;
  align-items: center;
}

.node-focus__summary {
  justify-content: space-between;
  margin-bottom: var(--space-2, 0.5rem);
}

.node-focus__title {
  gap: var(--space-2, 0.5rem);
  font-weight: 500;
}

.node-focus__option {
  gap: var(--space-2, 0.5rem);
}

.node-focus__name {
  flex: 1;
  min-width: 0;
}

.node-focus__metric {
  gap: var(--space-2, 0.5rem);
  margin-left: auto;
  font-variant-numeric: tabular-nums;

  small {
    color: rgba(0, 0, 0, 0.45);
  }
}

.node-focus__dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  margin-right: 0.25rem;
  border-radius: 50%;
}
</style>
