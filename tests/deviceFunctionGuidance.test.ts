import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type {
  HomeAgentCapability,
  HomeAgentCapabilityContext,
  HomeAgentMenuEntry,
} from '@jetlinks-web-core/layout/components/AiChat/homeAgentContracts'
import { compactHomeAgentCapability } from '@jetlinks-web-core/layout/components/AiChat/homeAgentCatalog'
import { searchHomeAgentCapabilities } from '@jetlinks-web-core/layout/components/AiChat/homeAgentCapabilitySearch'
import {
  createDeviceGuidanceCapabilities,
  DEVICE_GUIDANCE_MENU_CODES,
  deviceGuidanceHomeAgentProvider,
} from '../agentCapabilities/deviceGuidance/homeAgentProvider.ts'
import { deviceGuidanceGeneralAgentExtension } from '../agentCapabilities/deviceGuidance/generalAgentExtension.ts'

const menu = (code: string, title = code): HomeAgentMenuEntry => ({
  code, title, name: code, breadcrumb: [title], keywords: [],
})

const createContext = (menus: HomeAgentMenuEntry[]): HomeAgentCapabilityContext => {
  const context: HomeAgentCapabilityContext = {
    currentRoute: { name: 'overview', path: '/overview' },
    menus,
    capabilities: [],
    findMenu: value => context.menus.find(item => item.code === value),
    navigateToMenu: () => { throw new Error('Guidance must not navigate') },
    navigateToRoute: () => { throw new Error('Guidance must not navigate') },
  }
  return context
}

test('guidance describes only visible device-owned feature entries', () => {
  const context = createContext([menu('device/Product', '产品列表'), menu('link/Type', '连接管理')])
  const entries = createDeviceGuidanceCapabilities(context)
  assert.deepEqual(entries.map(item => [item.id, item.name, item.menuCode]), [
    ['device-entry:product', '产品列表', 'device/Product'],
    ['device-entry:network', '连接管理', 'link/Type'],
  ])
  assert.ok(entries.every(item => item.kind === 'feature' && !item.path))
})

test('each device-list identity works without requiring a product or another list route', () => {
  for (const code of DEVICE_GUIDANCE_MENU_CODES.onboarding) {
    const entries = createDeviceGuidanceCapabilities(createContext([menu(code, '当前设备入口')]))
    assert.equal(entries.length, 1)
    assert.equal(entries[0].id, 'device-entry:onboarding')
    assert.equal(entries[0].menuCode, code)
    const compact = compactHomeAgentCapability(entries[0])
    if (code === 'device/Instance') {
      assert.equal(compact.markdownLink, `[当前设备入口](#menu=${encodeURIComponent(code)})`)
      assert.equal(entries[0].entry, undefined)
    } else {
      assert.equal(compact.link, '#feature=device-entry%3Aonboarding')
      assert.deepEqual(entries[0].entry, { activate: true, query: { type: 'all' } })
    }
  }
})

test('duplicate visible list aliases still declare one onboarding entry', () => {
  const entries = createDeviceGuidanceCapabilities(createContext(DEVICE_GUIDANCE_MENU_CODES.onboarding.map(code => menu(code))))
  assert.equal(entries.length, 1)
})

test('unavailable routes and lookalike menu titles do not grant guidance capabilities', () => {
  const context = createContext([menu('other/devices', '设备列表')])
  assert.deepEqual(createDeviceGuidanceCapabilities(context), [])
  assert.deepEqual(deviceGuidanceHomeAgentProvider.getSystemPromptLines?.(context), [])
})

test('permission and menu-title changes refresh guidance without recreating the provider', () => {
  const context = createContext([menu('device/Product', '产品')])
  assert.equal(createDeviceGuidanceCapabilities(context)[0].name, '产品')
  context.menus = [menu('iot-user-device-list', '项目设备')]
  context.currentRoute = { name: 'project-home', path: '/custom-home' }
  const entry = createDeviceGuidanceCapabilities(context)[0]
  assert.equal(entry.id, 'device-entry:onboarding')
  assert.equal(entry.menuCode, 'iot-user-device-list')
  assert.ok(entry.name)
  context.menus = []
  assert.deepEqual(createDeviceGuidanceCapabilities(context), [])
})

