import type { ModbusSimpleMapping, ModbusTranslate } from '../types'
import { ref, reactive, computed } from 'vue'
import type { MappingConfiguration } from './useMappingConfiguration'
import type { MappingRules } from '../protocol/mapping'
import type { AddressHelpers } from '../protocol/address'
import type { CodecHelpers } from '../protocol/codecs'

/** 从原组件搬迁 MappingEditor，保持原有业务规则与执行逻辑。 */
export function useMappingEditor(
  translate: ModbusTranslate,
  mappingConfiguration: Pick<MappingConfiguration, 'metadataProperties' | 'mappings'>,
  mappingRules: Pick<MappingRules, 'autoFillLayout' | 'toFiniteNumberOr'>,
  addressHelpers: Pick<AddressHelpers, 'isHoldingWordBitSlice'>,
  codecHelpers: Pick<CodecHelpers, 'normalizeCodecId'>
) {
  const { metadataProperties, mappings } = mappingConfiguration
  const { autoFillLayout, toFiniteNumberOr } = mappingRules
  const { isHoldingWordBitSlice } = addressHelpers
  const { normalizeCodecId } = codecHelpers

  /** 属性列 AutoComplete 焦点行（用于收起态「名称 + id」叠层） */
  const focusedPropertyIndex = ref<number | null>(null)

  const drawerPropertyFocused = ref(false)

  // Drawer
  const drawerVisible = ref(false)

  const drawerIndex = ref(-1)

  const drawerForm = reactive<
    ModbusSimpleMapping & {
      propertyName?: string
    }
  >({
    property: '',
    propertyName: '',
    registerStr: '',
    codec: '',
    layout: '',
    scaleFactor: 1,
    scale: -1,
    useMaskWrite: false,
    readable: true,
    writable: true
  })

  const columns = computed(() => [
    { title: translate('ModbusMapping.field.property'), key: 'property', width: 160 },
    { title: translate('ModbusMapping.field.registerAddress'), key: 'register', width: 280 },
    { title: translate('ModbusMapping.field.decoding'), key: 'codecLayout', width: 360 },
    { title: translate('ModbusMapping.action.actions'), key: 'action', width: 132, fixed: 'right' as const }
  ])

  function onPropertyInputBlur() {
    window.setTimeout(() => {
      focusedPropertyIndex.value = null
    }, 120)
  }

  function onDrawerPropertyInputBlur() {
    window.setTimeout(() => {
      drawerPropertyFocused.value = false
    }, 120)
  }

  /** AutoComplete 同步到行数据并刷新 propertyName（任意字符串均可保留） */
  function onPropertyAcUpdate(v: unknown, record: ModbusSimpleMapping) {
    const s = v != null && v !== '' ? String(v) : ''
    record.property = s
    onPropertyChange(s, record)
  }

  function onDrawerPropertyAcUpdate(v: unknown) {
    const s = v != null && v !== '' ? String(v) : ''
    drawerForm.property = s
    onDrawerPropertyChange(s)
  }

  /** 表格内联编辑：缩放因子失焦/变更后归一化，与抽屉逻辑一致 */
  const onTableScaleFactorChange = (record: ModbusSimpleMapping, v: number | string | null) => {
    if (v == null || v === '') {
      record.scaleFactor = 1
      return
    }
    const n = typeof v === 'string' ? Number(v) : v
    if (Number.isNaN(n)) {
      record.scaleFactor = 1
    } else {
      record.scaleFactor = n
    }
  }

  /** 表格内联编辑：小数位数 */
  const onTableScaleChange = (record: ModbusSimpleMapping, v: number | null) => {
    if (v == null || Number.isNaN(Number(v))) {
      record.scale = -1
    } else {
      record.scale = Math.round(Number(v))
    }
  }

  // ==================== Table Event Handlers ====================
  const onPropertyChange = (val: string, record: ModbusSimpleMapping) => {
    const prop = metadataProperties.value.find((p) => p.id === val)
    if (prop) {
      record.propertyName = prop.name
      record.propertyDataType = prop.valueType?.type
      // codec 由寄存器范围来驱动，属性变更时不再自动推荐 codec
    } else {
      record.propertyName = undefined
      record.propertyDataType = undefined
    }
  }

  const onCodecChange = (record: ModbusSimpleMapping) => {
    autoFillLayout(record)
  }

  /** 寄存器地址变更：非保持+字内位时清除掩码写 */
  function onRegisterStrChange(record: ModbusSimpleMapping) {
    if (!isHoldingWordBitSlice(record.registerStr)) {
      record.useMaskWrite = false
    }
    autoFillLayout(record)
  }

  // ==================== Drawer ====================
  const openDrawer = (record: ModbusSimpleMapping, index: number) => {
    drawerPropertyFocused.value = false
    drawerIndex.value = index
    Object.assign(drawerForm, {
      property: record.property ?? '',
      propertyName: record.propertyName ?? '',
      registerStr: record.registerStr ?? '',
      codec: normalizeCodecId(record.codec ?? ''),
      layout: record.layout ?? '',
      scaleFactor: record.scaleFactor ?? 1,
      scale: record.scale ?? -1,
      useMaskWrite: record.useMaskWrite === true,
      readable: record.readable ?? true,
      writable: record.writable ?? true
    })
    drawerVisible.value = true
  }

  const onDrawerPropertyChange = (val: string) => {
    const prop = metadataProperties.value.find((p) => p.id === val)
    if (prop) {
      drawerForm.propertyName = prop.name
      // codec 由寄存器范围驱动，此处不自动推荐
    } else {
      drawerForm.propertyName = ''
    }
  }

  const onDrawerRegisterChange = () => {
    if (!isHoldingWordBitSlice(drawerForm.registerStr)) {
      drawerForm.useMaskWrite = false
    }
    autoFillLayout(drawerForm as ModbusSimpleMapping)
  }

  const onDrawerCodecChange = () => {
    autoFillLayout(drawerForm as ModbusSimpleMapping)
  }

  const confirmDrawer = () => {
    if (drawerIndex.value >= 0 && drawerIndex.value < mappings.value.length) {
      // 用 splice 替换整行，确保 a-table 的响应式更新生效
      mappings.value.splice(drawerIndex.value, 1, {
        ...mappings.value[drawerIndex.value],
        property: drawerForm.property,
        propertyName: drawerForm.propertyName,
        registerStr: drawerForm.registerStr,
        codec: normalizeCodecId(drawerForm.codec),
        layout: drawerForm.layout,
        scaleFactor: toFiniteNumberOr(drawerForm.scaleFactor, 1),
        scale: Math.round(toFiniteNumberOr(drawerForm.scale, -1)),
        useMaskWrite: drawerForm.useMaskWrite === true,
        readable: drawerForm.readable,
        writable: drawerForm.writable
      })
    }
    drawerVisible.value = false
  }

  // ==================== CRUD ====================
  const addMapping = () => {
    focusedPropertyIndex.value = null
    mappings.value.unshift({
      property: '',
      registerStr: '',
      codec: '',
      layout: '',
      scaleFactor: 1,
      scale: -1,
      useMaskWrite: false,
      readable: true,
      writable: true
    })
  }

  const removeMapping = (index: number) => {
    mappings.value.splice(index, 1)
  }

  const copyMapping = (index: number) => {
    const copy = { ...mappings.value[index] }
    mappings.value.splice(index + 1, 0, copy)
  }
  return {
    focusedPropertyIndex,
    drawerPropertyFocused,
    drawerVisible,
    drawerIndex,
    drawerForm,
    columns,
    onPropertyInputBlur,
    onDrawerPropertyInputBlur,
    onPropertyAcUpdate,
    onDrawerPropertyAcUpdate,
    onTableScaleFactorChange,
    onTableScaleChange,
    onPropertyChange,
    onCodecChange,
    onRegisterStrChange,
    openDrawer,
    onDrawerPropertyChange,
    onDrawerRegisterChange,
    onDrawerCodecChange,
    confirmDrawer,
    addMapping,
    removeMapping,
    copyMapping
  }
}
export type MappingEditor = ReturnType<typeof useMappingEditor>
