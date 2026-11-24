import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { computed, effectScope, nextTick, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'

const require = createRequire(import.meta.url)
const base = new URL('../views/device/Instance/Detail/Parsing/modbus/', import.meta.url)
const exportsByFile = {
  'protocol/address.ts': 'createAddressHelpers',
  'protocol/codecs.ts': 'createCodecHelpers',
  'protocol/layout.ts': 'createLayoutHelpers',
  'protocol/mapping.ts': 'createMappingRules',
  'protocol/payload.ts': 'createPayloadHelpers',
  'protocol/frames.ts': 'createFrameHelpers',
  'protocol/simulation.ts': 'createSimulationHelpers',
  'protocol/visualization.ts': 'createVisualizationHelpers',
  'mapping/useMappingConfiguration.ts': 'useMappingConfiguration',
  'debug/useFillMapping.ts': 'useFillMapping',
  'debug/useDebugState.ts': 'useDebugState',
  'debug/useDecode.ts': 'useDecode',
  'debug/useEncode.ts': 'useEncode',
  'debug/useDebugDraft.ts': 'useDebugDraft',
  'debug/useDecodeSimulation.ts': 'useDecodeSimulation',
  'useSplitLayout.ts': 'useSplitLayout'
}
const compiled = await build({
  stdin: {
    contents: Object.entries(exportsByFile)
      .map(([file, name]) => `export { ${name} } from ${JSON.stringify(fileURLToPath(new URL(file, base)))};`)
      .join('\n'),
    resolveDir: fileURLToPath(base)
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  external: ['vue', 'ant-design-vue', '@device-manager-ui/api/instance', '@device-manager-ui/store/instance']
})
const store = reactive({
  current: {
    id: 'device-a',
    productId: 'product',
    metadata: JSON.stringify({ properties: [{ id: 'value', name: 'Measurement', valueType: { type: 'float' } }] })
  }
})
let requests = []
const api = {
  deviceCode: async () => ({
    status: 200,
    result: { provider: 'modbus', configuration: { mapping: { modbusLinkType: 'PDU', properties: [] } } }
  }),
  saveDeviceCode: async (...args) => {
    requests.push(args)
    return { status: 200 }
  },
  testCode: async (data) => {
    requests.push(data)
    return { status: 200, result: { success: true, outputs: [] } }
  },
  encodeTest: async (data) => {
    requests.push(data)
    return { status: 200, result: { success: true, frames: ['01 03 00 00 00 02'] } }
  }
}
const defaultApi = { ...api }
const storage = new Map()
const localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
const listeners = new Map()
const window = {
  addEventListener: (name, handler) => listeners.set(name, handler),
  removeEventListener: (name) => listeners.delete(name)
}
const document = { querySelector: () => null, body: { style: { cursor: '', userSelect: '' } } }
const scopes = []
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  Object.assign(api, defaultApi)
  storage.clear()
  listeners.clear()
})
const module = { exports: {} }
new Function('require', 'module', 'exports', 'document', 'localStorage', 'window', compiled.outputFiles[0].text)(
  (id) =>
    id === '@device-manager-ui/api/instance'
      ? api
      : id === '@device-manager-ui/store/instance'
        ? { useInstanceStore: () => store }
        : id === 'ant-design-vue'
          ? { message: { warning() {}, success() {}, error() {} } }
          : require(id),
  module,
  module.exports,
  document,
  localStorage,
  window
)
const lib = module.exports
const resources = Object.fromEntries(
  await Promise.all(
    ['zh', 'en'].map(async (lang) => [
      lang,
      JSON.parse(await readFile(new URL(`../locales/lang/${lang}.json`, import.meta.url), 'utf8'))
    ])
  )
)
function setup(locale = 'en') {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => {
    const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'en', messages: resources })
    const t = i18n.global.t
    const address = lib.createAddressHelpers(t),
      codecs = lib.createCodecHelpers(t, address),
      layout = lib.createLayoutHelpers(t, address)
    const rules = lib.createMappingRules(address, codecs, layout),
      payload = lib.createPayloadHelpers(t),
      frames = lib.createFrameHelpers(t, payload)
    const visual = lib.createVisualizationHelpers(t, address),
      simulation = lib.createSimulationHelpers(address, frames, payload)
    const props = reactive({ thingId: 'device-a', productId: 'product' })
    const configuration = lib.useMappingConfiguration(t, props, address, layout, codecs, rules)
    return {
      i18n,
      t,
      address,
      codecs,
      layout,
      rules,
      payload,
      frames,
      visual,
      simulation,
      configuration,
      props,
      scope,
      run: (fn) => scope.run(fn)
    }
  })
}
const row = (registerStr, extras = {}) => ({
  property: 'value',
  registerStr,
  codec: 'unsigned_int16',
  layout: 'BIG_ENDIAN',
  scaleFactor: 1,
  scale: -1,
  ...extras
})

