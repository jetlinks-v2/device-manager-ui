<template>
  <a-modal
    :open="visible"
    :title="title"
    width="960px"
    :z-index="MARKETPLACE_MODAL_Z_INDEX"
    :mask-closable="false"
    :closable="canCloseByCancel"
    :keyboard="canCloseByCancel"
    :footer="null"
    destroy-on-close
    @cancel="handleClose"
  >
    <div class="mp-install">
      <div v-if="step === 'pick'" class="mp-install__pick">
        <a-alert type="info" show-icon class="mp-install__tip">
          <template #message>{{ tip }}</template>
        </a-alert>
        <div class="mp-install__picker-wrap">
          <MarketplaceResourcePicker
            v-model="selectedId"
            v-model:version="selectedVersion"
            :default-keyword="defaultKeyword"
            panel-height="100%"
            enable-version-select
            :type-options="[{ label: typeLabel, value: capabilityType }]"
            :show-type-tabs="false"
            :default-type="capabilityType"
            selection-mode="single"
            :labels="pickerLabels"
          />
        </div>
        <div class="mp-install__actions">
          <a-button @click="handleClose">{{ cancelText }}</a-button>
          <a-button
            type="primary"
            :disabled="!canInstall"
            :loading="installing"
            @click="onClickInstallOrPrompt"
          >
            {{ installText }}
          </a-button>
        </div>
      </div>
      <div v-else class="mp-install__progress">
        <a-progress :percent="progressPercent" :status="progressStatus" />
        <div class="mp-install__log-wrap">
          <div class="mp-install__log">
            <div v-for="(line, i) in logLines" :key="i" class="mp-install__log-line">{{ line }}</div>
          </div>
        </div>
        <div class="mp-install__actions">
          <template v-if="installSucceededOnce && progressStatus === 'success' && !installing">
            <a-button type="primary" @click="handleSuccessConfirm">{{ confirmText }}</a-button>
          </template>
          <template v-else-if="progressStatus === 'exception'">
            <a-button @click="handleClose">{{ cancelText }}</a-button>
            <a-button type="primary" @click="backToPick">{{ retryPickText }}</a-button>
          </template>
          <template v-else>
            <a-button :disabled="installing" @click="handleClose">{{ cancelText }}</a-button>
          </template>
        </div>
      </div>
    </div>
  </a-modal>

  <a-modal
    v-model:open="installChoiceVisible"
    :title="choiceTitle"
    :z-index="MARKETPLACE_CHOICE_MODAL_Z_INDEX"
    :mask-closable="false"
    :footer="null"
    width="480px"
    @cancel="installChoiceVisible = false"
  >
    <p class="mp-install__choice-msg">{{ choiceMessage }}</p>
    <div class="mp-install__choice-actions">
      <a-button @click="installChoiceVisible = false">{{ choiceCancel }}</a-button>
      <a-button :loading="installing" @click="runInstallStream(false)">{{ choiceInstall }}</a-button>
      <a-button type="primary" :loading="installing" @click="runInstallStream(true)">{{ choiceUpgrade }}</a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { MarketplaceResourcePicker } from '@jetlinks-web-core/components/MarketplaceResourcePicker'
import { listInstalledMarketplaceResources } from '../../../../api/link/plugin'
import {
  streamCapabilityInstall,
  streamCapabilityUpgrade,
  type ProgressStatePayload,
} from '../../../../utils/streamCapabilityInstall'

type MarketplaceInstallSuccessPayload = {
  dataId?: string
  installedResource?: Record<string, unknown>
  upgraded: boolean
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    /** 能力市场资源类型，插件固定为 plugin */
    capabilityType?: string
    /** 透传安装/升级请求 body（如 name、description；编辑插件时含 id） */
    installPayload?: Record<string, unknown>
    /** 打开时预填到能力搜索框中的关键字（编辑插件时可传 pkgId） */
    defaultKeyword?: string
    /**
     * 从插件编辑页打开：主按钮文案为「确认」而非「安装」，且不出现「升级」字样；
     * 已安装资源时直接走升级流，不再弹出安装/升级二选一。
     */
    pluginEditMode?: boolean
  }>(),
  {
    capabilityType: 'plugin',
    installPayload: () => ({}),
    defaultKeyword: '',
    pluginEditMode: false,
  },
)

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'success', payload?: MarketplaceInstallSuccessPayload): void
}>()

const { t } = useI18n()
const MARKETPLACE_MODAL_Z_INDEX = 1100
const MARKETPLACE_CHOICE_MODAL_Z_INDEX = 1110

