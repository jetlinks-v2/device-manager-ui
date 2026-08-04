<template>
  <div class="parsing">
    <div v-if="initializing" class="parsing-loading">
      <a-spin size="large" :tip="$t('IotDeviceDetail.parsing.loading')" />
    </div>
    <template v-else>
      <div class="parsing-type-bar">
        <div class="parsing-type-bar__left">
          <a-dropdown v-if="codecMenuItems.length > 1" trigger="click" placement="bottomLeft">
            <a-button class="parsing-type-trigger">
              <span class="parsing-type-trigger__text">{{ currentTypeLabel }}</span>
              <DownOutlined class="parsing-type-trigger__caret" />
            </a-button>
            <template #overlay>
              <a-menu :selected-keys="[ruleType]" class="parsing-type-menu" @click="onRuleTypeMenuClick">
                <a-menu-item v-for="option in codecMenuItems" :key="option.ruleKey">
                  {{ option.label }}
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
          <div v-else class="parsing-type-trigger parsing-type-trigger--static">
            <span class="parsing-type-trigger__text">{{ currentTypeLabel }}</span>
          </div>
          <span class="parsing-type-desc">{{ currentTypeDesc }}</span>
        </div>
        <div class="parsing-type-bar__actions">
          <a-space :size="8">
            <a-button size="small" :loading="reloading" @click="reload">
              <template #icon>
                <ReloadOutlined />
              </template>
              {{ $t('IotDeviceDetail.parsing.reload') }}
            </a-button>
            <a-button
              size="small"
              type="primary"
              :loading="saving"
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
        <div v-else class="parsing-modbus">
          <ModbusMapping
            ref="modbusMappingRef"
            :thing-id="device.id"
            :product-id="productId"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType, ref, watch } from 'vue'
import { DownOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'

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

const currentTypeLabel = computed(() => typeLabel(ruleType.value))
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
  }
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
  reloading.value = true
  try {
    if (ruleType.value === 'modbus') {
      await modbusMappingRef.value?.loadConfig?.()
    } else {
      await loadDeviceCodec()
    }
  } finally {
    reloading.value = false
  }
}

function save() {
  if (ruleType.value === 'modbus') {
    modbusMappingRef.value?.saveConfig?.()
    return
  }
  scriptCodecRef.value?.saveCodec?.()
}

function onRuleTypeMenuClick(info: { key: string | number }) {
  const next = String(info.key)
  if (next === 'javascript' || next === 'modbus') {
    ruleType.value = next
  }
}

watch(
  [() => props.device.id, () => props.productId],
  loadParsingConfig,
  { immediate: true },
)
</script>

<style scoped lang="less" src="./IotDeviceParsingTab.less"></style>
