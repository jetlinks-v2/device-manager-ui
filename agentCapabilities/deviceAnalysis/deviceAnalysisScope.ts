import {
  createDomainAgentInputError,
  resolveDomainAgentEnum,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import type { DeviceQueryTerm } from '@device-manager-ui/api/device'
import { queryDeviceGroupPage_api } from '@device-manager-ui/api/deviceGroup'
import {
  queryProjectSpaceAreaSettings_api,
  querySpaceAreaDeviceIds_api,
} from '@device-manager-ui/api/spaceArea'
import { IOT_DEVICE_STATES } from './constants'

const normalizeText = (value: unknown) => String(value || '').trim()

const inputError = (code: string, key: string, params?: Record<string, string | number>) => (
  createDomainAgentInputError(code, `IotGeneralAgent.errors.${key}`, params)
)

/** Converts the public business filters into the bounded device query terms used by iot-ui APIs. */
export const buildDeviceAnalysisSearchTerms = async (
  args: Record<string, unknown>,
): Promise<DeviceQueryTerm[]> => {
  const terms: DeviceQueryTerm[] = []
  const keyword = normalizeText(args.keyword)
  if (keyword) {
    terms.push({
      terms: [
        { column: 'name', termType: 'like', value: keyword },
        { column: 'id', termType: 'like', value: keyword, type: 'or' },
        { column: 'identifier', termType: 'like', value: keyword, type: 'or' },
        { column: 'productName', termType: 'like', value: keyword, type: 'or' },
      ],
    })
  }

  const state = normalizeText(args.state)
  if (state) {
    const value = resolveDomainAgentEnum(state, IOT_DEVICE_STATES, { name: 'state' })
    terms.push({ column: 'state', termType: 'eq', value: value === 'disabled' ? 'notActive' : value })
  }
  if (normalizeText(args.productId)) {
    terms.push({ column: 'productId', termType: 'eq', value: normalizeText(args.productId) })
  } else if (normalizeText(args.productName)) {
    terms.push({ column: 'productName', termType: 'like', value: normalizeText(args.productName) })
  }

  const group = normalizeText(args.group)
  if (group) {
    const groups = await queryDeviceGroupPage_api({
      pageIndex: 0,
      pageSize: 20,
      terms: [{ column: 'name', termType: 'like', value: group }],
    })
    const matched = groups.data.filter(item => item.id === group || item.name === group)
    if (matched.length !== 1) {
      throw inputError('DEVICE_GROUP_NOT_UNIQUE', 'groupNotUnique', { group })
    }
    terms.push({ column: 'id', termType: 'dev-group-tree', value: matched[0].id })
  }

  const area = normalizeText(args.area)
  if (area) {
    const settings = await queryProjectSpaceAreaSettings_api(getProjectIdFromLocation())
    const matched = settings.areas.filter(item => item.id === area || item.name === area || item.code === area)
    if (matched.length !== 1) {
      throw inputError('DEVICE_AREA_NOT_UNIQUE', 'areaNotUnique', { area })
    }
    const deviceIds = await querySpaceAreaDeviceIds_api([matched[0].id])
    terms.push({ column: 'id', termType: 'in', value: deviceIds.length ? deviceIds : ['__none__'] })
  }
  return terms
}
