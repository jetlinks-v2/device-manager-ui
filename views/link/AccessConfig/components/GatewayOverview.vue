<template>
  <aside class="gateway-overview">
    <div class="gateway-overview__title">{{ t('GatewayEditor.overview') }}</div>
    <div class="gateway-overview__scroll">
      <section v-for="step in steps" :key="step.id" class="gateway-overview__card">
        <header>
          <strong>{{ step.title }}</strong>
          <a-tag v-if="step.builtin" color="blue">{{ t('GatewayEditor.builtin') }}</a-tag>
          <a-button v-else type="link" size="small" @click="emit('select', step.id)">
            {{ t(step.complete ? 'GatewayEditor.modify' : 'GatewayEditor.configure') }}
          </a-button>
        </header>
        <p v-if="!step.complete && step.empty" class="gateway-overview__empty">{{ step.empty }}</p>
        <dl v-else>
          <div v-for="row in step.rows" :key="row.label" :class="{ 'is-block': row.block }">
            <dt>{{ row.label }}</dt><dd>{{ displayValue(row.value) }}</dd>
          </div>
        </dl>
        <slot :name="`detail-${step.id}`" />
      </section>
      <slot />
    </div>
  </aside>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { GatewayStep } from './useGatewayWizard'
defineProps<{ steps: GatewayStep[] }>()
const emit = defineEmits<{ select: [id: number] }>()
const { t } = useI18n()
const displayValue = (value: unknown) => value === undefined || value === null || value === '' ? t('GatewayEditor.unconfigured') : String(value)
</script>
<style scoped>
.gateway-overview { display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; background: var(--bg-sunken); border: 1px solid var(--line); border-radius: var(--r-3); }
.gateway-overview__title { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--line); font-weight: 600; }
.gateway-overview__scroll { flex: 1; min-height: 0; min-width: 0; overflow-y: auto; overflow-x: hidden; padding: var(--space-3); }
.gateway-overview__card { min-width: 0; max-width: 100%; background: var(--bg); border: 1px solid var(--line); border-radius: var(--r-3); padding: var(--space-3); margin-bottom: var(--space-3); }
header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); }
header strong { border-left: 3px solid var(--primary-color); padding-left: var(--space-2); font-size: var(--fs-12); }
header .ant-btn { margin-left: auto; padding-inline: 0; font-size: var(--fs-12); }
dl, dd { margin: 0; }
dl > div { display: flex; gap: var(--space-2); padding-block: var(--space-2); border-bottom: 1px dashed var(--line); font-size: var(--fs-12); }
dt { flex-shrink: 0; color: var(--text-color-secondary); }
dd { flex: 1; min-width: 0; text-align: right; white-space: pre-line; overflow-wrap: anywhere; }
.is-block { flex-direction: column; }
.is-block dd { text-align: left; }
.gateway-overview__empty { margin: var(--space-2) 0 0; color: var(--text-color-secondary); font-size: var(--fs-12); }
</style>
