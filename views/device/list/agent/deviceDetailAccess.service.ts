import { createDomainAgentToolResult } from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import type { IotDevice } from '../types'
import { iotDeviceDetailRealApi } from '../services/iotDeviceDetailReal.service'
import {
  asRecord,
  normalizeText,
  runDetailTool,
  safeText,
  unwrapResult,
} from './deviceDetailAgent.shared'

const arrayValue = (value: unknown) => Array.isArray(value) ? value : []

const firstRecord = (value: unknown) => {
  const result = unwrapResult(value)
  const record = asRecord(result)
  const data = Array.isArray(record.data) ? record.data : []
  return data.length ? asRecord(data[0]) : record
}

const formatConfigValue = (type: Record<string, unknown>, value: unknown) => {
  const typeName = normalizeText(type.type).toLowerCase()
  if (['password', 'credential', 'secret'].some(name => typeName.includes(name))) {
    return value === undefined || value === null || value === '' ? undefined : '******'
  }
  if (typeName === 'enum') {
    const option = arrayValue(type.elements)
      .map(asRecord)
      .find(item => `${item.value}` === `${value}`)
    return { value, text: option?.text ?? value }
  }
  if (typeName === 'boolean') {
    const text = `${value}` === `${type.trueValue}` ? type.trueText
      : `${value}` === `${type.falseValue}` ? type.falseText : value
    return { value, text }
  }
  return typeof value === 'string' ? safeText(value, 500) : value
}

const mapConfigGroups = (groups: unknown, configuration: Record<string, unknown>) => (
  arrayValue(groups).slice(0, 20).map((input) => {
    const group = asRecord(input)
    return {
      name: safeText(group.name, 200),
      description: safeText(group.description, 500) || undefined,
      properties: arrayValue(group.properties).slice(0, 50).map((value) => {
        const property = asRecord(value)
        const id = normalizeText(property.property || property.id)
        const type = asRecord(property.type)
        return {
          id,
          name: safeText(property.name || id, 200),
          description: safeText(property.description, 500) || undefined,
          type: normalizeText(type.type) || undefined,
          value: formatConfigValue(type, configuration[id]),
        }
      }),
    }
  })
)

const mapPrincipals = (value: unknown) => arrayValue(value).slice(0, 20).map((input) => {
  const principal = asRecord(input)
  const metadata = asRecord(principal.metadata)
  const identity = asRecord(principal.identity)
  const credential = asRecord(principal.credential)
  const credentialContent = asRecord(credential.content)
  return {
    name: safeText(metadata.name, 200) || undefined,
    description: safeText(metadata.description, 500) || undefined,
    identity: {
      type: normalizeText(identity.type) || undefined,
      identifier: safeText(identity.identifier, 300) || undefined,
    },
    credential: {
      type: normalizeText(credential.type) || undefined,
      configured: Object.values(credentialContent).some(item => item !== undefined && item !== null && item !== ''),
    },
  }
})

/** Mirrors the user-facing access-configuration page while excluding runtime node details. */
export const createDeviceDetailAccessService = (device: IotDevice) => {
  const accessSummary = () => runDetailTool<Record<string, unknown>>({}, async () => {
    const productId = device.productId || device.productKey
    const [detailResult, productResult, configResult, principalSupportResult] = await Promise.allSettled([
      iotDeviceDetailRealApi.getDeviceDetail(device.id),
      productId ? iotDeviceDetailRealApi.getProductDetail(productId) : Promise.resolve(undefined),
      iotDeviceDetailRealApi.queryDeviceConfig(device.id),
      iotDeviceDetailRealApi.existsDevicePrincipalSupport(),
    ])
    const detail = detailResult.status === 'fulfilled' ? firstRecord(detailResult.value) : {}
    const product = productResult.status === 'fulfilled' ? firstRecord(productResult.value) : {}
    const accessId = normalizeText(product.accessId)

    let access: Record<string, unknown> = {}
    let accessFailed = false
    if (accessId) {
      try {
        const queried = await iotDeviceDetailRealApi.queryGatewayDetail(accessId)
        access = firstRecord(queried)
        if (!Object.keys(access).length) access = firstRecord(await iotDeviceDetailRealApi.getGatewayDetail(accessId))
      } catch {
        accessFailed = true
      }
    }

    const protocol = normalizeText(detail.messageProtocol || access.protocol || device.protocol)
    const transport = normalizeText(detail.transportProtocol || access.transport || device.transport)
    let protocolView: Record<string, unknown> = {}
    let protocolFailed = false
    if (protocol && transport) {
      try {
        protocolView = firstRecord(await iotDeviceDetailRealApi.queryProtocolDetail(protocol, transport))
      } catch {
        protocolFailed = true
      }
    }

    let principals: unknown[] = []
    let principalFailed = false
    const principalSupported = principalSupportResult.status === 'fulfilled'
      ? Boolean(unwrapResult(principalSupportResult.value))
      : false
    if (principalSupported) {
      try {
        principals = arrayValue(unwrapResult(await iotDeviceDetailRealApi.getDevicePrincipal(device.id)))
      } catch {
        principalFailed = true
      }
    }

    const configuration = asRecord(detail.configuration)
    const configMetadata = configResult.status === 'fulfilled' ? unwrapResult(configResult.value) : []
    const groups = arrayValue(configMetadata).length ? configMetadata : protocolView.allConfig
    const addresses = arrayValue(asRecord(access.channelInfo).addresses).slice(0, 20).map((value) => {
      const address = asRecord(value)
      return {
        address: safeText(address.address, 500),
        healthy: address.health === undefined ? undefined : Number(address.health) !== -1,
      }
    }).filter(item => item.address)
    const data = {
      status: device.connectionStatus || device.status,
      access: {
        name: safeText(access.name || device.accessName || device.accessMode, 300),
        description: safeText(access.description, 600) || undefined,
        protocol: protocol || undefined,
        transport: transport || undefined,
        addresses,
      },
      configuration: mapConfigGroups(groups, configuration),
      connectionParameters: mapPrincipals(principals),
      onlineAt: detail.onlineTime || device.onlineAt,
      offlineAt: detail.offlineTime || device.offlineAt,
    }
    const partial = [detailResult, productResult, configResult].some(item => item.status === 'rejected')
      || accessFailed || protocolFailed || principalFailed
    const hasData = Boolean(data.access.name || addresses.length || data.configuration.length || data.connectionParameters.length)
    return createDomainAgentToolResult({
      domain: 'device',
      status: partial ? 'partial' : hasData ? undefined : 'empty',
      summary: {
        deviceId: device.id,
        status: data.status,
        addressCount: addresses.length,
        configGroupCount: data.configuration.length,
        connectionParameterCount: data.connectionParameters.length,
      },
      data,
    })
  })

  return { accessSummary }
}
