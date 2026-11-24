<template>
  <div class="parsing">
    <div v-if="initializing" class="parsing-loading">
      <a-spin size="large" :tip="$t('IotDeviceDetail.parsing.loading')" />
    </div>
    <template v-else>
      <div class="parsing-type-bar">
        <div class="parsing-type-bar__left">
          <a-radio-group :value="ruleType" :disabled="reloading || saving" button-style="solid" @update:value="value => onRuleTypeMenuClick({ key: value })">
            <a-radio-button v-for="option in codecMenuItems" :key="option.ruleKey" :value="option.ruleKey">{{ option.label }}</a-radio-button>
          </a-radio-group>
          <span class="parsing-type-desc">{{ currentTypeDesc }}</span>
        </div>
        <div class="parsing-type-bar__actions">
          <a-space :size="8">
            <span v-if="ruleType === 'javascript' && scriptCodecRef?.isDirty" class="parsing-unsaved">{{ $t('deviceDetailOptimization.unsaved') }}</span>
            <a-button size="small" :loading="reloading" :disabled="saving || scriptCodecRef?.resettingConfig" @click="reload">
              <template #icon>
                <ReloadOutlined />
              </template>
              {{ $t('IotDeviceDetail.parsing.reload') }}
            </a-button>
            <a-button v-if="ruleType === 'javascript' && scriptCodecRef?.readOnly" size="small" type="primary" :disabled="reloading" @click="scriptCodecRef?.beginEdit()">{{ $t('IotDeviceDetail.common.edit') }}</a-button>
            <a-button v-if="ruleType === 'javascript' && scriptCodecRef && !scriptCodecRef.readOnly" size="small" :loading="scriptCodecRef.resettingConfig" :disabled="saving || reloading" @click="scriptCodecRef.resetDeviceCodec()">{{ $t('deviceDetailOptimization.restore') }}</a-button>
            <a-button
              v-if="ruleType === 'modbus' || (scriptCodecRef && !scriptCodecRef.readOnly)"
              size="small"
              type="primary"
              :loading="saving"
              :disabled="reloading || (ruleType === 'javascript' && scriptCodecRef?.saveDisabled)"
              @click="save"
            >
              <template #icon>
                <SaveOutlined />
              </template>
              {{ $t('IotDeviceDetail.parsing.saveConfig') }}
            </a-button>
          </a-space>
        </div>
      </div>

      <div class="parsing-body">
        <IotDeviceScriptTransparentCodec
          v-if="ruleType === 'javascript'"
          ref="scriptCodecRef"
          :device="device"
          :product-id="productId"
          :codec="codecState"
          @updated="loadDeviceCodec"
        />
        <FullPage v-else class="parsing-modbus" :padding="0">
          <ModbusMapping
            ref="modbusMappingRef"
            :thing-id="device.id"
            :product-id="productId"
          />
        </FullPage>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, type PropType, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import { FullPage } from '@jetlinks-web-core/layout'

import ModbusMapping from '@device-manager-ui/views/device/list/components/common/ModbusMapping.vue'
import { iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../../types'
import IotDeviceScriptTransparentCodec from './IotDeviceScriptTransparentCodec.vue'

type RuleType = 'javascript' | 'modbus'

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  productId: { type: String, default: undefined },
})

const { t: $t } = useI18n()
const modbusMappingRef = ref<InstanceType<typeof ModbusMapping> | null>(null)
const scriptCodecRef = ref<InstanceType<typeof IotDeviceScriptTransparentCodec> | null>(null)
const reloading = ref(false)
const initializing = ref(true)

const ruleType = ref<RuleType>('javascript')
const codecState = ref<Record<string, any> | null>(null)
const saving = computed(() => {
  if (ruleType.value === 'modbus') return Boolean(modbusMappingRef.value?.saving)
  return Boolean(scriptCodecRef.value?.savingConfig)
})

const PROVIDER_UI_RULE: Record<string, RuleType> = {
  jsr223: 'javascript',
  modbus: 'modbus',
}

const codecSupports = ref<Array<{ id: string }>>([])

const codecMenuItems = computed(() =>
  codecSupports.value.map((support) => {
    const ruleKey = PROVIDER_UI_RULE[support.id]
    return {
      ruleKey,
      label: typeLabel(ruleKey),
    }
  }).filter((item) => item.ruleKey),
)

