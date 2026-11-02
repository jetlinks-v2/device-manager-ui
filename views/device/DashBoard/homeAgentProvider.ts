import dayjs from 'dayjs';
import i18n from '@jetlinks-web-core/locales';
import { encodeQuery } from '@jetlinks-web-core/utils';
import {
  registerHomeAgentCapabilityProvider,
  type HomeAgentCapabilityContext,
  type HomeAgentCapabilityProvider,
  type HomeAgentWorkflowGuide,
} from '@jetlinks-web-core/layout/components/AiChat/homeAgentCapabilities';
import type { AiClientToolDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientTools';
import {
  clientToolOutput,
  clientToolResult,
  defineClientTool,
  defineClientToolAnalyticalProducer,
  type ClientToolOutput,
} from '@jetlinks-web-core/layout/components/AiChat/clientToolApi';
import {
  createDomainAgentTimeScopeContract,
  resolveDomainAgentTimeRange,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools';
import {
  dashboard,
  deviceCount,
  productCount,
} from '../../../api/dashboard';
import { findDeviceAgentMenu, isDeviceAgentMenuRoute } from '../../../agentCapabilities/deviceMenus';
import { createDeviceMessageTrendFields } from '../../../agentCapabilities/deviceTrendFields';

const DEVICE_DASHBOARD_OVERVIEW_TOOL = 'device_dashboard_get_overview';
const DEVICE_DASHBOARD_PRODUCT_STATS_TOOL = 'device_dashboard_get_product_stats';
const DEVICE_DASHBOARD_DEVICE_STATS_TOOL = 'device_dashboard_get_device_stats';
const DEVICE_DASHBOARD_ONLINE_TREND_TOOL = 'device_dashboard_get_online_trend';
const DEVICE_DASHBOARD_MESSAGE_AGGREGATION_TOOL = 'device_dashboard_analyze_message_aggregation';

const isDeviceDashboardRoute = (context: HomeAgentCapabilityContext) => (
  isDeviceAgentMenuRoute(context, 'dashboard')
);

const isDeviceDashboardAvailable = (context: HomeAgentCapabilityContext) => (
  !!findDeviceAgentMenu(context, 'dashboard') || !!findDeviceAgentMenu(context, 'instance')
);

// The legacy dashboard includes product statistics; the new list grants device statistics only.
const isProductStatsAvailable = (context: HomeAgentCapabilityContext) => (
  !!findDeviceAgentMenu(context, 'dashboard') || !!findDeviceAgentMenu(context, 'product')
);

const isDashboardToolAvailable = (context: HomeAgentCapabilityContext, toolId: string) => (
  isDeviceDashboardAvailable(context)
  && (![DEVICE_DASHBOARD_OVERVIEW_TOOL, DEVICE_DASHBOARD_PRODUCT_STATS_TOOL].includes(toolId)
    || isProductStatsAvailable(context))
);

const getPromptExamples = (context: HomeAgentCapabilityContext) => [
  i18n.global.t('DashBoard.homeAgent.prompt.deviceStatus'),
  i18n.global.t('DashBoard.homeAgent.prompt.messageAggregation'),
  i18n.global.t('DashBoard.homeAgent.prompt.messagePeak'),
  ...(isProductStatsAvailable(context) ? [i18n.global.t('DashBoard.homeAgent.prompt.overview')] : []),
  i18n.global.t('DashBoard.homeAgent.prompt.messageTrend'),
];

const getWorkflowGuides = (): HomeAgentWorkflowGuide[] => [
  {
    id: 'device-dashboard:message-aggregation',
    name: i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.name'),
    description: i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.description'),
    when: i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.when'),
    scenarios: [
      i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.scenario.quantity'),
      i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.scenario.trend'),
      i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.scenario.peak'),
      i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.scenario.timeRange'),
    ],
    keywords: ['device', 'dashboard', 'message', 'aggregation', 'trend', 'peak', '设备', '仪表盘', '消息', '聚合', '趋势', '峰值'],
    priority: 80,
    steps: [
      {
        title: i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.step.range.title'),
        description: i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.step.range.description'),
        inputs: { timeRange: 'today|24h|7d|30d|custom', startTime: 'custom-start', endTime: 'custom-end' },
        required: true,
      },
      {
        title: i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.step.aggregate.title'),
        description: i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.step.aggregate.description'),
        tools: [DEVICE_DASHBOARD_MESSAGE_AGGREGATION_TOOL],
        required: true,
      },
      {
        title: i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.step.summarize.title'),
        description: i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.step.summarize.description'),
        required: true,
      },
    ],
    output: [
      i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.output.range'),
      i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.output.total'),
      i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.output.peak'),
      i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.output.limit'),
    ],
    notes: i18n.global.t('DashBoard.homeAgent.workflow.messageAggregation.notes'),
  },
];

const ensureSuccess = <T>(response: { status?: number; result?: T; message?: string } | undefined): T => {
  if (response?.status !== 200) {
    throw new Error(response?.message || 'dashboard request failed');
  }
  return (response.result ?? null) as T;
};

const toNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getYesterdayRange = () => ({
  from: dayjs().subtract(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  to: dayjs().subtract(1, 'day').endOf('day').format('YYYY-MM-DD HH:mm:ss'),
});

const toPlainRecord = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
);

const resolveDashboardTimeRange = (args: Record<string, any> = {}) => {
  const timeRangeRecord = toPlainRecord(args.timeRange);
  const nestedRange = Object.keys(timeRangeRecord).length ? timeRangeRecord : toPlainRecord(args.range);
  const from = args.startTime ?? args.from ?? args.start ?? nestedRange.from ?? nestedRange.start ?? nestedRange.startTime;
  const to = args.endTime ?? args.to ?? args.end ?? nestedRange.to ?? nestedRange.end ?? nestedRange.endTime;
  const rawPreset = typeof args.timeRange === 'string' ? args.timeRange
    : args.shortcut ?? nestedRange.shortcut ?? nestedRange.value ?? nestedRange.type
      ?? (typeof args.range === 'string' ? args.range : undefined);
  // Keep valid historical aliases at execution only; the published schema uses the shared time contract.
  const aliases: Record<string, string> = {
    day: '24h', last24h: '24h', last_24h: '24h', '最近24小时': '24h', '近24小时': '24h',
    week: '7d', last7d: '7d', last_7d: '7d', '最近7天': '7d', '近7天': '7d', '近一周': '7d',
    month: '30d', last30d: '30d', last_30d: '30d', '最近30天': '30d', '近30天': '30d', '近一个月': '30d',
  };
  const preset = rawPreset === undefined ? undefined : String(rawPreset).trim().toLowerCase();
  const range = resolveDomainAgentTimeRange({
    timeRange: preset === undefined
      ? (from !== undefined || to !== undefined ? 'custom' : 'today')
      : aliases[preset] ?? preset,
    startTime: from,
    endTime: to,
  });
  return {
    from: range.start, to: range.end, label: range.label,
    startMs: range.start, endMs: range.end,
  };
};

const resolveDashboardAggregationQuery = (range: { startMs: number; endMs: number }) => {
  const duration = range.endMs - range.startMs;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  // Select an aggregation bucket from the requested range so dashboard tools are not limited to "today".
  if (duration <= hour + 10) {
    return { time: '1m', format: 'yyyy-MM-dd HH:mm:ss', limit: 60 };
  }
  if (duration <= day) {
    return { time: '1h', format: 'yyyy-MM-dd HH:mm:ss', limit: 24 };
  }
  if (duration < year) {
    return { time: '1d', format: 'yyyy-MM-dd', limit: Math.abs(Math.ceil(duration / day)) + 1 };
  }
  return { time: '1M', format: 'yyyy-MM', limit: Math.max(1, Math.abs(Math.floor(duration / month))) };
};

const buildSeries = (items: any[], group?: string) => {
  const source = group ? items.filter((item) => item?.group === group) : items;
  return source
    .map((item) => {
      const time = item?.data?.timeString;
      if (typeof time !== 'string' || !dayjs(time).isValid()) {
        throw new Error(i18n.global.t('DashBoard.homeAgent.tool.timeRange.invalidRange'));
      }
      return { time, label: time, timestamp: dayjs(time).valueOf(), value: toNumber(item?.data?.value) };
    })
    .sort((left, right) => left.timestamp - right.timestamp);
};

const summarizeSeries = (series: Array<{ time?: string; value: number }>) => {
  const total = series.reduce((sum, item) => sum + item.value, 0);
  const peak = series.reduce((max, item) => (
    item.value > max.value ? item : max
  ), { time: '', value: 0 });
  const latest = series[series.length - 1] || { time: '', value: 0 };
  const average = series.length ? Number((total / series.length).toFixed(2)) : 0;

  return {
    total,
    peak,
    latest,
    average,
  };
};

const getProductStats = async () => {
  const [total, normal, disabled] = await Promise.all([
    productCount({}),
    productCount({ terms: [{ column: 'state', value: '1' }] }),
    productCount({ terms: [{ column: 'state', value: '0' }] }),
  ]);

  return {
    total: toNumber(ensureSuccess<number>(total)),
    normal: toNumber(ensureSuccess<number>(normal)),
    disabled: toNumber(ensureSuccess<number>(disabled)),
  };
};

const getDeviceStats = async () => {
  const [total, online, offline] = await Promise.all([
    deviceCount(),
    deviceCount(encodeQuery({ terms: { state: 'online' } })),
    deviceCount(encodeQuery({ terms: { state: 'offline' } })),
  ]);
  const totalValue = toNumber(ensureSuccess<number>(total));
  const onlineValue = toNumber(ensureSuccess<number>(online));
  const offlineValue = toNumber(ensureSuccess<number>(offline));

  return {
    total: totalValue,
    online: onlineValue,
    offline: offlineValue,
    onlineRate: totalValue > 0 ? Number(((onlineValue / totalValue) * 100).toFixed(2)) : 0,
  };
};

const getMonthMessageTotal = async () => {
  const resp = await dashboard([
    {
      dashboard: 'device',
      object: 'message',
      measurement: 'quantity',
      dimension: 'agg',
      group: 'monthTotal',
      params: {
        time: '1M',
        format: 'yyyy-MM',
        limit: 1,
        from: 'now-1M',
      },
    },
  ]);

  return toNumber(ensureSuccess<any[]>(resp).find((item) => item?.group === 'monthTotal')?.data?.value);
};

const queryOnlineTrend = async (args: Record<string, any> = {}) => {
  const range = resolveDashboardTimeRange(args);
  const query = resolveDashboardAggregationQuery(range);
  const shouldCompareYesterday = range.label === 'today';
  const dashboardQueries: Record<string, any>[] = [
    {
      dashboard: 'device',
      object: 'session',
      measurement: 'online',
      dimension: 'agg',
      group: 'onlineTrend',
      params: {
        state: 'online',
        limit: query.limit,
        from: range.from,
        to: range.to,
        time: query.time,
        format: query.format,
      },
    },
  ];
  if (shouldCompareYesterday) {
    const yesterdayRange = getYesterdayRange();
    dashboardQueries.push(
      {
        dashboard: 'device',
        object: 'session',
        measurement: 'online',
        dimension: 'agg',
        group: 'yesterday',
        params: {
          state: 'online',
          limit: 24,
          from: yesterdayRange.from,
          to: yesterdayRange.to,
          time: '1d',
          format: 'yyyy-MM-dd HH:mm:ss',
        },
      },
    );
  }
  const resp = await dashboard(dashboardQueries);
  const items = ensureSuccess<any[]>(resp);
  const series = buildSeries(items, 'onlineTrend');
  const summary = summarizeSeries(series);
  const yesterdayOnline = shouldCompareYesterday
    ? toNumber(items.find((item) => item?.group === 'yesterday')?.data?.value)
    : undefined;

  return {
    ok: true,
    range: {
      start: range.startMs,
      end: range.endMs,
      from: range.from,
      to: range.to,
      shortcut: range.label,
      time: query.time,
      format: query.format,
      limit: query.limit,
    },
    ...(yesterdayOnline === undefined ? {} : { yesterdayOnline }),
    currentOnline: summary.latest.value,
    peakOnline: summary.peak,
    averageOnline: summary.average,
    series,
    summary: i18n.global.t('DashBoard.homeAgent.tool.onlineTrend.summary', [
      range.label,
      summary.latest.value,
      summary.peak.time || '-',
      summary.peak.value,
      summary.average,
    ]),
  };
};

const resolveMessageRange = (args: Record<string, any>) => resolveDashboardTimeRange(args);

const analyzeMessageAggregation = async (args: Record<string, any> = {}) => {
  const range = resolveMessageRange(args);
  const query = resolveDashboardAggregationQuery(range);
  const resp = await dashboard([
    {
      dashboard: 'device',
      object: 'message',
      measurement: 'quantity',
      dimension: 'agg',
      group: 'messageAggregation',
      params: {
        time: query.time,
        format: query.format,
        limit: query.limit,
        from: range.from,
        to: range.to,
      },
    },
  ]);
  const series = buildSeries(ensureSuccess<any[]>(resp), 'messageAggregation');
  const summary = summarizeSeries(series);

  return {
    ok: true,
    range: {
      start: range.startMs,
      end: range.endMs,
      from: range.from,
      to: range.to,
      shortcut: range.label,
      time: query.time,
      format: query.format,
      limit: query.limit,
    },
    total: summary.total,
    peak: summary.peak,
    latest: summary.latest,
    average: summary.average,
    series,
    summary: i18n.global.t('DashBoard.homeAgent.tool.messageAggregation.summary', [
      range.label,
      summary.total,
      summary.peak.time || '-',
      summary.peak.value,
      summary.latest.time || '-',
      summary.latest.value,
      summary.average,
    ]),
  };
};

const getDashboardOverview = async () => {
  const [productStats, deviceStats, onlineTrend, messageAggregation, monthMessageTotal] = await Promise.all([
    getProductStats(),
    getDeviceStats(),
    queryOnlineTrend(),
    analyzeMessageAggregation({ shortcut: 'today' }),
    getMonthMessageTotal(),
  ]);

  return {
    ok: true,
    product: productStats,
    device: deviceStats,
    online: {
      current: onlineTrend.currentOnline,
      yesterday: onlineTrend.yesterdayOnline,
      peak: onlineTrend.peakOnline,
      average: onlineTrend.averageOnline,
    },
    message: {
      todayTotal: messageAggregation.total,
      monthTotal: monthMessageTotal,
      peak: messageAggregation.peak,
      latest: messageAggregation.latest,
      average: messageAggregation.average,
    },
    summary: i18n.global.t('DashBoard.homeAgent.tool.overview.summary', [
      productStats.total,
      productStats.normal,
      productStats.disabled,
      deviceStats.total,
      deviceStats.online,
      deviceStats.offline,
      deviceStats.onlineRate,
      messageAggregation.total,
    ]),
  };
};

/** Declare summary and reusable series separately so quantities cannot be mistaken for row counts. */
const defineDashboardTool = <TResult extends Record<string, unknown>>(
  id: string,
  localeKey: string,
  query: (args: Record<string, any>) => Promise<TResult>,
  trend?: { output: ClientToolOutput<TResult>; measure: 'uplink_messages' | 'online_devices' },
) => {
  const seriesOutput = trend?.output;
  const timeScope = seriesOutput ? dashboardTimeScope() : undefined;
  return defineClientTool<Record<string, any>, HomeAgentCapabilityContext, TResult>({
    id,
    description: {
      text: i18n.global.t(`DashBoard.homeAgent.tool.${localeKey}.description`),
      help: i18n.global.t(`DashBoard.homeAgent.tool.${localeKey}.help`),
      capabilities: [`device.dashboard.${localeKey}.read`],
    },
    presentation: {
      displayName: i18n.global.t(`DashBoard.homeAgent.tool.${localeKey}.displayName`),
      progressText: i18n.global.t(`DashBoard.homeAgent.tool.${localeKey}.progressText`),
    },
    inputs: timeScope?.inputs || [],
    ...(trend && timeScope ? {
      inputAlternatives: timeScope.inputAlternatives,
      temporal: timeScope.temporal,
      analytical: dashboardTrendCapability(trend.measure, trend.output.name),
    } : {}),
    effect: { kind: 'READ' },
    output: seriesOutput || clientToolOutput.detail({
      name: 'dashboard-statistics', shape: 'device.dashboard.statistics',
    }),
    owner: { module: 'device-manager-ui', group: 'device-dashboard' },
    execute: async (args, context) => {
      if (!isDashboardToolAvailable(context, id)) {
        throw new Error(i18n.global.t('Instance.homeAgent.tool.search.noPermission'));
      }
      const value = await query(args);
      const { series, summary, ...statistics } = value;
      return clientToolResult.success(value, {
        summary: { ...statistics, ...(typeof summary === 'string' ? { description: summary } : {}) },
        ...(seriesOutput && Array.isArray(series) ? {
          cardinality: {
            kind: 'aggregate-series', bucketCount: series.length,
            populatedBucketCount: series.length, measurementCount: series.length,
          },
          requestedRange: {
            start: (value.range as Record<string, unknown>).start,
            end: (value.range as Record<string, unknown>).end,
          },
          requestSatisfied: true,
          exhaustive: true,
        } : {}),
      });
    },
  });
};

const dashboardTimeScope = () => createDomainAgentTimeScopeContract({
  timeRange: i18n.global.t('IotGeneralAgent.inputs.timeRange'),
  startTime: i18n.global.t('IotGeneralAgent.inputs.startTime'),
  endTime: i18n.global.t('IotGeneralAgent.inputs.endTime'),
});

const dashboardTrendCapability = (measure: 'uplink_messages' | 'online_devices', output: string) => defineClientToolAnalyticalProducer({
  producerKey: `device.dashboard.${measure}.trend`,
  factKey: measure === 'uplink_messages' ? 'device.uplink-messages' : 'device.online-devices',
  subjects: ['device'],
  measures: [{
    name: measure,
    aggregations: [measure === 'uplink_messages' ? 'sum' : 'avg'],
    units: ['count'],
  }],
  dimensions: ['time'], filters: [], grains: [], criteria: ['trend'],
  ordering: [{ axis: 'timestamp', direction: 'asc' }],
  coverage: 'complete', output,
});

const dashboardSeriesOutput = <TResult extends { series: Array<{ timestamp: number; value: number }> }>(
  name: string,
  measure: 'count' | 'gauge',
) => clientToolOutput.aggregateSeries<TResult>({
  name,
  shape: 'time-series.aggregate',
  select: result => result.series.map(({ timestamp, value }) => ({ timestamp, value })),
  recordPath: '$',
  fields: measure === 'count' ? createDeviceMessageTrendFields() : [
    { name: 'timestamp', type: 'timestamp', role: 'temporal_dimension', axis: 'time', encoding: 'epoch-millis' },
    {
      name: 'value', type: 'number', role: 'measure',
      label: i18n.global.t('IotGeneralAgent.metrics.onlineDevices'),
      measure: 'online_devices', unit: 'count',
      unitLabel: i18n.global.t('IotDeviceGroups.unit.device'), aggregation: 'avg',
    },
  ],
  ordering: { keys: [{ field: 'timestamp', direction: 'asc' }], producerGuaranteed: true },
});

const createDeviceDashboardTools = (): AiClientToolDefinition<HomeAgentCapabilityContext>[] => ([
  defineDashboardTool(DEVICE_DASHBOARD_OVERVIEW_TOOL, 'overview', getDashboardOverview),
  defineDashboardTool(DEVICE_DASHBOARD_PRODUCT_STATS_TOOL, 'productStats', async () => ({
    ok: true, product: await getProductStats(),
  })),
  defineDashboardTool(DEVICE_DASHBOARD_DEVICE_STATS_TOOL, 'deviceStats', async () => ({
    ok: true, device: await getDeviceStats(),
  })),
  defineDashboardTool(DEVICE_DASHBOARD_ONLINE_TREND_TOOL, 'onlineTrend', queryOnlineTrend,
    { output: dashboardSeriesOutput<Awaited<ReturnType<typeof queryOnlineTrend>>>('device-online-trend', 'gauge'), measure: 'online_devices' }),
  defineDashboardTool(DEVICE_DASHBOARD_MESSAGE_AGGREGATION_TOOL, 'messageAggregation', analyzeMessageAggregation,
    { output: dashboardSeriesOutput<Awaited<ReturnType<typeof analyzeMessageAggregation>>>('device-message-trend', 'count'), measure: 'uplink_messages' }),
]);

const createDeviceDashboardCapabilities = (context: HomeAgentCapabilityContext) => {
  const currentRoute = isDeviceDashboardRoute(context);
  const menu = findDeviceAgentMenu(context, 'dashboard') || findDeviceAgentMenu(context, 'instance');
  if (!menu) return [];
  const base = {
    category: 'device-dashboard',
    menuCode: menu.code,
    routeName: menu.routeName || menu.code,
    path: menu.path,
    metadata: {
      currentRoute,
    },
  };

  return [
    {
      ...base,
      id: 'device-dashboard:overview',
      name: i18n.global.t('DashBoard.homeAgent.capability.overview.name'),
      description: i18n.global.t('DashBoard.homeAgent.capability.overview.description'),
      kind: 'feature' as const,
      order: 10,
      keywords: ['device', 'dashboard', 'overview', 'statistics', '设备', '仪表盘', '概览', '统计'],
      metadata: {
        ...base.metadata,
        promptExamples: getPromptExamples(context),
      },
    },
    {
      ...base,
      id: 'device-dashboard:product-stats',
      name: i18n.global.t('DashBoard.homeAgent.capability.productStats.name'),
      description: i18n.global.t('DashBoard.homeAgent.capability.productStats.description'),
      kind: 'feature' as const,
      order: 20,
      keywords: ['product', 'normal', 'disabled', '产品', '启用', '禁用'],
    },
    {
      ...base,
      id: 'device-dashboard:device-stats',
      name: i18n.global.t('DashBoard.homeAgent.capability.deviceStats.name'),
      description: i18n.global.t('DashBoard.homeAgent.capability.deviceStats.description'),
      kind: 'feature' as const,
      order: 30,
      keywords: ['device', 'online', 'offline', 'rate', '设备', '在线', '离线', '在线率'],
    },
    {
      ...base,
      id: 'device-dashboard:online-trend',
      name: i18n.global.t('DashBoard.homeAgent.capability.onlineTrend.name'),
      description: i18n.global.t('DashBoard.homeAgent.capability.onlineTrend.description'),
      kind: 'feature' as const,
      order: 40,
      keywords: ['online', 'trend', 'session', '在线', '趋势', '会话'],
    },
    {
      ...base,
      id: 'device-dashboard:message-aggregation',
      name: i18n.global.t('DashBoard.homeAgent.capability.messageAggregation.name'),
      description: i18n.global.t('DashBoard.homeAgent.capability.messageAggregation.description'),
      kind: 'feature' as const,
      order: 50,
      keywords: ['message', 'aggregation', 'trend', 'quantity', '消息', '聚合', '趋势', '数量'],
    },
  ].filter(capability => (
    !['device-dashboard:overview', 'device-dashboard:product-stats'].includes(capability.id)
    || isProductStatsAvailable(context)
  ));
};

export const deviceDashboardHomeAgentProvider: HomeAgentCapabilityProvider = {
  id: 'device-dashboard',
  order: 100,
  getCapabilities: (context) => (isDeviceDashboardAvailable(context)
    ? createDeviceDashboardCapabilities(context)
    : []),
  getClientTools: (context) => createDeviceDashboardTools()
    .filter(tool => isDashboardToolAvailable(context, tool.id)),
  getPromptExamples: (context) => (isDeviceDashboardRoute(context)
    ? getPromptExamples(context)
    : []),
  getWorkflowGuides: (context) => (isDeviceDashboardAvailable(context)
    ? getWorkflowGuides()
    : []),
  getSystemPromptLines: (context) => (isDeviceDashboardRoute(context)
    ? i18n.global.t('DashBoard.homeAgent.prompt.system')
    : []),
};

export const registerDeviceDashboardHomeAgentProvider = () => (
  registerHomeAgentCapabilityProvider(deviceDashboardHomeAgentProvider)
);

export default deviceDashboardHomeAgentProvider;
