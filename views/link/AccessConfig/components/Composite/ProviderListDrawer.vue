<template>
  <div class="composite-provider">
    <div class="composite-provider__hint">{{ t('GatewayEditor.childChooseHint') }}</div>
    <div class="composite-provider__grid">
      <button v-for="item in otherProvider" :key="item.id" type="button" @click="emit('choose', item)">
        <strong>{{ item.name }}</strong><span>{{ item.description }}</span>
      </button>
    </div>
    <Teleport v-if="footerHost" :to="footerHost"><a-button @click="emit('close')">{{ t('GatewayEditor.back') }}</a-button></Teleport>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { inject } from 'vue'
import { gatewayFooterHostKey } from '../gatewayEditorContext'
import type { GatewayChildDraft } from '../gatewayEditorContext'
defineProps<{ otherProvider: GatewayChildDraft['provider'][] }>()
const emit = defineEmits<{ close: []; choose: [provider: GatewayChildDraft['provider']] }>()
const { t } = useI18n()
const footerHost = inject(gatewayFooterHostKey, undefined)
</script>
<style scoped>
.composite-provider__hint { color: var(--primary-color); background: var(--primary-color-deprecated-bg, #e8f1ff); padding: var(--space-3); margin-bottom: var(--space-4); border-radius: var(--r-2); }
.composite-provider__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); max-height: 65vh; overflow: auto; padding-bottom: var(--space-4); }
.composite-provider__grid button { display: flex; flex-direction: column; gap: var(--space-2); text-align: left; padding: var(--space-4); border: 1px solid var(--line); border-radius: var(--r-3); background: var(--bg); cursor: pointer; }
.composite-provider__grid button:hover { border-color: var(--primary-color); }
.composite-provider__grid span { color: var(--text-color-secondary); font-size: var(--fs-12); }
@media (max-width: 640px) { .composite-provider__grid { grid-template-columns: 1fr; } }
</style>
