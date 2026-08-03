<template>
  <a-list-item class="access-list-item">
    <a-list-item-meta>
      <template #title>
        <div class="plain-item-head">
          <div class="plain-item-head__left">
            <div class="title-before" aria-hidden="true" />
            <span class="plain-item-title">{{ $t('IotDeviceDetail.accessConfig.config') }}</span>
          </div>
          <a-button
            type="link"
            size="small"
            @click="$emit('edit')"
          >
            <AIcon type="EditOutlined" />
            {{ $t('IotDeviceDetail.accessConfig.edit') }}
          </a-button>
        </div>
      </template>
      <template #description>
        <a-descriptions
          v-for="group in configGroups"
          :key="group.name"
          class="compact-descriptions"
          bordered
          size="small"
          :label-style="descriptionLabelStyle"
        >
          <template #title>
            <h4 class="config-group-title">{{ group.name }}</h4>
          </template>
          <a-descriptions-item
            v-for="item in group.properties"
            :key="item.property"
          >
            <template #label>
              <j-ellipsis class="config-label">
                {{ item.name }}
                <a-tooltip
                  v-if="item.description"
                  :title="item.description"
                >
                  <AIcon type="QuestionCircleOutlined" />
                </a-tooltip>
              </j-ellipsis>
            </template>
            <div class="config-value">
              <j-ellipsis class="config-value__text">{{ displayConfigValue(item) }}</j-ellipsis>
              <template v-if="isSensitiveConfig(item) && hasConfigValue(item)">
                <a-tooltip :title="isConfigRevealed(item) ? $t('IotDeviceDetail.accessConfig.hide') : $t('IotDeviceDetail.accessConfig.show')">
                  <a-button
                    type="text"
                    size="small"
                    class="config-value__action"
                    @click="toggleConfigReveal(item)"
                  >
                    <AIcon :type="isConfigRevealed(item) ? 'EyeInvisibleOutlined' : 'EyeOutlined'" />
                  </a-button>
                </a-tooltip>
                <a-tooltip :title="$t('IotDeviceDetail.accessConfig.copy')">
                  <a-button
                    type="text"
                    size="small"
                    class="config-value__action"
                    @click="$emit('copy', String(getConfigValue(item)))"
                  >
                    <AIcon type="CopyOutlined" />
                  </a-button>
                </a-tooltip>
              </template>
            </div>
          </a-descriptions-item>
        </a-descriptions>
      </template>
    </a-list-item-meta>
  </a-list-item>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PropType } from 'vue'

type ConfigProperty = {
  property: string
  name: string
  description?: string
  type?: Record<string, any>
}

type ConfigGroup = {
  name: string
  properties: ConfigProperty[]
}

defineEmits<{
  (e: 'edit'): void
  (e: 'copy', value: string): void
}>()

const props = defineProps({
  configGroups: { type: Array as PropType<ConfigGroup[]>, required: true },
  getConfigValue: { type: Function as PropType<(item: ConfigProperty) => unknown>, required: true },
  renderConfigValue: { type: Function as PropType<(item: ConfigProperty) => unknown>, required: true },
})

const descriptionLabelStyle = { width: '7.5rem' }
const revealedKeys = ref<string[]>([])
const revealedKeySet = computed(() => new Set(revealedKeys.value))

function configKey(item: ConfigProperty) {
  return item.property
}

function isSensitiveConfig(item: ConfigProperty) {
  return item.type?.type === 'password'
}

function hasConfigValue(item: ConfigProperty) {
  const value = props.getConfigValue(item)
  return value !== undefined && value !== null && String(value) !== ''
}

function isConfigRevealed(item: ConfigProperty) {
  return revealedKeySet.value.has(configKey(item))
}

function displayConfigValue(item: ConfigProperty) {
  if (isSensitiveConfig(item) && isConfigRevealed(item)) {
    return props.getConfigValue(item) || '--'
  }

  return props.renderConfigValue(item)
}

function toggleConfigReveal(item: ConfigProperty) {
  const key = configKey(item)
  revealedKeys.value = isConfigRevealed(item)
    ? revealedKeys.value.filter((itemKey) => itemKey !== key)
    : [...revealedKeys.value, key]
}
</script>

<style lang="less" scoped>
.access-list-item {
  padding: var(--space-3) 0 !important;
}

.plain-item-head,
.plain-item-head__left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.plain-item-head {
  justify-content: space-between;
}

.title-before {
  width: 0.1875rem;
  height: var(--space-3);
  border-radius: var(--r-1);
  background: var(--jet-theme-primary);
}

.compact-descriptions {
  margin-bottom: var(--space-3);
}

.config-label {
  margin-right: var(--space-1);
}

.config-group-title {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: 600;
}

.config-value {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  gap: var(--space-1);
}

.config-value__text {
  min-width: 0;
}

.config-value__action {
  flex: 0 0 auto;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  color: var(--jet-theme-primary);
}
</style>
