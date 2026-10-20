import { reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusMappingProps } from './types'
import { createAddressHelpers } from './protocol/address'
import { createCodecHelpers } from './protocol/codecs'
import { createLayoutHelpers } from './protocol/layout'
import { createMappingRules } from './protocol/mapping'
import { createPayloadHelpers } from './protocol/payload'
import { createFrameHelpers } from './protocol/frames'
import { createSimulationHelpers } from './protocol/simulation'
import { createVisualizationHelpers } from './protocol/visualization'
import { useMappingConfiguration } from './mapping/useMappingConfiguration'
import { useMappingProperties } from './mapping/useMappingProperties'
import { useMappingEditor } from './mapping/useMappingEditor'
import { useDebugState } from './debug/useDebugState'
import { useDecodeSimulation } from './debug/useDecodeSimulation'
import { useDebugDraft } from './debug/useDebugDraft'
import { useDecode } from './debug/useDecode'
import { useDecodeVisualization } from './debug/useDecodeVisualization'
import { useEncode } from './debug/useEncode'
import { useFillMapping } from './debug/useFillMapping'
import { useSplitLayout } from './useSplitLayout'
import { useTableHeight } from './mapping/useTableHeight'

/** 仅组合搬迁后的规则与状态，生命周期和 watch 均沿用原组件。 */
export function useModbusMapping(props: ModbusMappingProps) {
  const { t } = useI18n()
  const addressHelpers = createAddressHelpers(t)
  const codecHelpers = createCodecHelpers(t, addressHelpers)
  const layoutHelpers = createLayoutHelpers(t, addressHelpers)
  const mappingRules = createMappingRules(addressHelpers, codecHelpers, layoutHelpers)
  const payloadHelpers = createPayloadHelpers(t)
  const frameHelpers = createFrameHelpers(t, payloadHelpers)
  const simulationHelpers = createSimulationHelpers(addressHelpers, frameHelpers, payloadHelpers)
  const visualizationHelpers = createVisualizationHelpers(t, addressHelpers)
  const mappingConfiguration = useMappingConfiguration(
    t,
    props,
    addressHelpers,
    layoutHelpers,
    codecHelpers,
    mappingRules
  )
  const mappingProperties = useMappingProperties(mappingConfiguration, addressHelpers)
  const mappingEditor = useMappingEditor(t, mappingConfiguration, mappingRules, addressHelpers, codecHelpers)
  const debugState = useDebugState()
  const decodeSimulation = useDecodeSimulation(
    t,
    debugState,
    addressHelpers,
    simulationHelpers,
    mappingConfiguration,
    payloadHelpers
  )
  const debugDraft = useDebugDraft(props, mappingConfiguration, debugState, decodeSimulation)
  const decode = useDecode(payloadHelpers, debugState, frameHelpers, mappingConfiguration)
  const decodeVisualization = useDecodeVisualization(
    t,
    debugState,
    visualizationHelpers,
    decode,
    frameHelpers,
    mappingConfiguration
  )
  const encode = useEncode(t, debugState, mappingConfiguration, payloadHelpers, frameHelpers)
  const fillMapping = useFillMapping(t, decode, addressHelpers, mappingRules, mappingConfiguration)
  const splitLayout = useSplitLayout()
  const tableHeight = useTableHeight(mappingConfiguration)

  const mappingView = reactive({
    ...mappingEditor,
    ...mappingProperties,
    ...addressHelpers,
    ...codecHelpers,
    ...layoutHelpers,
    ...tableHeight,
    mappings: mappingConfiguration.mappings,
    loading: mappingConfiguration.loading,
    modbusLinkType: mappingConfiguration.modbusLinkType
  })
  const decodeView = reactive({
    ...debugState,
    ...decodeSimulation,
    ...decodeVisualization,
    decodeInputNormalized: decode.decodeInputNormalized,
    decodeFrameAnalysis: decode.decodeFrameAnalysis,
    bytesToHexSpaced: payloadHelpers.bytesToHexSpaced,
    decodeBitValueClass: visualizationHelpers.decodeBitValueClass,
    decodeSegmentRangeLabel: visualizationHelpers.decodeSegmentRangeLabel,
    formatDecodePropValue: visualizationHelpers.formatDecodePropValue,
    FC_NAMES: frameHelpers.FC_NAMES,
    canFillToMapping: fillMapping.canFillToMapping,
    openFillMappingModal: fillMapping.openFillMappingModal
  })
  const encodeView = reactive({
    encodeInputs: debugState.encodeInputs,
    encoding: debugState.encoding,
    encodeResult: debugState.encodeResult,
    encodeDebugMode: debugState.encodeDebugMode,
    readEncodeProps: debugState.readEncodeProps,
    ...encode,
    encodePropertyOptions: mappingProperties.encodePropertyOptions,
    filterEncodeReadPropOption: mappingProperties.filterEncodeReadPropOption
  })
  const fillView = reactive(fillMapping)

  onMounted(() => {
    splitLayout.loadMmSplitFromStorage()
    debugDraft.restoreModbusDebugDraft()
    mappingConfiguration.loadConfig()
    nextTick(() => {
      tableHeight.scheduleMeasureTableBody()
      tableHeight.observeTableBody()
      decode.scheduleAutoDecode()
    })
  })
  onUnmounted(() => {
    debugDraft.stopDebugDraftTimers()
    decode.stopAutoDecodeTimer()
    debugDraft.persistModbusDebugDraft()
    tableHeight.stopTableObserver()
  })
  watch(
    () => props.thingId,
    () => {
      debugDraft.restoreModbusDebugDraft()
    }
  )
  watch(
    () => mappingConfiguration.instanceStore.current?.id,
    (id) => {
      if (id) {
        debugDraft.restoreModbusDebugDraft()
        debugState.decodeResult.value = null
        debugState.encodeResult.value = null
        mappingConfiguration.loadConfig()
      }
    }
  )
  watch(mappingConfiguration.modbusLinkType, () => {
    decodeSimulation.regenerateDecodeSimFrame()
  })
  return { mappingView, decodeView, encodeView, fillView, splitLayout, mappingConfiguration, mappingEditor }
}
export type ModbusMappingView = ReturnType<typeof useModbusMapping>['mappingView']
export type ModbusDecodeView = ReturnType<typeof useModbusMapping>['decodeView']
export type ModbusEncodeView = ReturnType<typeof useModbusMapping>['encodeView']
export type ModbusFillView = ReturnType<typeof useModbusMapping>['fillView']
