<template>
  <article :class="['cv-model-card', `is-${statusKind}`]">
    <header class="cv-model-card__header">
      <div class="cv-model-card__avatar">
        <AIcon type="DeploymentUnitOutlined" />
      </div>
      <div class="cv-model-card__identity">
        <strong>{{ item.name }}</strong>
        <span>{{ item.sceneName }}</span>
      </div>
      <a-segmented
        :key="stateControlKey"
        class="cv-model-card__state"
        size="small"
        :value="stateSegmentValue"
        :options="stateOptions"
        :disabled="loading"
        @change="handleStateChange"
      />
    </header>

    <div class="cv-model-card__meta">
      <span v-for="row in metaRows" :key="row.key">
        <small>{{ row.label }}</small>
        <b>{{ row.value }}</b>
      </span>
    </div>

    <section class="cv-model-card__status">
      <div class="cv-model-card__status-icon">
        <AIcon :type="statusIcon" />
      </div>
      <div class="cv-model-card__status-text">
        <strong>
          {{ statusTitle }}
          <a-tag v-if="statusTag" :color="statusTagColor">{{ statusTag }}</a-tag>
        </strong>
        <span v-if="statusDescription">{{ statusDescription }}</span>
        <div v-if="showUpgradeActions" class="cv-model-card__status-actions">
          <a-popconfirm
            v-if="item.upgradeable"
            :title="$t('GatewayCvModelCard.upgradeConfirm')"
            @confirm="emit('upgrade', item)"
          >
            <a-button type="primary" :loading="loading">
              <template #icon><AIcon type="CloudSyncOutlined" /></template>
              {{ $t('GatewayCvModelCard.upgrade') }}
            </a-button>
          </a-popconfirm>
          <a-button @click="emit('open-upgrade-diff', item)">
            <template #icon><AIcon type="UnorderedListOutlined" /></template>
            {{ $t('GatewayCvModelCard.upgradeDiff') }}
          </a-button>
        </div>
      </div>
    </section>

    <footer class="cv-model-card__actions">
      <a-button :loading="loading" @click="emit('check-upgrade', item)">
        <template #icon><AIcon type="SyncOutlined" /></template>
        {{ $t('GatewayCvModelCard.checkUpgrade') }}
      </a-button>
      <span class="cv-model-card__actions-spacer" />
      <a-button type="link" @click="emit('open-used-sources', item)">
        <template #icon><AIcon type="ApartmentOutlined" /></template>
        {{ $t('GatewayCvModelCard.usedSources') }}
      </a-button>
      <a-button type="link" @click="emit('open-versions', item)">
        <template #icon><AIcon type="HistoryOutlined" /></template>
        {{ $t('GatewayCvModelCard.versions') }}
      </a-button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GatewayCvModelItem } from '../gatewayCvModel.types'

type StatusKind = 'upgradable' | 'latest' | 'running' | 'disabled' | 'unsupported'

