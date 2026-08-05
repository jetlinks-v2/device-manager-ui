import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  queryCvModels,
  queryModelVersions,
} from '../services/gatewayCvModel.service'
import {
  queryGatewayCvModelUsage,
  queryModelUsedSourceCounts,
} from '../services/gatewayCvModelUsage.service'
import {
  buildGatewayCvModelItem,
  buildGatewayCvOverviewFromItems,
} from '../utils/gatewayCvModelFormat'
import { useGatewayCvModelActions } from './useGatewayCvModelActions'
import type {
  EdgeGatewayModelUsageResponse,
  EdgeGatewayModelUpgradeCheckResult,
  GatewayCvModelItem,
  GatewayCvModelSummary,
  ModelVersionInfo,
  RuntimeGatewayDevice,
} from '../gatewayCvModel.types'

const EMPTY_SUMMARY: GatewayCvModelSummary = {
  onlineCameraCount: 0,
  deployedModelCount: 0,
  upgradableCount: 0,
}

export function useGatewayCvModels(gateway: () => RuntimeGatewayDevice | undefined) {
  const { t: $t } = useI18n()
  const loading = ref(false)
  const usageLoading = ref(false)
  const versionLoading = ref(false)
  const loaded = ref(false)
  const usageCountRequestId = ref(0)
  const errorMessage = ref('')
  const items = ref<GatewayCvModelItem[]>([])
  const overview = ref<GatewayCvModelSummary>({ ...EMPTY_SUMMARY })
  const selectedModel = ref<GatewayCvModelItem>()
  const usage = ref<EdgeGatewayModelUsageResponse>()
  const usedSourcesOpen = ref(false)
  const versionsOpen = ref(false)
  const upgradeDiffOpen = ref(false)
  const summary = computed(() => overview.value)
  const canBatchCheck = computed(() => items.value.length > 0)
  const {
    actionLoading,
    batchCheckUpgrade,
    rollback,
    clean,
    checkUpgrade,
    upgrade,
    toggleModelState,
  } = useGatewayCvModelActions(gateway, {
    modelItems: computed(() => items.value),
    selectedModel,
    versionsOpen,
    refresh,
    loadVersions,
    patchItemUpgradeCheck,
  })

  async function load(force = false) {
    const current = gateway()
    errorMessage.value = ''
    if (!current?.id || statusValue(current) !== 'online') {
      resetData()
      return
    }
    if (force) loaded.value = false
    if (loaded.value && !force) return
    usageCountRequestId.value += 1
    loading.value = true
    try {
      const modelResult = await queryCvModels(current)
      if (!modelResult.ok) {
        errorMessage.value = $t('GatewayCvModelPanel.loadFailedDesc')
        items.value = []
        loaded.value = false
        return
      }

      // 进入页面只读取模型清单；历史版本和使用范围按抽屉打开再查，避免初始化阶段放大额外接口失败。
      const rows = modelResult.data.map(model => buildGatewayCvModelItem(model, model.versionInfo, 0))

      items.value = rows
      overview.value = buildGatewayCvOverviewFromItems(rows)
      loaded.value = true
      syncSelectedModel()
      void loadUsedSourceCounts(current, rows.map(item => item.id))
    } catch (error) {
      console.warn('[EdgeGateway] Failed to load cv models.', error)
      errorMessage.value = $t('GatewayCvModelPanel.loadFailed')
      items.value = []
      loaded.value = false
    } finally {
      loading.value = false
    }
  }

  function refresh() {
    return load(true)
  }

  async function loadUsedSourceCounts(current: RuntimeGatewayDevice, modelIds: string[]) {
    const requestId = ++usageCountRequestId.value
    const result = await queryModelUsedSourceCounts(current, modelIds)
    // 统计请求是异步补数，网关切换或强制刷新后只允许最新一次回写。
    if (requestId !== usageCountRequestId.value || gateway()?.id !== current.id) return
    if (!result.ok) return

    items.value = items.value.map((item) => {
      const count = result.data[item.id]
      return count === undefined || count === item.usedSourceCount
        ? item
        : { ...item, usedSourceCount: count }
    })
    overview.value = buildGatewayCvOverviewFromItems(items.value)
    syncSelectedModel()
  }

  function openUsedSources(model: GatewayCvModelItem) {
    selectedModel.value = model
    usage.value = undefined
    usedSourcesOpen.value = true
    void loadUsage()
  }

  function openVersions(model: GatewayCvModelItem) {
    selectedModel.value = model
    versionsOpen.value = true
    void loadVersions(model.id)
  }

  function closeUsedSources() {
    usedSourcesOpen.value = false
  }

  function closeVersions() {
    versionsOpen.value = false
  }

  function openUpgradeDiff(model: GatewayCvModelItem) {
    selectedModel.value = model
    upgradeDiffOpen.value = true
  }

  function closeUpgradeDiff() {
    upgradeDiffOpen.value = false
  }

  async function loadUsage() {
    const current = gateway()
    const model = selectedModel.value
    if (!current || !model) {
      usage.value = undefined
      return
    }

    usageLoading.value = true
    try {
      const result = await queryGatewayCvModelUsage(current, model.id)
      if (result.ok) {
        usage.value = result.data
      } else {
        usage.value = undefined
        onlyMessage($t('GatewayCvModelUsedSourcesDrawer.loadFailed'), 'error')
      }
    } finally {
      usageLoading.value = false
    }
  }

  async function loadVersions(modelId: string) {
    const current = gateway()
    const index = items.value.findIndex(item => item.id === modelId)
    if (!current || index < 0) return

    versionLoading.value = true
    try {
      const result = await queryModelVersions(current, modelId)
      if (result.ok) {
        patchItemVersion(modelId, result.data)
      } else {
        onlyMessage($t('GatewayCvModelVersionDrawer.loadFailed'), 'error')
      }
    } finally {
      versionLoading.value = false
    }
  }

  function patchItemVersion(modelId: string, versionInfo: ModelVersionInfo) {
    const index = items.value.findIndex(item => item.id === modelId)
    if (index < 0) return

    const item = items.value[index]
    const next = buildGatewayCvModelItem({
      ...item.model,
      currentVersion: item.model.currentVersion ?? item.currentVersionValue,
      versionInfo,
    }, versionInfo, item.usedSourceCount)

    items.value.splice(index, 1, {
      ...item,
      ...next,
      versionInfo: next.versionInfo,
      upgradeable: item.upgradeable,
      candidateVersionText: item.candidateVersionText,
      upgradeCheckResult: item.upgradeCheckResult,
    })
    syncSelectedModel()
  }

  function patchItemUpgradeCheck(
    modelId: string,
    result: EdgeGatewayModelUpgradeCheckResult,
    candidateVersionText: string,
  ) {
    const index = items.value.findIndex(item => item.id === modelId)
    if (index < 0) return

    const item = items.value[index]
    items.value.splice(index, 1, {
      ...item,
      upgradeable: result.upgradable === true,
      candidateVersionText: result.upgradable
        ? candidateVersionText
        : result.upgradeUnsupported ? '' : item.candidateVersionText,
      upgradeCheckResult: result,
    })
    overview.value = buildGatewayCvOverviewFromItems(items.value)
    syncSelectedModel()
  }

  function syncSelectedModel() {
    const selected = selectedModel.value
    if (!selected) return
    selectedModel.value = items.value.find(item => item.id === selected.id) || selected
  }

  function resetData() {
    usageCountRequestId.value += 1
    items.value = []
    overview.value = { ...EMPTY_SUMMARY }
    selectedModel.value = undefined
    usage.value = undefined
    loaded.value = false
  }

  return {
    loading,
    usageLoading,
    versionLoading,
    actionLoading,
    errorMessage,
    items,
    summary,
    canBatchCheck,
    selectedModel,
    usage,
    usedSourcesOpen,
    versionsOpen,
    upgradeDiffOpen,
    load,
    batchCheckUpgrade,
    openUsedSources,
    openVersions,
    closeUsedSources,
    closeVersions,
    openUpgradeDiff,
    closeUpgradeDiff,
    rollback,
    clean,
    checkUpgrade,
    upgrade,
    toggleModelState,
  }
}

function statusValue(gateway?: RuntimeGatewayDevice) {
  const state = gateway?.state
  if (state && typeof state === 'object') return state.value
  return state
}