const title = computed(() => t('plugin.Save.marketplaceInstallTitle', '从能力市场安装插件'))
const tip = computed(() =>
  t('plugin.Save.marketplaceInstallTip', '请选择插件能力并选择版本后安装'),
)
const typeLabel = computed(() => t('plugin.Save.marketplaceInstallTypeLabel', '插件'))
const cancelText = computed(() => t('Save.index.903552-11'))
const installText = computed(() =>
  props.pluginEditMode
    ? t('plugin.Save.marketplaceInstallConfirm', '确认')
    : t('plugin.Save.marketplaceInstallBtn', '安装'),
)
const confirmText = computed(() => t('plugin.Save.marketplaceInstallConfirm', '确认'))
const retryPickText = computed(() =>
  t('plugin.Save.marketplaceInstallRetryPick', '重新选择'),
)
const choiceTitle = computed(() =>
  t('plugin.Save.marketplaceInstallChoiceTitle', '检测到已安装资源'),
)
const choiceMessage = computed(() =>
  t(
    'plugin.Save.marketplaceInstallChoiceMsg',
    '当前能力在本地已有安装记录，请选择重新安装或升级到所选版本。',
  ),
)
const choiceCancel = computed(() => t('plugin.Save.marketplaceInstallChoiceCancel', '取消'))
const choiceInstall = computed(() => t('plugin.Save.marketplaceInstallChoiceInstall', '安装'))
const choiceUpgrade = computed(() => t('plugin.Save.marketplaceInstallChoiceUpgrade', '升级'))

const pickerLabels = computed(() => ({
  all: t('plugin.Save.marketplacePickerAll', '全部'),
  tags: t('plugin.Save.marketplacePickerTags', '标签'),
  searchPlaceholder: t('plugin.Save.marketplacePickerSearch', '搜索'),
  empty: t('plugin.Save.marketplacePickerEmpty', '暂无能力'),
  noResourceTypes: t('plugin.Save.marketplacePickerNoTypes', '暂无类型'),
  version: t('plugin.Save.marketplaceInstallVersion', '版本'),
  versionPlaceholder: t('plugin.Save.marketplaceInstallVersionPh', '请选择版本'),
  viewReleaseNotes: t('plugin.Save.marketplaceViewReleaseNotes', '查看版本说明'),
  releaseNotesTitle: t('plugin.Save.marketplaceReleaseNotesTitle', '版本说明'),
  viewDocument: t('plugin.Save.marketplaceViewDocument', '查看文档'),
  resourceDocumentTitle: t('plugin.Save.marketplaceResourceDocumentTitle', '资源文档'),
  versionSummary: t('plugin.Save.marketplaceVersionSummary', '版本摘要'),
}))

const step = ref<'pick' | 'progress'>('pick')
const selectedId = ref<string | undefined>(undefined)
const selectedVersion = ref<string | undefined>(undefined)
const installing = ref(false)
/** 本次弹窗内是否已完成安装/升级，确认后再将结果回传给调用方 */
const installSucceededOnce = ref(false)
const lastSuccessPayload = ref<MarketplaceInstallSuccessPayload>()
const logLines = ref<string[]>([])
const progressPercent = ref(0)
const progressStatus = ref<'active' | 'success' | 'exception' | 'normal'>('active')

/** MarketplaceClientController#listInstalled 返回的已安装资源 */
const installedResources = ref<any[]>([])
const installChoiceVisible = ref(false)

const canInstall = computed(
  () => Boolean(selectedId.value && selectedVersion.value && !installing.value),
)
const canCloseByCancel = computed(
  () => !installing.value && !(installSucceededOnce.value && progressStatus.value === 'success'),
)

const hasInstalledResources = computed(() => installedResources.value.length > 0)

function unwrapInstalledList(res: any): any[] {
  if (Array.isArray(res)) return res
  if (res?.success === false) return []
  const r = res?.result ?? res?.data
  return Array.isArray(r) ? r : []
}

function extractInstalledResource(state?: ProgressStatePayload): Record<string, unknown> | undefined {
  if (!state) return undefined
  const candidates = [state.data, state.extra]
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>
    }
  }
  return undefined
}

function extractInstalledDataId(state?: ProgressStatePayload): string | undefined {
  const installedResource = extractInstalledResource(state)
  const raw =
    installedResource?.dataId ??
    installedResource?.id ??
    ((installedResource?.data as Record<string, unknown> | undefined)?.dataId as string | undefined) ??
    ((installedResource?.result as Record<string, unknown> | undefined)?.dataId as string | undefined)

  return raw != null && raw !== '' ? String(raw) : undefined
}