test('PLC, six-digit, FC, unit, range, bit and legacy address forms preserve Modbus offsets', () => {
  const { address: a } = setup()
  for (const [text, type, address, count] of [
    ['40001', 'HoldingRegisters', 0, 1],
    ['400001', 'HoldingRegisters', 0, 1],
    ['30001-30004', 'InputRegisters', 0, 4],
    ['00001-00008', 'Coils', 0, 8],
    ['2_5-12', 'DiscreteInputs', 5, 8],
    ['40001*2', 'HoldingRegisters', 0, 2]
  ]) {
    const actual = a.doParseRegisterStr(text)
    assert.deepEqual([actual.type, actual.address, actual.count], [type, address, count], text)
  }
  const bit = a.doParseRegisterStr('2:3_0_7@2')
  assert.equal(bit.slaveId, 2)
  assert.equal(bit.bitIndex, 7)
  assert.equal(bit.elementIndex, 2)
  for (const invalid of ['', '0', 'invalid', '9_0', '40002-40001', '40001-30002'])
    assert.equal(a.doParseRegisterStr(invalid), null, invalid)
})

test('codec candidates follow bit addressing, bit fields and total register width', () => {
  const { codecs: c, rules } = setup()
  const candidates = (address) => c.getCodecOptionsForCount(address).flatMap((g) => g.options.map((o) => o.value))
  assert.deepEqual(candidates('1_0'), ['bool'])
  assert.deepEqual(candidates('1_0-7'), ['lsb_bit_array', 'bit_array'])
  assert.deepEqual(candidates('3_0_7'), ['bool'])
  assert.ok(candidates('3_0-1').includes('ieee754_float32'))
  assert.ok(!candidates('3_0').includes('ieee754_float32'))
  assert.ok(candidates('3_0-3').includes('bcd_date_time_7'))
  const bitRow = row('3_0_7', { codec: 'ieee754_float32', layout: 'LITTLE_ENDIAN' })
  rules.autoFillLayout(bitRow)
  assert.equal(bitRow.codec, 'bool')
  assert.equal(bitRow.layout, '')
})

test('legacy codec IDs and byte layouts retain their persistence contract', () => {
  const { codecs: c, layout: l } = setup()
  assert.equal(c.normalizeCodecId('UnsignedInt16'), 'unsigned_int16')
  assert.equal(c.normalizeCodecId('Ieee754Float32'), 'ieee754_float32')
  assert.equal(c.normalizeCodecId('LSB_BIT_ARRAY'), 'lsb_bit_array')
  assert.equal(l.normalizeLayoutToLogical('CD_AB', 2), 'WORD_SWAP_2')
  assert.equal(l.layoutLogicalToBackend('LITTLE_ENDIAN', 2), 'DC_BA')
  assert.equal(l.layoutLogicalToBackend('WORD_SWAP_2', 4), 'BA_DC_FE_HG')
  assert.equal(l.layoutWordCountForSave({ type: 'Coils', count: 8 }), 1)
  assert.equal(l.layoutWordCountForSave({ type: 'Coils', count: 17 }), 1)
})

test('configuration serializes registers, scaling, access, array index and mask write without display text', () => {
  const { configuration: c } = setup()
  c.modbusLinkType.value = 'RTU'
  c.mappings.value = [
    row('2:3_0-1@1', { codec: 'Ieee754Float32', layout: 'WORD_SWAP_2', scaleFactor: 0.1, scale: 3 }),
    row('3_3_7', { codec: 'bool', useMaskWrite: true, readable: true, writable: false })
  ]
  const result = c.configObject.value
  assert.equal(result.thingId, 'device-a')
  assert.equal(result.modbusLinkType, 'RTU')
  const [value, bit] = result.properties
  assert.deepEqual(value.register.key, { slaveId: 2, address: 0, type: 'HoldingRegisters' })
  assert.equal(value.register.codec, 'ieee754_float32')
  assert.equal(value.register.layout, 'CD_AB')
  assert.equal(value.register.scaleFactor, 0.1)
  assert.equal(value.register.scale, 3)
  assert.equal(value.elementIndex, 1)
  assert.equal(bit.bitIndex, 7)
  assert.equal(bit.bitLength, 1)
  assert.equal(bit.useMaskWrite, true)
  assert.equal(bit.writable, false)
  assert.equal(bit.register.layout, 'AB')
  assert.ok(!JSON.stringify(result).includes('Measurement'))
})

