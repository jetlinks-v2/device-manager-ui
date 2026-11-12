<template>
  <span class="notification-guidance">
    <RuleNotice kind="info" :label="$t('DeviceAlarm.notification.help')" :message="$t('DeviceAlarm.notification.help')">
      <div class="notification-help">
        <section>
          <strong>{{ $t('DeviceAlarm.delivery.whenTitle') }}</strong>
          <p>{{ $t(model.notification.enabled ? 'DeviceAlarm.delivery.when' : 'DeviceAlarm.delivery.off') }}</p>
          <p v-if="model.notification.enabled && model.autoRelieve && model.notification.includeRelieve">{{ $t('DeviceAlarm.delivery.recovery') }}</p>
        </section>
        <section>
          <strong>{{ $t('DeviceAlarm.delivery.missingTitle') }}</strong>
          <p>{{ $t('DeviceAlarm.delivery.missing') }}</p>
          <p class="notification-help-secondary">{{ $t('DeviceAlarm.delivery.statusLimit') }}</p>
        </section>
      </div>
    </RuleNotice>
    <span v-if="showLabel">{{ $t('DeviceAlarm.notification.help') }}</span>
  </span>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RuleNotice from '../../../components/PropertyRules/RuleNotice.vue'
import type { DeviceAlarmFormModel } from '../../types'
defineProps<{ model: DeviceAlarmFormModel; showLabel?: boolean }>()
const { t: $t } = useI18n()
</script>
<style scoped>
.notification-guidance { display: inline-flex; align-items: center; gap: var(--space-1); color: var(--jet-theme-text-secondary); font-size: var(--fs-14); font-weight: 400; }
.notification-help { display: flex; flex-direction: column; gap: var(--space-3); width: min(320px, calc(100vw - 72px)); }
.notification-help strong { display: block; margin-bottom: var(--space-1); font-size: var(--fs-14); font-weight: 500; }
.notification-help p { margin: 0; }
.notification-help-secondary { color: var(--jet-theme-text-secondary); }
.notification-help p + p { margin-top: var(--space-1); }
</style>