function buildSuccessPayload(
  state: ProgressStatePayload | undefined,
  upgraded: boolean,
): MarketplaceInstallSuccessPayload {
  return {
    dataId: extractInstalledDataId(state),
    installedResource: extractInstalledResource(state),
    upgraded,
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      step.value = 'pick'
      selectedId.value = undefined
      selectedVersion.value = undefined
      installedResources.value = []
      installChoiceVisible.value = false
      installSucceededOnce.value = false
      lastSuccessPayload.value = undefined
      logLines.value = []
      progressPercent.value = 0
      progressStatus.value = 'active'
    }
  },
)

watch(selectedId, async (capId) => {
  installedResources.value = []
  if (!capId) return
  try {
    const res: any = await listInstalledMarketplaceResources(props.capabilityType, capId, [])
    installedResources.value = unwrapInstalledList(res)
  } catch {
    installedResources.value = []
  }
})

function onClickInstallOrPrompt() {
  if (!selectedId.value || !selectedVersion.value) return
  if (props.pluginEditMode) {
    runInstallStream(hasInstalledResources.value)
    return
  }
  if (hasInstalledResources.value) {
    installChoiceVisible.value = true
    return
  }
  runInstallStream(false)
}

function runInstallStream(useUpgrade: boolean) {
  installChoiceVisible.value = false
  startInstall(useUpgrade)
}

async function startInstall(useUpgrade: boolean) {
  if (!selectedId.value || !selectedVersion.value) return
  installing.value = true
  step.value = 'progress'
  logLines.value = []
  progressPercent.value = 0
  progressStatus.value = 'active'
  lastSuccessPayload.value = undefined
  let finished = false
  const stream = useUpgrade ? streamCapabilityUpgrade : streamCapabilityInstall
  try {
    await stream(
      selectedId.value,
      selectedVersion.value,
      { ...(props.installPayload || {}) },
      (state: ProgressStatePayload) => {
        const st = String(state.type || '').toLowerCase() as ProgressStatePayload['type']
        if (state.message) logLines.value.push(state.message)
        if (st === 'progress') {
          progressPercent.value = Math.min(95, progressPercent.value + 5)
        }
        if (st === 'success' && !finished) {
          finished = true
          progressPercent.value = 100
          progressStatus.value = 'success'
          installSucceededOnce.value = true
          lastSuccessPayload.value = buildSuccessPayload(state, useUpgrade)
          onlyMessage(t('plugin.Save.marketplaceInstallOk', '安装成功'), 'success')
        }
        if (st === 'error') {
          progressStatus.value = 'exception'
          onlyMessage(state.message || 'error', 'error')
        }
      },
    )
    if (!finished && progressStatus.value === 'active') {
      progressPercent.value = 100
      progressStatus.value = 'success'
      installSucceededOnce.value = true
      lastSuccessPayload.value = buildSuccessPayload(undefined, useUpgrade)
      onlyMessage(t('plugin.Save.marketplaceInstallOk', '安装成功'), 'success')
    }
  } catch (e: any) {
    progressStatus.value = 'exception'
    logLines.value.push(String(e?.message || e))
    onlyMessage(e?.message || 'install failed', 'error')
  } finally {
    installing.value = false
  }
}

function backToPick() {
  step.value = 'pick'
  progressPercent.value = 0
  progressStatus.value = 'active'
}

function handleSuccessConfirm() {
  const payload = lastSuccessPayload.value
  installSucceededOnce.value = false
  lastSuccessPayload.value = undefined
  emit('update:visible', false)
  emit('success', payload)
}

function handleClose() {
  installSucceededOnce.value = false
  lastSuccessPayload.value = undefined
  emit('update:visible', false)
}
</script>

<style scoped lang="less">
.mp-install__pick {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mp-install__tip {
  margin-bottom: 0;
}
.mp-install__picker-wrap {
  height: 520px;
  max-height: min(520px, calc(100vh - 200px));
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 8px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mp-install__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.mp-install__log-wrap {
  max-height: 360px;
  margin-top: 12px;
  overflow: auto;
}
.mp-install__log {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
.mp-install__log-line {
  padding: 2px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
}
.mp-install__choice-msg {
  margin: 0 0 8px;
  color: rgba(0, 0, 0, 0.65);
  line-height: 1.6;
}
.mp-install__choice-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
</style>