const props = defineProps({
  item: {
    type: Object as PropType<GatewayCvModelItem>,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (e: 'check-upgrade', item: GatewayCvModelItem): void
  (e: 'open-upgrade-diff', item: GatewayCvModelItem): void
  (e: 'upgrade', item: GatewayCvModelItem): void
  (e: 'open-used-sources', item: GatewayCvModelItem): void
  (e: 'open-versions', item: GatewayCvModelItem): void
  (e: 'toggle-state', item: GatewayCvModelItem): void
}>()

const { t: $t } = useI18n()
const isEnabled = computed(() => props.item.stateValue === 'enabled')
const stateSegmentValue = computed(() => isEnabled.value ? 'enabled' : 'disabled')
const stateControlKey = computed(() => `${props.item.id}-${stateSegmentValue.value}-${props.loading ? 'loading' : 'idle'}`)
const stateOptions = computed(() => [
  { label: $t('GatewayCvModelCard.disable'), value: 'disabled' },
  { label: $t('GatewayCvModelCard.enable'), value: 'enabled' },
])
const hasUpgradeCheckResult = computed(() => Boolean(props.item.upgradeCheckResult))
const showUpgradeActions = computed(() => hasUpgradeCheckResult.value && !props.item.upgradeCheckResult?.upgradeUnsupported)
const currentVersionText = computed(() => props.item.usesDefaultVersion
  ? $t('GatewayCvModelCard.defaultVersion')
  : props.item.currentVersionText)
const runtimeFormatText = computed(() => props.item.runtimeText || (props.item.runtimeFormatKind === 'zlmediaPackage'
  ? $t('GatewayCvModelCard.runtime.zlmediaPackage')
  : ''))
const metaRows = computed(() => {
  const rows = [
    {
      key: 'currentVersion',
      label: $t('GatewayCvModelCard.currentVersion'),
      value: currentVersionText.value,
    },
    {
      key: 'usedSourceCount',
      label: $t('GatewayCvModelCard.usedSourceCount'),
      value: $t('GatewayCvModelCard.cameraCount', { count: props.item.usedSourceCount }),
    },
  ]
  if (runtimeFormatText.value) {
    rows.push({
      key: 'runtimeFormat',
      label: $t('GatewayCvModelCard.runtimeFormat'),
      value: runtimeFormatText.value,
    })
  }
  return rows
})
const statusKind = computed<StatusKind>(() => {
  if (hasUpgradeCheckResult.value) {
    if (props.item.upgradeCheckResult?.upgradeUnsupported) return 'unsupported'
    return props.item.upgradeable ? 'upgradable' : 'latest'
  }
  if (!isEnabled.value) return 'disabled'
  return props.item.upgradeable ? 'upgradable' : 'running'
})
const statusIcon = computed(() => {
  const icons: Record<StatusKind, string> = {
    upgradable: 'ArrowUpOutlined',
    latest: 'CheckOutlined',
    running: 'CheckOutlined',
    disabled: 'PoweroffOutlined',
    unsupported: 'InfoCircleOutlined',
  }
  return icons[statusKind.value]
})
const statusTitle = computed(() => {
  if (statusKind.value === 'disabled') return $t('GatewayCvModelCard.disabledTitle')
  if (statusKind.value === 'unsupported') return $t('GatewayCvModelCard.upgradeUnsupportedTitle')
  if (statusKind.value === 'upgradable') return $t('GatewayCvModelCard.upgradeableTitle')
  if (statusKind.value === 'latest') return $t('GatewayCvModelCard.latestTitle')
  return $t('GatewayCvModelCard.runningTitle')
})
const statusTag = computed(() => {
  if (statusKind.value === 'disabled') return ''
  if (statusKind.value === 'unsupported') return ''
  if (statusKind.value === 'latest') return $t('GatewayCvModelCard.latest')
  if (statusKind.value === 'upgradable') {
    return props.item.candidateVersionText && props.item.candidateVersionText !== '--'
      ? props.item.candidateVersionText
      : $t('GatewayCvModelCard.upgradeable')
  }
  return $t('GatewayCvModelCard.runningTag', { version: currentVersionText.value })
})
const statusTagColor = computed(() => {
  if (statusKind.value === 'disabled') return 'warning'
  if (statusKind.value === 'unsupported') return 'default'
  if (statusKind.value === 'latest') return 'success'
  return statusKind.value === 'upgradable' ? 'warning' : 'processing'
})
const statusDescription = computed(() => {
  if (statusKind.value === 'disabled') return ''
  if (statusKind.value === 'unsupported') return $t('GatewayCvModelCard.upgradeUnsupportedDescription')
  if (statusKind.value === 'latest') return $t('GatewayCvModelCard.latestDescription')
  if (statusKind.value === 'running') return $t('GatewayCvModelCard.currentDescription')
  return $t('GatewayCvModelCard.candidateDescription')
})

function handleStateChange(value: string | number) {
  if (String(value) === stateSegmentValue.value) return
  emit('toggle-state', props.item)
}
</script>

<style scoped lang="less" src="./GatewayCvModelCard.less"></style>