test('configuration reconstructs historical codec/layout and retains bit length', () => {
  const { configuration: c } = setup()
  const restored = c.reconstructMappings({
    properties: [
      {
        property: 'value',
        register: {
          key: { slaveId: 2, address: 7, type: 'HoldingRegisters' },
          registerCount: 2,
          codec: 'Ieee754Float32',
          layout: 'CD_AB',
          scaleFactor: 0.1,
          scale: 2
        },
        elementIndex: 1
      },
      {
        property: 'alarm',
        register: {
          key: { slaveId: 1, address: 3, type: 'HoldingRegisters' },
          registerCount: 1,
          codec: 'Bool',
          layout: 'AB'
        },
        bitIndex: 3,
        bitLength: 4,
        useMaskWrite: true
      }
    ]
  })
  assert.equal(restored[0].registerStr, '2:3_7-8@1')
  assert.equal(restored[0].codec, 'ieee754_float32')
  assert.equal(restored[0].layout, 'WORD_SWAP_2')
  assert.equal(restored[1].registerStr, '3_3_3')
  assert.equal(restored[1].bitLength, 4)
  assert.equal(restored[1].useMaskWrite, true)
})

test('same-start register definitions share the widest register block', () => {
  const { configuration: c } = setup()
  c.mappings.value = [row('3_0_1', { codec: 'bool' }), row('3_0-1', { property: 'other', codec: 'ieee754_float32' })]
  const props = c.configObject.value.properties
  assert.equal(props[0].register.registerCount, 2)
  assert.equal(props[0].register, props[1].register)
})

test('Hex/Base64 normalization handles delimiters and invalid input', () => {
  const { payload: p } = setup()
  assert.deepEqual(p.normalizeDecodeInput('0x01, 0X03\n04').bytes, [1, 3, 4])
  assert.deepEqual(p.normalizeDecodeInput('AQME').bytes, [1, 3, 4])
  assert.ok(p.normalizeDecodeInput('ABC').parseError.includes('even'))
  assert.ok(p.normalizeDecodeInput('!@#').parseError)
  assert.equal(p.crc16Modbus([1, 3, 0, 0, 0, 2], 0, 6), 0x0bc4)
})

test('PDU, TCP MBAP and RTU CRC analysis preserve the same register payload', () => {
  const { frames: f, payload: p } = setup()
  const data = [1, 3, 4, 0, 1, 0, 2]
  const crc = p.crc16Modbus(data, 0, data.length)
  const tcp = [0, 1, 0, 0, 0, data.length, ...data]
  for (const [link, bytes] of [
    ['PDU', data],
    ['TCP', tcp],
    ['RTU', [...data, crc & 255, crc >> 8]]
  ]) {
    const view = f.parseModbusPayload(bytes, link)
    assert.equal(view.fcCode, 3)
    assert.equal(view.unitId, 1)
    assert.equal(view.wordRegisterCount, 2)
    assert.deepEqual(
      view.registerPreview.map((r) => r.uint16),
      [1, 2]
    )
    assert.deepEqual(f.extractModbusResponseDataBytes(bytes, link).data, [0, 1, 0, 2])
  }
  assert.equal(f.parseModbusPayload([...data, 0, 0], 'RTU').crcOk, false)
  assert.equal(f.parseModbusPayload([1, 0x83, 2], 'PDU').isException, true)
})

test('downlink analysis and concatenated-frame splitting distinguish requests from responses', () => {
  const { frames: f } = setup()
  const request = [1, 3, 0, 0, 0, 2]
  const second = [1, 1, 0, 8, 0, 8]
  assert.deepEqual(f.splitEncodePayloadToWireSegments([...request, ...second], 'PDU'), [request, second])
  const parsed = f.parseEncodeDownlinkFrame(request, 'PDU')
  assert.equal(parsed.requestStartAddr, 0)
  assert.equal(parsed.requestQuantity, 2)
  assert.equal(parsed.byteCount, undefined)
})

