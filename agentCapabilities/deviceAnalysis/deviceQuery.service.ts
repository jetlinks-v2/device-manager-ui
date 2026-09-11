import {
  createDomainAgentPreviewCardinality,
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
  resolveDomainAgentInteger,
  resolveDomainAgentMessage,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { queryDevicePage_api } from '@device-manager-ui/api/device'
import { getDeviceSummary_api } from '@device-manager-ui/api/deviceGroup'
import {
  mapDevice,
  runDeviceTool,
} from './deviceAnalysis.shared'
import { buildDeviceAnalysisSearchTerms } from './deviceAnalysisScope'

const DEVICE_DETAIL_MENU_CODE = 'iot-user/device/list'

export const deviceQueryService = {
  search: (args: Record<string, unknown>) => runDeviceTool<Array<Record<string, unknown>>>([], async () => {
    const pageIndex = resolveDomainAgentInteger(args.pageIndex, { name: 'pageIndex', defaultValue: 0, min: 0, max: 10000 })
    const pageSize = resolveDomainAgentInteger(args.pageSize, { name: 'pageSize', defaultValue: 20, min: 1, max: 50 })
    const terms = await buildDeviceAnalysisSearchTerms(args)
    const page = await queryDevicePage_api({
      pageIndex,
      pageSize,
      terms,
      sorts: [{ name: 'createTime', order: 'desc' }],
    })
    const mapped = page.data.map(mapDevice)
    const singleResult = page.total === 1 && mapped.length === 1 ? mapped[0] : undefined
    return createDomainAgentToolResult({
      domain: 'device',
      filters: {
        keyword: args.keyword,
        state: args.state,
        productId: args.productId,
        productName: args.productName,
        area: args.area,
        group: args.group,
      },
      summary: {
        returned: mapped.length,
        total: page.total,
        matchType: page.total === 1 ? 'single' : page.total > 1 ? 'multiple' : 'none',
      },
      data: mapped,
      total: page.total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: mapped.length,
        totalCount: page.total,
      }),
      truncated: (pageIndex + 1) * pageSize < page.total,
      nextPage: (pageIndex + 1) * pageSize < page.total ? pageIndex + 1 : undefined,
      navigation: singleResult ? [{
        kind: 'detail',
        label: singleResult.name || singleResult.id,
        path: singleResult.navigation,
        menuCode: DEVICE_DETAIL_MENU_CODE,
        subject: { type: 'device', id: singleResult.id, name: singleResult.name },
        requiresConfirmation: true,
      }] : undefined,
    })
  }),

  healthSummary: (args: Record<string, unknown>) => runDeviceTool<Record<string, unknown>>({}, async () => {
    const limit = resolveDomainAgentInteger(args.limit, { name: 'limit', defaultValue: 10, min: 1, max: 20 })
    const terms = await buildDeviceAnalysisSearchTerms(args)
    const [summary, offlinePage] = await Promise.all([
      getDeviceSummary_api({ terms }),
      queryDevicePage_api({
        pageIndex: 0,
        pageSize: limit,
        terms: [...terms, { column: 'state', termType: 'eq', value: 'offline' }],
        sorts: [{ name: 'offlineTime', order: 'desc' }],
      }),
    ])
    const data = {
      total: summary.total,
      online: summary.online,
      offline: summary.offline,
      noData: summary.noData,
      watch: summary.watch,
      normal: summary.normal,
      offlineDevices: offlinePage.data.map(mapDevice),
    }
    return createDomainAgentToolResult({
      domain: 'device',
      status: summary.total === 0 ? 'empty' : 'ok',
      summary: {
        snapshot: 'current',
        total: summary.total,
        offline: summary.offline,
        noData: summary.noData,
        watch: summary.watch,
      },
      data,
      cardinality: createDomainAgentPreviewCardinality({
        displayedCount: data.offlineDevices.length,
        totalCount: offlinePage.total,
      }),
      truncated: offlinePage.total > limit,
      supportsAbsenceClaim: summary.total === 0,
      warnings: [resolveDomainAgentMessage('IotGeneralAgent.warnings.healthSnapshot')],
    })
  }),
}
