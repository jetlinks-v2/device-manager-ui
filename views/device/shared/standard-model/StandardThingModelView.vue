<template>
  <section class="thing-model-view" :aria-label="$t('IotStandardModel.thingModel.aria')">
    <header v-if="displayTitle || description" class="thing-model-view__head">
      <div>
        <h3 v-if="displayTitle">{{ displayTitle }}</h3>
        <p v-if="description">{{ description }}</p>
      </div>
    </header>

    <a-tabs v-model:active-key="activeKind" class="thing-model-tabs">
      <a-tab-pane v-for="option in kindOptions" :key="option.key">
        <template #tab>
          <span class="thing-model-tabs__item">
            <AIcon v-if="showTabIcons" :type="option.icon || 'AppstoreOutlined'" aria-hidden="true" />
            {{ option.label }}
            <span class="thing-model-tabs__count">{{ option.count }}</span>
          </span>
        </template>
      </a-tab-pane>
    </a-tabs>

    <div v-if="activeRows.length" class="thing-model-list">
      <article v-for="row in activeRows" :key="row.id" class="thing-model-item">
        <div class="thing-model-item__head">
          <div>
            <strong>{{ row.name }}</strong>
            <p>{{ row.identifier }}</p>
          </div>
          <div class="thing-model-item__badges">
            <span v-for="badge in row.badges" :key="badge" class="thing-model-badge">{{ badge }}</span>
          </div>
        </div>

        <p class="thing-model-item__desc">{{ row.description || $t('IotStandardModel.common.noDescription') }}</p>

        <dl class="thing-model-item__meta">
          <div v-for="meta in row.meta" :key="meta.label">
            <dt>{{ meta.label }}</dt>
            <dd>{{ meta.value }}</dd>
          </div>
        </dl>

        <div v-if="row.extraItems.length" class="thing-model-item__extra">
          <strong>{{ $t('IotStandardModel.thingModel.extraConfig') }}</strong>
          <ul>
            <li v-for="item in row.extraItems" :key="item.identifier">
              <span>{{ item.name }}</span>
              <em>{{ item.identifier }}</em>
              <strong>{{ item.dataType }}</strong>
            </li>
          </ul>
        </div>
      </article>
    </div>

    <CloudEmpty v-else class="thing-model-empty" :description="$t('IotStandardModel.thingModel.empty', { kind: activeKindLabel })" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  IotDeviceLibraryThingModelDefinition,
  IotDeviceLibraryThingModelConfigItem,
  IotDeviceLibraryThingModelEvent,
  IotDeviceLibraryThingModelFunction,
  IotDeviceLibraryThingModelProperty,
  IotDeviceLibraryThingModelTag,
} from '@device-manager-ui/views/device/shared/device-library/services/deviceLibrary.types'
import { useIot2DeviceTypeMeta } from '@device-manager-ui/views/device/shared/device-library/composables/useIot2DeviceTypeMeta'

type ThingModelKind = 'properties' | 'events' | 'functions' | 'tags'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  definition: IotDeviceLibraryThingModelDefinition
  defaultKind?: ThingModelKind
  showTabIcons?: boolean
}>(), {
  description: '',
  defaultKind: 'properties',
  showTabIcons: true,
})

const { t: $t } = useI18n()
const { thingModelAccessMeta, thingModelDataTypeMeta, eventLevelMeta, callModeMeta } = useIot2DeviceTypeMeta()
const activeKind = ref<ThingModelKind>(props.defaultKind)

watch(
  () => props.defaultKind,
  (kind) => {
    activeKind.value = kind
  },
)

const kindOptions = computed(() => [
  { key: 'properties' as const, label: $t('IotStandardModel.thingModel.kind.properties'), icon: 'ControlOutlined', count: props.definition.properties.length },
  { key: 'events' as const, label: $t('IotStandardModel.thingModel.kind.events'), icon: 'RadarChartOutlined', count: props.definition.events.length },
  { key: 'functions' as const, label: $t('IotStandardModel.thingModel.kind.functions'), icon: 'SendOutlined', count: props.definition.functions.length },
  { key: 'tags' as const, label: $t('IotStandardModel.thingModel.kind.tags'), icon: 'TagsOutlined', count: props.definition.tags.length },
])

const displayTitle = computed(() => props.title ?? $t('IotStandardModel.thingModel.title'))
const activeKindLabel = computed(() => kindOptions.value.find((item) => item.key === activeKind.value)?.label || $t('IotStandardModel.common.content'))

function commonMeta(row: IotDeviceLibraryThingModelProperty | IotDeviceLibraryThingModelEvent | IotDeviceLibraryThingModelFunction | IotDeviceLibraryThingModelTag) {
  return [
    { label: $t('IotStandardModel.thingModel.meta.dataType'), value: thingModelDataTypeMeta(row.dataType as any).label },
  ]
}

function configItems(items: IotDeviceLibraryThingModelConfigItem[] = []) {
  return items.filter((item) => item.identifier || item.name)
}