test('natural onboarding questions use the existing shared capability search', () => {
  const entries = createDeviceGuidanceCapabilities(createContext([menu('iot-user-device-list', '设备列表')]))
  for (const keyword of ['设备怎么接入？', '我想添加一个新设备', 'where is device onboarding']) {
    assert.equal(searchHomeAgentCapabilities(entries, { keyword })[0]?.id, 'device-entry:onboarding')
  }
  assert.equal(deviceGuidanceHomeAgentProvider.getClientTools, undefined)
  assert.equal(deviceGuidanceHomeAgentProvider.getWorkflowGuides, undefined)
  assert.equal(deviceGuidanceGeneralAgentExtension.provider, deviceGuidanceHomeAgentProvider)
})

test('an independently declared support feature coexists without device-module route knowledge', () => {
  const context = createContext([menu('iot-user-device-list'), menu('extension/support')])
  const support: HomeAgentCapability = {
    id: 'extension:device-support', name: '设备支持查询', kind: 'feature',
    category: 'device-support', menuCode: 'extension/support',
    keywords: ['设备接入', '支持型号', 'brand model support'],
    description: '查看当前可获取的设备支持与接入模板，具体型号支持以查询结果为准。',
  }
  const entries = createDeviceGuidanceCapabilities(context)
  assert.ok(!entries.some(item => item.menuCode === support.menuCode))
  const found = searchHomeAgentCapabilities([...entries, support], { keyword: '设备支持型号', kind: 'feature' })
  assert.ok(found.some(item => item.id === support.id))
  assert.equal(compactHomeAgentCapability(support).markdownLink, '[设备支持查询](#menu=extension%2Fsupport)')
  assert.ok(!searchHomeAgentCapabilities(entries, { keyword: '设备支持型号' }).some(item => item.id === support.id))
})

test('guidance copy is localized, concise, and separates onboarding from existing-instance diagnosis', () => {
  const keys = [...Object.keys(DEVICE_GUIDANCE_MENU_CODES).map(key => `DeviceFunctionGuidance.description.${key}`), 'DeviceFunctionGuidance.prompt']
  for (const language of ['zh', 'en']) {
    const messages = JSON.parse(readFileSync(`locales/lang/${language}.json`, 'utf8'))
    for (const key of keys) {
      assert.equal(typeof messages[key], 'string', `${language}:${key}`)
      assert.ok(messages[key].length < (language === 'zh' ? 220 : 600), key)
      assert.doesNotMatch(messages[key], /https?:\/\/|#menu=|#route=/)
    }
  }
  const zh = JSON.parse(readFileSync('locales/lang/zh.json', 'utf8'))
  assert.match(zh['DeviceFunctionGuidance.prompt'], /详细引导留给目标功能/)
  assert.match(zh['DeviceFunctionGuidance.description.onboarding'], /已有产品只复用配置，不证明具体型号受支持/)
  assert.match(zh['Instance.homeAgent.prompt.globalSystem'], /不等于查找已有实例/)
  assert.match(zh['Product.homeAgent.prompt.globalSystem'], /不强制查询已登记产品/)
  assert.match(zh['IotGeneralAgent.systemPrompt.handoff'], /不要求定位已有实例/)
  for (const prefix of ['Instance', 'Product']) {
    assert.match(zh[`${prefix}.homeAgent.tool.search.description`], /已登记/)
    assert.match(zh[`${prefix}.homeAgent.tool.search.description`], /不是新设备接入咨询的前置步骤/)
  }
  assert.match(zh['Product.homeAgent.workflow.resolveProduct.when'], /已登记产品/)
})
