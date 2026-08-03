import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFullscreen } from '@vueuse/core'
import { message } from 'ant-design-vue'
import { isBoolean } from 'lodash-es'

import { iotDeviceDetailRealApi } from '../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../types'

export type IotDeviceScriptTransparentCodecProps = {
  device: IotDevice
  productId?: string
  codec: Record<string, any> | null
}

export function useIotDeviceScriptTransparentCodec(
  props: Readonly<IotDeviceScriptTransparentCodecProps>,
  emitUpdated: () => void,
) {
  const { t: $t } = useI18n()
  const editorEl = ref<HTMLElement | null>(null)
  const { toggle } = useFullscreen(editorEl)

  const topTitle = ref('')
  const readOnly = ref(true)
  const url = ref('')
  const topic = ref('')
  const topicOptions = ref<Array<{ value: string }>>([])
  const simulation = ref('')
  const resultValue = ref<any>({})
  const loading = ref(false)
  const savingConfig = ref(false)
  const editorValue = ref('')

  const typescriptTip = reactive({
    typescript: '',
  })

  const defaultValue = () => `// ${$t('IotDeviceDetail.scriptCodec.downstreamComment')}
codec.onDownstream(function(ctx){

});

// ${$t('IotDeviceDetail.scriptCodec.upstreamComment')}
codec.onUpstream(function(ctx){

});
`

  const isMqttTransport = computed(() => String(props.device.transport || '').toUpperCase() === 'MQTT')

  const editLinkStyle = computed(() => ({
    color: readOnly.value ? '#415ed1' : '#a6a6a6',
  }))

  const resultStyle = computed(() =>
    isBoolean(resultValue.value.success)
      ? {
          'margin-top': '0.625rem',
          'border-color': resultValue.value.success ? 'green' : 'red',
        }
      : {
          'margin-top': '0.625rem',
        },
  )

  const debugDisabled = computed(() => simulation.value === '' || readOnly.value)

  const resultDisplay = computed(() => {
    if (resultValue.value.success) return JSON.stringify(resultValue.value.outputs?.[0] ?? {}, null, 2)
    return resultValue.value.reason || ''
  })

  const filterOption = (inputValue: string, option: any) => option?.value?.includes(inputValue)

  const editorInit = (_editor: any, monaco: any) => {
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    })
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      allowJs: true,
      checkJs: true,
      allowNonTsExtensions: true,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      strictNullChecks: false,
      strictPropertyInitialization: true,
      strictFunctionTypes: true,
      strictBindCallApply: true,
      useDefineForClassFields: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      typeRoots: ['types'],
      lib: ['esnext'],
    })
  }

  function applyCodecFromProps() {
    const codec = props.codec
    if (!codec) {
      editorValue.value = defaultValue()
      readOnly.value = true
      topTitle.value = 'edit'
      return
    }

    editorValue.value = codec.configuration?.script || defaultValue()
    if (codec.deviceId) {
      readOnly.value = false
      topTitle.value = 'rest'
    } else {
      readOnly.value = true
      topTitle.value = 'edit'
    }
  }

  async function resetDeviceCodec() {
    if (!props.productId || !props.device.id) return
    const res: any = await iotDeviceDetailRealApi.deleteDeviceTransparentCodec(props.productId, props.device.id)
    if (res.status === 200) {
      message.success($t('IotDeviceDetail.accessDetail.resetSuccess'))
      emitUpdated()
    }
  }

  async function loadTopicOptions() {
    const protocol = props.device.protocol
    const transport = props.device.transport
    if (!protocol || !transport) {
      topicOptions.value = []
      return
    }
    const res: any = await iotDeviceDetailRealApi.queryProtocolDetail(protocol, transport)
    if (res.status === 200) {
      topicOptions.value = (res.result?.routes || []).map((item: any) => ({
        value: item.topic,
      })).filter((item: any) => item.value)
    }
  }

  async function queryCodeTips() {
    if (!props.productId || !props.device.id) return
    const res: any = await iotDeviceDetailRealApi.queryTransparentCodecTips(props.productId, props.device.id)
    if (res.success || res.status === 200) {
      typescriptTip.typescript = res.result || ''
    }
  }

  async function runDecodeTest(data: Record<string, unknown>) {
    loading.value = true
    try {
      const res: any = await iotDeviceDetailRealApi.testTransparentDecode(data)
      if (res.status === 200) resultValue.value = res.result
    } finally {
      loading.value = false
    }
  }

  async function saveCodec() {
    if (!props.productId || !props.device.id) return
    savingConfig.value = true
    try {
      const res: any = await iotDeviceDetailRealApi.saveDeviceTransparentCodec(props.productId, props.device.id, {
        provider: 'jsr223',
        configuration: {
          script: editorValue.value,
          lang: 'javascript',
        },
      })
      if (res.status === 200) {
        message.success($t('IotDeviceDetail.detail.saveSuccess'))
        emitUpdated()
      }
    } finally {
      savingConfig.value = false
    }
  }

  function debug() {
    if (isMqttTransport.value) {
      if (!topic.value) {
        message.error($t('IotDeviceDetail.scriptCodec.topicPlaceholder'))
        return
      }
      runDecodeTest({
        headers: { topic: topic.value },
        configuration: {
          script: editorValue.value,
          lang: 'javascript',
        },
        provider: 'jsr223',
        payload: simulation.value,
      })
      return
    }

    if (!url.value) {
      message.error($t('IotDeviceDetail.scriptCodec.urlPlaceholder'))
      return
    }
    runDecodeTest({
      headers: { url: url.value },
      provider: 'jsr223',
      configuration: {
        script: editorValue.value,
        lang: 'javascript',
      },
      payload: simulation.value,
    })
  }

  function warnReadonly() {
    message.warning($t('IotDeviceDetail.scriptCodec.readonlyWarning'))
  }

  watch(
    () => props.codec,
    applyCodecFromProps,
    { deep: true, immediate: true },
  )

  watch(
    () => [props.device.id, props.device.protocol, props.device.transport, props.productId] as const,
    () => {
      loadTopicOptions()
      queryCodeTips()
    },
    { immediate: true },
  )

  return {
    debugDisabled,
    editLinkStyle,
    editorEl,
    editorInit,
    editorValue,
    filterOption,
    isMqttTransport,
    loading,
    readOnly,
    resetDeviceCodec,
    resultDisplay,
    resultStyle,
    saveCodec,
    savingConfig,
    simulation,
    toggle,
    topTitle,
    topic,
    topicOptions,
    typescriptTip,
    url,
    warnReadonly,
    debug,
  }
}