const activeRows = computed(() => {
  if (activeKind.value === 'properties') {
    return props.definition.properties.map((row: IotDeviceLibraryThingModelProperty) => ({
      id: row.id,
      name: row.name,
      identifier: row.identifier,
      description: row.description,
      badges: [thingModelAccessMeta(row.accessMode as any).label, ...(row.tags || []).slice(0, 3)],
      meta: [
        ...commonMeta(row),
        { label: $t('IotStandardModel.thingModel.meta.accessMode'), value: thingModelAccessMeta(row.accessMode as any).label },
        { label: $t('IotStandardModel.thingModel.meta.source'), value: row.source || $t('IotStandardModel.common.deviceReport') },
        { label: $t('IotStandardModel.thingModel.meta.reportStrategy'), value: row.expandedConfig.reportStrategy || '-' },
      ],
      extraItems: configItems(row.expandedConfig.items),
    }))
  }

  if (activeKind.value === 'events') {
    return props.definition.events.map((row: IotDeviceLibraryThingModelEvent) => ({
      id: row.id,
      name: row.name,
      identifier: row.identifier,
      description: row.description,
      badges: [eventLevelMeta(row.level as any).label],
      meta: [
        ...commonMeta(row),
        { label: $t('IotStandardModel.thingModel.meta.eventLevel'), value: eventLevelMeta(row.level as any).label },
        { label: $t('IotStandardModel.thingModel.meta.outputs'), value: $t('IotStandardModel.thingModel.count.item', { count: row.outputs.length }) },
      ],
      extraItems: configItems(row.outputs),
    }))
  }

  if (activeKind.value === 'functions') {
    return props.definition.functions.map((row: IotDeviceLibraryThingModelFunction) => ({
      id: row.id,
      name: row.name,
      identifier: row.identifier,
      description: row.description,
      badges: [callModeMeta(row.callMode as any).label],
      meta: [
        ...commonMeta(row),
        { label: $t('IotStandardModel.thingModel.meta.callMode'), value: callModeMeta(row.callMode as any).label },
        { label: $t('IotStandardModel.thingModel.meta.inputs'), value: $t('IotStandardModel.thingModel.count.item', { count: row.inputs.length }) },
        { label: $t('IotStandardModel.thingModel.meta.outputs'), value: $t('IotStandardModel.thingModel.count.item', { count: row.outputs.length }) },
      ],
      extraItems: configItems([...row.inputs, ...row.outputs]),
    }))
  }

  return props.definition.tags.map((row: IotDeviceLibraryThingModelTag) => ({
    id: row.id,
    name: row.name,
    identifier: row.identifier,
    description: row.description,
    badges: [],
    meta: commonMeta(row),
    extraItems: [],
  }))
})
</script>

<style scoped>
.thing-model-view {
  display: grid;
  gap: var(--space-4);
}

.thing-model-view__head {
  display: grid;
  gap: 0.375rem;
}

.thing-model-view__head h3 {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-title-4);
  font-weight: 600;
}

.thing-model-view__head p {
  margin: 0;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-body);
  line-height: 1.6;
}

.thing-model-tabs :deep(.ant-tabs-nav) {
  margin-bottom: var(--space-2);
}

.thing-model-tabs__item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2.5rem;
  white-space: nowrap;
}

.thing-model-tabs__count {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.thing-model-list {
  display: grid;
  gap: var(--space-3);
}

.thing-model-item {
  display: grid;
  gap: var(--space-3);
  padding: 1rem 1.125rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
}

.thing-model-item__head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.thing-model-item__head strong {
  display: block;
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
}

.thing-model-item__head p {
  margin: 0.25rem 0 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14); }

.thing-model-item__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.375rem;
}

.thing-model-badge {
  display: inline-flex;
  align-items: center;
  padding: 0 0.625rem;
  height: 1.5rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: 62.4375rem;
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
}

.thing-model-item__desc {
  margin: 0;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-body);
  line-height: 1.6;
}

.thing-model-item__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2) var(--space-4);
  margin: 0;
}

.thing-model-item__meta div {
  display: grid;
  gap: 0.125rem;
}

.thing-model-item__meta dt {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.thing-model-item__meta dd {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
}

.thing-model-item__extra {
  display: grid;
  gap: var(--space-2);
}

.thing-model-item__extra strong {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  font-weight: 600;
}

.thing-model-item__extra ul {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.thing-model-item__extra li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-primary-soft);
}

.thing-model-item__extra em {
  color: var(--jet-theme-text-disabled);
  font-style: normal; font-size: var(--fs-14);
}

.thing-model-item__extra li strong {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
}

.thing-model-empty {
  padding: 1.125rem;
  border: 0.0625rem dashed var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-body);
}

@media (max-width: 48rem) {
  .thing-model-item__head {
    flex-direction: column;
  }

  .thing-model-item__badges {
    justify-content: flex-start;
  }

  .thing-model-item__meta {
    grid-template-columns: 1fr;
  }

  .thing-model-item__extra li {
    grid-template-columns: 1fr;
  }
}</style>
