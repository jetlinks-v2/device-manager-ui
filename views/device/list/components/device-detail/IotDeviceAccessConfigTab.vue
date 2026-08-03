<template>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DeviceTemplate } from '../../services/device-library/types'
import type { IotDevice } from '../../types'
import StandardThingModelView from '@device-manager-ui/views/device/shared/standard-model/StandardThingModelView.vue'
import type { IotDeviceLibraryThingModelDefinition } from '@device-manager-ui/views/device/shared/device-library/services/deviceLibrary.types'
import { buildThingModelDefinitionFromTemplate } from '@device-manager-ui/views/device/shared/standard-model/standardModelMappers'

const props = defineProps({
  device: {
    type: Object as PropType<IotDevice>,
    required: true,
  },
  productTemplate: {
    type: Object as PropType<DeviceTemplate | null>,
    default: null,
  },
  showThingModel: {
    type: Boolean,
    default: false,
  },
})

const { t: $t } = useI18n()
const credentialRevealed = ref(false)

const matchedModel = computed(() => {
  const models = props.productTemplate?.supportedModels ?? []
  return models.find((model) => {
    return props.device.accessMode.includes(model.accessName) || model.accessName.includes(props.device.accessMode)
  }) ?? models[0]
})

const protocolLabel = computed(() => {
  const value = `${props.device.accessMode} ${matchedModel.value?.accessName ?? ''}`.toLowerCase()
  if (value.includes('gb28181')) return 'GB28181'
  if (value.includes('onvif')) return 'ONVIF'
  if (value.includes('modbus') || value.includes('rs485')) return 'Modbus'
  if (value.includes('coap')) return 'CoAP'
  if (value.includes('api')) return 'HTTP API'
  if (value.includes('zigbee')) return 'Zigbee'
  if (value.includes('mqtt') || value.includes('nb-iot') || value.includes('4g')) return 'MQTT'
  return props.device.accessMode.split(/[ /]/)[0] || $t('IotDeviceDetail.accessConfig.defaultProtocol')
})

const accessMethodTitle = computed(() => matchedModel.value?.accessName ?? props.device.accessMode)
const accessMethodDesc = computed(() => {
  return matchedModel.value?.connectionHint
    ?? props.productTemplate?.connectionHint
    ?? $t('IotDeviceDetail.accessConfig.defaultDesc', { accessMode: props.device.accessMode })
})

const endpointHost = computed(() => {
  const identifier = props.device.identifier.toLowerCase()
  if (protocolLabel.value === 'Modbus') return `rtu://${props.device.gatewayName ?? 'collector.project-iot.local'}/${identifier}`
  if (protocolLabel.value === 'GB28181') return 'sip:34020000002000000001@gb28181.project-iot.local'
  if (protocolLabel.value === 'ONVIF') return `onvif://camera.project-iot.local/${identifier}`
  if (protocolLabel.value === 'HTTP API') return 'https://api.project-iot.local'
  if (protocolLabel.value === 'CoAP') return 'coap.project-iot.local'
  return 'mqtt://mqtt.project-iot.local:1883'
})

const topicPrefix = computed(() => {
  const productKey = props.device.productKey ?? props.device.deviceType
  return `/iot/${productKey}/${props.device.identifier}`
})

const accessAddress = computed(() => {
  if (protocolLabel.value === 'Modbus') return endpointHost.value
  if (protocolLabel.value === 'HTTP API') return `${endpointHost.value}/api/report/${props.device.identifier}`
  if (protocolLabel.value === 'GB28181' || protocolLabel.value === 'ONVIF') return endpointHost.value
  return endpointHost.value
})

const secretPreview = computed(() => {
  const suffix = props.device.identifier.slice(-2).toUpperCase().padStart(2, '0')
  if (protocolLabel.value === 'GB28181') return `SIPK******-${suffix}`
  if (protocolLabel.value === 'HTTP API') return `TOKN******-${suffix}`
  if (protocolLabel.value === 'Modbus') return `ADDR******-${suffix}`
  return `SECK******-${suffix}`
})

const secretValue = computed(() => {
  const suffix = props.device.identifier.slice(-6).toUpperCase()
  if (protocolLabel.value === 'GB28181') return `SIPK-${props.device.identifier.toUpperCase()}-${suffix}`
  if (protocolLabel.value === 'HTTP API') return `TOKN-${props.device.identifier.toUpperCase()}-${suffix}`
  if (protocolLabel.value === 'Modbus') return `ADDR-${props.device.identifier.toUpperCase()}-${suffix}`
  return `SECK-${props.device.identifier.toUpperCase()}-${suffix}`
})

const authType = computed(() => {
  if (protocolLabel.value === 'GB28181') return 'sip'
  if (protocolLabel.value === 'HTTP API') return 'token'
  if (protocolLabel.value === 'Modbus') return 'station'
  return 'plaintext'
})

const username = computed(() => {
  if (protocolLabel.value === 'GB28181') return props.device.identifier
  if (protocolLabel.value === 'Modbus') return props.device.identifier.slice(-2).padStart(2, '0')
  return 'admin'
})

const configRows = computed(() => [
  { label: $t('IotDeviceDetail.accessConfig.authType'), value: authType.value, mono: true },
  { label: protocolLabel.value === 'Modbus' ? 'station' : 'username', value: username.value, mono: true },
  { label: protocolLabel.value === 'HTTP API' ? 'token' : 'password', value: credentialRevealed.value ? secretValue.value : secretPreview.value, mono: true },
  { label: 'topic', value: `${topicPrefix.value}/properties`, mono: true },
])

const thingModelDefinition = computed<IotDeviceLibraryThingModelDefinition>(() =>
  buildThingModelDefinitionFromTemplate(props.productTemplate),
)

async function copyText(value: string) {
  if (!value || value === '-' || typeof navigator === 'undefined') return
  await navigator.clipboard?.writeText(value)
}

async function copyConfigText() {
  await copyText(JSON.stringify(Object.fromEntries(configRows.value.map((row) => [row.label, row.value])), null, 2))
}
</script>

<style scoped src="./IotDeviceAccessConfigTab.css"></style>
