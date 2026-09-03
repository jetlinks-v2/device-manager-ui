<template>
  <section class="cv-model-overview">
    <div class="cv-model-overview__stats">
      <div class="cv-model-overview__stat">
        <span>{{ $t('GatewayCvModelOverview.usedSourceTotal') }}</span>
        <strong>{{ summary.onlineCameraCount }}</strong>
      </div>
      <div class="cv-model-overview__stat">
        <span>{{ $t('GatewayCvModelOverview.deployedModelCount') }}</span>
        <strong>{{ summary.deployedModelCount }}</strong>
      </div>
      <div class="cv-model-overview__stat">
        <span>{{ $t('GatewayCvModelOverview.upgradableCount') }}</span>
        <strong>{{ summary.upgradableCount }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GatewayCvModelSummary } from '../gatewayCvModel.types'

defineProps({
  summary: {
    type: Object as PropType<GatewayCvModelSummary>,
    required: true,
  },
})

const { t: $t } = useI18n()
</script>

<style scoped lang="less">
.cv-model-overview {
  display: grid;
  min-width: 0;
  background: transparent;
}

.cv-model-overview__stat span {
  margin: 0;
  color: var(--jet-theme-text-tertiary, var(--jet-theme-text-disabled));
  font-size: var(--fs-14);
}

.cv-model-overview__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
}

.cv-model-overview__stat {
  display: grid;
  gap: var(--space-1);
  padding-inline: var(--space-3);
}

.cv-model-overview__stat + .cv-model-overview__stat {
  border-left: var(--jet-theme-stroke-width) solid var(--jet-theme-border);
}

.cv-model-overview__stat strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-20);
  line-height: 1.25;
}

@media (max-width: 42rem) {
  .cv-model-overview__stats {
    grid-template-columns: 1fr;
  }

  .cv-model-overview__stat {
    padding-block: var(--space-2);
    padding-inline: 0;
  }

  .cv-model-overview__stat + .cv-model-overview__stat {
    border-top: var(--jet-theme-stroke-width) solid var(--jet-theme-border);
    border-left: 0;
  }
}
</style>
