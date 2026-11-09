import dayjs from 'dayjs'
import { getI18nText } from '../../../../utils/i18n'
import { agentProviders, cloudProviders, pluginProviders } from './types'
import type { GatewayOutlineModel, NamedResource, OutlineRow, OutlineSection, OutlineTranslate } from './types'

/** 空值仅转换展示；保留 0、false 和配置中的完整对象，不回写原数据。 */
export function displayOutlineValue(value: unknown, t: OutlineTranslate): string | number {
  if (value === undefined || value === null || value === '') return t('GatewayEditor.unconfigured')
  if (typeof value === 'boolean') return t(value ? 'GatewayOutline.true' : 'GatewayOutline.false')
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text
  return JSON.stringify(value)
}

/** 地址与端口来自同一份信令配置，缺少主机时不拼出无效地址。 */
function address(host: unknown, port: unknown): unknown {
  if (host === undefined || host === null || host === '') return undefined
  return port === undefined || port === null || port === '' ? host : `${host} : ${port}`
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** 将各类型资源组织为同一套只读分区，实体与复合子项共用显示口径。 */
function resourceSections(model: GatewayOutlineModel, t: OutlineTranslate): OutlineSection[] {
  const { gateway, network, protocol, plugin } = model
  const provider = gateway.provider || ''
  const config = gateway.configuration || {}
  const row = (label: string, value: unknown): OutlineRow => ({ label: t(label), value: displayOutlineValue(value, t) })
  const name = (item?: NamedResource) => getI18nText(item, 'name') || item?.id
  const description = (item?: NamedResource) => getI18nText(item, 'description')
  const sections: OutlineSection[] = []
  if (network || (gateway.channelId && !pluginProviders.includes(provider) && !model.builtin && !cloudProviders.includes(provider) && provider !== 'child-device' && provider !== 'composite-device-gateway')) {
    sections.push({ key: 'network', title: t('GatewayEditor.network'), rows: [
      row('GatewayEditor.componentName', name(network) || gateway.channelId),
      row('GatewayEditor.publicAddress', network?.addresses?.map(item => item.address).filter(Boolean).join('\n')),
      row('GatewayEditor.description', description(network)),
    ] })
  }
  if (pluginProviders.includes(provider)) {
    sections.push({ key: 'plugin', title: t('components.SecondKind.311605-0'), rows: [
      row('GatewayEditor.pluginName', name(plugin)), row('GatewayOutline.pluginVersion', plugin?.version),
      row('GatewayOutline.pluginId', plugin?.id || gateway.channelId), row('GatewayEditor.description', description(plugin)),
    ] })
    if (model.properties.length) sections.push({ key: 'configuration', title: t('components.SecondKind.311605-3'), rows: model.properties.map(property => ({
      label: property.name || property.property, value: displayOutlineValue(config[property.property], t),
    })) })
  }
  if (cloudProviders.includes(provider)) {
    const fields = provider === 'Ctwing'
      ? [['apiAddress', 'Cloud.OneNet.808542-1'], ['appKey', 'GatewayOutline.appKey'], ['appSecret', 'GatewayOutline.appSecret']]
      : [['apiAddress', 'Cloud.OneNet.808542-1'], ['apiKey', 'GatewayOutline.apiKey'], ['validateToken', 'Cloud.OneNet.808542-6'], ['aesKey', 'GatewayOutline.aesKey']]
    sections.push({ key: 'cloud', title: t('Cloud.Ctwing.076179-41'), rows: [
      ...fields.map(([key, label]) => row(label, config[key])), row('GatewayEditor.description', config.description),
    ] })
  }
  if (provider === 'gb28181-2016') {
    const shared = objectOf(config.hostPort)
    const rows = [row('components.SixthKind.707842-3', config.domain), row('GatewayOutline.sipId', config.sipId),
      row('GatewayEditor.cluster', typeof config.shareCluster === 'boolean' ? t(config.shareCluster ? 'GatewayEditor.shared' : 'GatewayEditor.independent') : undefined)]
    if (config.shareCluster !== false) rows.push(
      row('components.SixthKind.707842-4', address(shared.host ?? config.host, shared.port ?? config.port)),
      row('components.SixthKind.707842-5', address(shared.publicHost ?? config.publicHost, shared.publicPort ?? config.publicPort)),
    )
    sections.push({ key: 'signal', title: t('GatewayEditor.signal'), rows })
    if (config.shareCluster === false && Array.isArray(config.cluster)) {
      config.cluster.forEach((item, index) => {
        const node = objectOf(item)
        sections.push({ key: `cluster-${index}`, title: `${t('GatewayOutline.node')} ${index + 1}`, rows: [
          row('GatewayOutline.node', node.clusterNodeId), row('components.SixthKind.707842-4', address(node.host, node.port)),
          row('components.SixthKind.707842-5', address(node.publicHost, node.publicPort)), row('GatewayOutline.nodeEnabled', node.enabled),
        ] })
      })
    }
  }
  if (!agentProviders.includes(provider) && !pluginProviders.includes(provider) && provider !== 'composite-device-gateway') {
    sections.push({ key: 'protocol', title: t('GatewayEditor.protocol'), builtin: model.builtin, rows: [
      row('GatewayEditor.protocolName', name(protocol) || gateway.protocol), row('GatewayEditor.description', description(protocol)),
    ], documents: model.documents, showDocument: true })
  }
  return sections
}

/** 复合网关保持配置顺序，子项在当前弹窗内展开，不创建另一层详情。 */
export function buildOutlineSections(model: GatewayOutlineModel, t: OutlineTranslate): OutlineSection[] {
  const gateway = model.gateway
  const row = (key: string, value: unknown): OutlineRow => ({ label: t(key), value: displayOutlineValue(value, t) })
  const created = gateway.createTime === undefined || gateway.createTime === null || gateway.createTime === '' ? undefined : dayjs(gateway.createTime)
  const sections: OutlineSection[] = [{ key: 'basic', title: t('GatewayEditor.basic'), rows: [
    row('GatewayEditor.name', getI18nText(gateway, 'name')),
    row('GatewayEditor.method', getI18nText(model.provider, 'name') || gateway.provider),
    row('AccessConfig.bizKey.label', gateway.bizKey),
    row('GatewayOutline.createTime', created?.isValid() ? created.format(t('GatewayOutline.dateFormat')) : gateway.createTime),
    row('GatewayEditor.description', getI18nText(gateway, 'description')),
  ] }]
  if (gateway.provider !== 'composite-device-gateway') return [...sections, ...resourceSections(model, t)]
  if (!model.children.length) return [...sections, { key: 'children', title: t('GatewayOutline.children'), rows: [], emptyChildren: true }]
  model.children.forEach((child, index) => {
    const children = resourceSections(child, t)
    const rows: OutlineRow[] = [row('GatewayOutline.channelName', getI18nText(child.gateway, 'name'))]
    children.forEach(section => section.rows.forEach(item => {
      // 子分区合并后仍区分网络说明、协议说明和插件配置，避免同名字段覆盖。
      const label = item.label === t('GatewayEditor.componentName') || item.label === t('GatewayEditor.protocolName')
        ? section.title : `${section.title} · ${item.label}`
      rows.push({ ...item, label })
    }))
    sections.push({ key: `child-${index}`, title: `${index + 1}. ${getI18nText(child.provider, 'name') || child.gateway.provider || t('GatewayEditor.unconfigured')}`,
      tag: getI18nText(child.gateway, 'name'), rows, documents: child.documents,
      // 原型复合分区直接呈现路由表，认证文档保留在普通协议详情中。
      showDocument: false,
    })
  })
  return sections
}
