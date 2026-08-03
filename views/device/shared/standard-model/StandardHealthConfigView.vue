<template>
  <div class="health-view">
    <section v-if="showConnection" class="health-card">
      <div class="health-card__head">
        <h3>{{ $t('IotStandardModel.health.connection') }}</h3>
        <span class="health-card__count">{{ connectionRules.length }}</span>
      </div>
      <div v-if="connectionRules.length" class="health-list">
        <article
          v-for="rule in connectionRules"
          :key="rule.title"
          class="health-item"
        >
          <div class="health-item__head">
            <strong>{{ rule.title }}</strong>
            <span class="health-pill">{{ rule.severity === 'urgent' ? $t('IotStandardModel.health.severity.urgent') : $t('IotStandardModel.health.severity.watch') }}</span>
          </div>
          <div class="health-meta">
            <div class="health-meta__row">
              <span class="health-meta__label">{{ $t('IotStandardModel.health.condition') }}</span>
              <span class="health-meta__value">{{ rule.condition }}</span>
            </div>
            <div class="health-meta__row">
              <span class="health-meta__label">{{ $t('IotStandardModel.health.description') }}</span>
              <span class="health-meta__value">{{ rule.description }}</span>
            </div>
            <div class="health-meta__row">
              <span class="health-meta__label">{{ $t('IotStandardModel.health.suggestion') }}</span>
              <span class="health-meta__value">{{ rule.suggestion }}</span>
            </div>
          </div>
        </article>
      </div>
      <CloudEmpty v-else class="health-empty" :description="$t('IotStandardModel.health.emptyConnection')" />
    </section>

    <section v-if="showDeviation" class="health-card">
      <div class="health-card__head">
        <h3>{{ $t('IotStandardModel.health.deviation') }}</h3>
        <span class="health-card__count">{{ deviationProperties.length }}</span>
      </div>
      <div v-if="deviationProperties.length" class="health-list">
        <article
          v-for="property in deviationProperties"
          :key="property.id"
          class="health-item"
        >
          <div class="health-item__head">
            <strong>{{ property.name }}</strong>
            <span class="health-pill">{{ deviationRiskLabel(property) }}</span>
          </div>
          <div class="health-meta">
            <div class="health-meta__row">
              <span class="health-meta__label">{{ $t('IotStandardModel.health.identifier') }}</span>
              <span class="health-meta__value">{{ property.identifier }}</span>
            </div>
            <div class="health-meta__row">
              <span class="health-meta__label">{{ $t('IotStandardModel.health.normalRange') }}</span>
              <span class="health-meta__value">{{ property.expandedConfig.deviationConfig.normalRange || '-' }}</span>
            </div>
            <div class="health-meta__row">
              <span class="health-meta__label">{{ $t('IotStandardModel.health.warningRange') }}</span>
              <span class="health-meta__value">{{ property.expandedConfig.deviationConfig.warningRange || '-' }}</span>
            </div>
            <div class="health-meta__row">
              <span class="health-meta__label">{{ $t('IotStandardModel.health.alarmRange') }}</span>
              <span class="health-meta__value">{{ property.expandedConfig.deviationConfig.alarmRange || '-' }}</span>
            </div>
            <div class="health-meta__row">
              <span class="health-meta__label">{{ $t('IotStandardModel.health.description') }}</span>
              <span class="health-meta__value">{{ property.expandedConfig.deviationConfig.description || '-' }}</span>
            </div>
            <div class="health-meta__row">
              <span class="health-meta__label">{{ $t('IotStandardModel.health.suggestion') }}</span>
              <span class="health-meta__value">{{ property.expandedConfig.deviationConfig.suggestion || '-' }}</span>
            </div>
          </div>
        </article>
      </div>
      <CloudEmpty v-else class="health-empty" :description="$t('IotStandardModel.health.emptyDeviation')" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type {
  IotDeviceLibraryConnectionHealthRule,
  IotDeviceLibraryThingModelProperty,
} from '@device-manager-ui/views/device/shared/device-library/services/deviceLibrary.types'

withDefaults(defineProps<{
  connectionRules: IotDeviceLibraryConnectionHealthRule[]
  deviationProperties: IotDeviceLibraryThingModelProperty[]
  showConnection?: boolean
  showDeviation?: boolean
}>(), {
  showConnection: true,
  showDeviation: true,
})

const { t: $t } = useI18n()

function deviationRiskLabel(property: IotDeviceLibraryThingModelProperty) {
  const alarmRange = property.expandedConfig.deviationConfig.alarmRange?.trim()
  const warningRange = property.expandedConfig.deviationConfig.warningRange?.trim()
  if (alarmRange && alarmRange !== '-') return $t('IotStandardModel.health.risk.alarm')
  if (warningRange && warningRange !== '-') return $t('IotStandardModel.health.risk.warning')
  return $t('IotStandardModel.health.risk.watch')
}
</script>

<style scoped>
.health-view {
  display: grid;
  gap: var(--space-4);
}

.health-card {
  display: grid;
  gap: var(--space-4);
  padding: 1.25rem 1.5rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius-lg);
  background: var(--jet-theme-bg-container);
}

.health-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.health-card__head h3 {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-title-4);
  font-weight: 600;
}

.health-card__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  height: 1.75rem;
  padding: 0 0.625rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: 62.4375rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  background: var(--jet-theme-primary-soft);
}

.health-list {
  display: grid;
  gap: var(--space-3);
}

.health-item {
  display: grid;
  gap: var(--space-3);
  padding: 1rem 1.125rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
}

.health-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.health-item__head strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
}

.health-pill {
  display: inline-flex;
  align-items: center;
  height: 1.5rem;
  padding: 0 0.625rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: 62.4375rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  white-space: nowrap;
  background: var(--jet-theme-primary-soft);
}

.health-meta {
  display: grid;
  gap: var(--space-2);
}

.health-meta__row {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
}

.health-meta__label {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.6;
}

.health-meta__value {
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  line-height: 1.7;
  word-break: break-word;
}

.health-empty {
  padding: 1rem 1.125rem;
  border: 0.0625rem dashed var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-body);
  background: var(--jet-theme-primary-soft);
}

@media (max-width: 48rem) {
  .health-card {
    padding: var(--space-4);
  }

  .health-card__head,
  .health-item__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .health-meta__row {
    grid-template-columns: 1fr;
    gap: var(--space-1);
  }
}</style>
