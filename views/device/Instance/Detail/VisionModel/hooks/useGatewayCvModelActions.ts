import type { ComputedRef, Ref } from 'vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  checkCvModelUpgrade,
  cleanModelVersion,
  disableCvModel,
  enableCvModel,
  rollbackModelVersion,
  upgradeCvModel,
} from '../services/gatewayCvModel.service'
import { versionIdentity } from '../utils/gatewayCvModelFormat'
import type {
  EdgeGatewayModelUpgradeCheckResult,
  GatewayCvModelItem,
  ModelVersionRecord,
  RuntimeGatewayDevice,
} from '../gatewayCvModel.types'

type GatewayCvModelActionsContext = {
  modelItems: ComputedRef<GatewayCvModelItem[]>
  selectedModel: Ref<GatewayCvModelItem | undefined>
  versionsOpen: Ref<boolean>
  refresh: () => Promise<void>
  loadVersions: (modelId: string) => Promise<void>
  patchItemUpgradeCheck: (
    modelId: string,
    result: EdgeGatewayModelUpgradeCheckResult,
    candidateVersionText: string,
  ) => void
}

export function useGatewayCvModelActions(
  gateway: () => RuntimeGatewayDevice | undefined,
  context: GatewayCvModelActionsContext,
) {
  const { t: $t } = useI18n()
  const actionLoading = ref(false)

  async function batchCheckUpgrade() {
    const current = gateway()
    const models = context.modelItems.value.filter(item => item.id)
    if (!current || !models.length) return

    return runAction(async () => {
      let upgradable = 0
      let unsupported = 0
      let failed = 0
      for (const model of models) {
        const result = await checkCvModelUpgrade(current, model.id)
        if (!result.ok) {
          failed += 1
          continue
        }
        if (result.data.upgradeUnsupported) unsupported += 1
        if (result.data.upgradable) upgradable += 1
        context.patchItemUpgradeCheck(model.id, result.data, upgradeDiffText(result.data, $t))
      }
      if (failed > 0) {
        onlyMessage($t('GatewayCvModelPanel.batchCheckPartial', {
          checked: models.length - failed,
          failed,
          upgradable,
          unsupported,
        }), 'warning')
        return
      }
      onlyMessage($t('GatewayCvModelPanel.batchCheckSuccess', {
        count: models.length,
        upgradable,
        unsupported,
      }), 'success')
    })
  }

  async function rollback(version: ModelVersionRecord) {
    const action = actionContext(version)
    if (!action) return

    return runAction(async () => {
      const result = await rollbackModelVersion(action.gateway, action.model.id, versionIdentity(version)!)
      if (result.ok) {
        onlyMessage($t('GatewayCvModelVersionDrawer.rollbackSuccess'), 'success')
        await reloadAfterMutation(action.model.id)
      } else {
        onlyMessage($t('GatewayCvModelVersionDrawer.rollbackFailed'), 'error')
      }
    })
  }

  async function clean(version: ModelVersionRecord) {
    const action = actionContext(version)
    if (!action) return

    return runAction(async () => {
      const result = await cleanModelVersion(action.gateway, action.model.id, versionIdentity(version)!)
      if (result.ok) {
        onlyMessage($t('GatewayCvModelVersionDrawer.cleanSuccess'), 'success')
        await reloadAfterMutation(action.model.id)
      } else {
        onlyMessage($t('GatewayCvModelVersionDrawer.cleanFailed'), 'error')
      }
    })
  }

  async function upgrade(_model: GatewayCvModelItem) {
    const current = gateway()
    if (!current || !_model.upgradeable) return

    return runAction(async () => {
      const result = await upgradeCvModel(current, _model.id)
      if (result.ok) {
        onlyMessage($t('GatewayCvModelCard.upgradeSuccess'), 'success')
        await reloadAfterMutation(_model.id)
      } else {
        onlyMessage($t('GatewayCvModelCard.upgradeFailed'), 'error')
      }
    })
  }

  async function checkUpgrade(model: GatewayCvModelItem) {
    const current = gateway()
    if (!current || !model.id) return

    return runAction(async () => {
      const result = await checkCvModelUpgrade(current, model.id)
      if (!result.ok) {
        onlyMessage($t('GatewayCvModelCard.checkUpgradeFailed'), 'error')
        return
      }

      const candidateVersionText = upgradeDiffText(result.data, $t)
      context.patchItemUpgradeCheck(model.id, result.data, candidateVersionText)
      if (result.data.upgradeUnsupported) {
        onlyMessage($t('GatewayCvModelCard.checkUpgradeUnsupported'), 'warning')
        return
      }
      onlyMessage($t(result.data.upgradable
        ? 'GatewayCvModelCard.checkUpgradeFound'
        : 'GatewayCvModelCard.checkUpgradeLatest'), 'success')
    })
  }

  async function toggleModelState(model: GatewayCvModelItem) {
    const current = gateway()
    if (!current || !model.id) return

    const enabled = isEnabled(model)
    return runAction(async () => {
      const result = enabled
        ? await disableCvModel(current, model.id)
        : await enableCvModel(current, model.id)

      if (result.ok) {
        onlyMessage($t(enabled
          ? 'GatewayCvModelCard.disableSuccess'
          : 'GatewayCvModelCard.enableSuccess'), 'success')
        await reloadAfterMutation(model.id)
      } else {
        onlyMessage($t(enabled
          ? 'GatewayCvModelCard.disableFailed'
          : 'GatewayCvModelCard.enableFailed'), 'error')
      }
    })
  }

  async function reloadAfterMutation(modelId?: string) {
    await context.refresh()
    if (modelId && context.versionsOpen.value) await context.loadVersions(modelId)
  }

  function actionContext(version: ModelVersionRecord) {
    const current = gateway()
    const model = context.selectedModel.value
    if (!current || !model || !versionIdentity(version)) return undefined
    return { gateway: current, model }
  }

  async function runAction(task: () => Promise<void>) {
    actionLoading.value = true
    try {
      await task()
    } finally {
      actionLoading.value = false
    }
  }

  return {
    actionLoading,
    batchCheckUpgrade,
    rollback,
    clean,
    checkUpgrade,
    upgrade,
    toggleModelState,
  }
}

function isEnabled(model: GatewayCvModelItem) {
  return model.stateValue === 'enabled'
}

function upgradeDiffText(
  result: EdgeGatewayModelUpgradeCheckResult,
  translate: (key: string, params?: Record<string, number>) => string,
) {
  const count = diffCount(result)
  return result.upgradable && count > 0
    ? translate('GatewayCvModelCard.upgradeDiffCount', { count })
    : ''
}

function diffCount(result: EdgeGatewayModelUpgradeCheckResult) {
  return (result.added?.length || 0)
    + (result.upgraded?.length || 0)
    + (result.removed?.length || 0)
}