test('word and coil visualization retain bit positions and detect overlapping mappings', () => {
  const { visual: v } = setup()
  const word = v.buildRegisterDecodeSegments({ value: true }, [row('3_0_0', { codec: 'bool' })], 2)
  assert.deepEqual(word.segments[0].bitRanges, [{ from: 8, to: 8 }])
  const coil = v.buildCoilDecodeSegments({ value: [true, false] }, [row('1_8-9', { codec: 'lsb_bit_array' })], 1, 8)
  assert.deepEqual(coil.segments[0].bitRanges, [{ from: 0, to: 1 }])
  const matrix = v.applySegmentsToMatrices(
    1,
    [coil.segments[0], { ...coil.segments[0], propertyId: 'other', tone: 1 }],
    []
  )
  assert.ok(matrix.warnings.length)
  assert.deepEqual(
    [...v.buildGlobalBitOverlapSet([coil.segments[0], { ...coil.segments[0], propertyId: 'other', tone: 1 }])],
    [0, 1]
  )
})

test('response import supports register splitting, range merge and coil address bounds', () => {
  const { t, address, rules, configuration: c, run } = setup()
  const analysis = ref({ fcCode: 3, isException: false, wordRegisterCount: 2, unitId: 2 })
  const fill = run(() => lib.useFillMapping(t, { decodeFrameAnalysis: analysis }, address, rules, c))
  fill.openFillMappingModal()
  fill.fillPduStart.value = 7
  fill.fillWordMergeMode.value = 'split'
  fill.confirmFillMapping()
  assert.deepEqual(
    c.mappings.value.map((r) => r.registerStr),
    ['2:40008', '2:40009']
  )
  assert.ok(c.mappings.value.every((r) => r.codec === 'unsigned_int16'))
  fill.openFillMappingModal()
  fill.fillWordMergeMode.value = 'merge'
  fill.fillAddressFormat.value = 'fc'
  fill.fillPduStart.value = 7
  fill.confirmFillMapping()
  assert.equal(c.mappings.value.at(-1).registerStr, '2:3_7-8')
  analysis.value = { fcCode: 1, isException: false, byteCount: 1, unitId: 1 }
  fill.openFillMappingModal()
  fill.fillPduStart.value = 8
  fill.fillCoilEndPdu.value = 15
  fill.fillAddressFormat.value = 'fc'
  fill.confirmFillMapping()
  assert.equal(c.mappings.value.at(-1).registerStr, '1_8-15')
})

test('read and write encoding keep the existing message contract', async () => {
  const { t, configuration: c, payload, frames, run } = setup()
  c.mappings.value = [row('3_0')]
  const state = run(() => lib.useDebugState())
  const encode = run(() => lib.useEncode(t, state, c, payload, frames))
  requests = []
  state.encodeDebugMode.value = 'read'
  state.readEncodeProps.value = [' value ', '']
  await encode.runEncode()
  assert.deepEqual(requests[0].message, { messageType: 'READ_PROPERTY', properties: ['value'] })
  state.encodeDebugMode.value = 'write'
  state.encodeInputs.value = [{ property: 'value', value: '12.5' }]
  await encode.runEncode()
  assert.deepEqual(requests[1].message, { messageType: 'WRITE_PROPERTY', properties: { value: 12.5 } })
  assert.equal(encode.encodeDebugSegments.value[0].analysis.requestQuantity, 2)
})

test('all Modbus translations have matching placeholders and render as English without Chinese', () => {
  const { i18n, address, codecs, frames } = setup('zh')
  assert.ok(address.ZONE_INFO.value.HoldingRegisters.name.includes('寄存器'))
  i18n.global.locale.value = 'en'
  assert.equal(address.ZONE_INFO.value.HoldingRegisters.name, 'Holding Register')
  assert.equal(codecs.shortCodecLabel('bool'), 'Single Boolean')
  assert.equal(frames.FC_NAMES.value[3], 'FC03 Read Holding Registers')
  const keys = Object.keys(resources.zh).filter((k) => k.startsWith('ModbusMapping.'))
  assert.ok(keys.length > 300)
  for (const key of keys) {
    assert.ok(Object.hasOwn(resources.en, key), key)
    const args = Object.fromEntries([...resources.zh[key].matchAll(/\{(\w+)\}/g)].map((m) => [m[1], 3]))
    assert.deepEqual(
      [...new Set([...resources.zh[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort(),
      [...new Set([...resources.en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort(),
      key
    )
    assert.doesNotMatch(i18n.global.t(key, args), /[\u4e00-\u9fff]/, key)
  }
})