const currentTypeDesc = computed(() => typeDesc(ruleType.value))

function typeLabel(type: RuleType) {
  return type === 'modbus' ? $t('IotDeviceDetail.parsing.modbusLabel') : $t('IotDeviceDetail.parsing.javascriptLabel')
}

function typeDesc(type: RuleType) {
  return type === 'modbus' ? $t('IotDeviceDetail.parsing.modbusDesc') : $t('IotDeviceDetail.parsing.javascriptDesc')
}

function providerToRuleType(provider?: string): RuleType {
  return provider === 'modbus' ? 'modbus' : 'javascript'
}

function pickRuleTypeFromProvider(provider: string | undefined, supports: Array<{ id: string }>): RuleType {
  const preferred = providerToRuleType(provider)
  const allowedIds = new Set(supports.map((support) => support.id))
  const preferredProvider = preferred === 'modbus' ? 'modbus' : 'jsr223'
  if (allowedIds.has(preferredProvider)) return preferred

  const first = supports[0]?.id
  if (first && PROVIDER_UI_RULE[first]) return PROVIDER_UI_RULE[first]
  return 'javascript'
}

async function loadCodecSupports() {
  try {
    const res: any = await iotDeviceDetailRealApi.getTransparentCodecSupports()
    const raw = res.status === 200 && Array.isArray(res.result) ? res.result : []
    const filtered = raw
      .filter((support: any) => support?.id && PROVIDER_UI_RULE[support.id])
      .map((support: any) => ({ id: String(support.id) }))
    codecSupports.value = filtered.length ? filtered : [{ id: 'jsr223' }, { id: 'modbus' }]
  } catch {
    codecSupports.value = [{ id: 'jsr223' }, { id: 'modbus' }]
  }
}

async function loadDeviceCodec() {
  if (!props.productId || !props.device.id) {
    codecState.value = null
    ruleType.value = pickRuleTypeFromProvider(undefined, codecSupports.value)
    return
  }

  const res: any = await iotDeviceDetailRealApi.getDeviceTransparentCodec(props.productId, props.device.id)
  if (res.status === 200) {
    codecState.value = res.result ?? null
    ruleType.value = pickRuleTypeFromProvider(res.result?.provider, codecSupports.value)
    return true
  }
  return false
}

async function loadParsingConfig() {
  if (!props.device.id || !props.productId) {
    codecState.value = null
    ruleType.value = 'javascript'
    initializing.value = false
    return
  }

  initializing.value = true
  try {
    await loadCodecSupports()
    await loadDeviceCodec()
  } finally {
    initializing.value = false
  }
}

async function reload() {
  if (reloading.value || saving.value || scriptCodecRef.value?.resettingConfig) return
  reloading.value = true
  try {
    const previousType = ruleType.value
    if (!await loadDeviceCodec()) return
    await nextTick()
    if (ruleType.value === 'javascript') scriptCodecRef.value?.reloadCodec()
    else if (previousType === 'modbus') await modbusMappingRef.value?.loadConfig?.()
    message.success($t('deviceDetailOptimization.reloaded'))
  } finally {
    reloading.value = false
  }
}

function save() {
  if (reloading.value || saving.value) return
  if (ruleType.value === 'modbus') {
    modbusMappingRef.value?.saveConfig?.()
    return
  }
  scriptCodecRef.value?.saveCodec?.()
}

async function confirmLeave() {
  if (ruleType.value === 'javascript') return await scriptCodecRef.value?.confirmLeave() ?? true
  return await modbusMappingRef.value?.confirmLeave() ?? true
}

async function onRuleTypeMenuClick(info: { key: string | number }) {
  if (reloading.value || saving.value) return
  const next = String(info.key)
  if (next !== ruleType.value && (next === 'javascript' || next === 'modbus') && await confirmLeave()) {
    ruleType.value = next
  }
}

watch(
  [() => props.device.id, () => props.productId],
  loadParsingConfig,
  { immediate: true },
)
defineExpose({ confirmLeave })
</script>

<style scoped lang="less" src="./IotDeviceParsingTab.less"></style>
