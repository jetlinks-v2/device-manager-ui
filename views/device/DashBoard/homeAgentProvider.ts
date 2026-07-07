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
  dashboard,
  deviceCount,
  productCount,
} from '../../../api/dashboard';

const DEVICE_DASHBOARD_MENU_CODE = 'device/DashBoard';
const DEVICE_DASHBOARD_PATH = '/iot/device/DashBoard';
const DEVICE_DASHBOARD_OVERVIEW_TOOL = 'device_dashboard_get_overview';
const DEVICE_DASHBOARD_PRODUCT_STATS_TOOL = 'device_dashboard_get_product_stats';
const DEVICE_DASHBOARD_DEVICE_STATS_TOOL = 'device_dashboard_get_device_stats';
const DEVICE_DASHBOARD_ONLINE_TREND_TOOL = 'device_dashboard_get_online_trend';
const DEVICE_DASHBOARD_MESSAGE_AGGREGATION_TOOL = 'device_dashboard_analyze_message_aggregation';

const isDeviceDashboardRoute = (context: HomeAgentCapabilityContext) => (
  context.currentRoute.path === DEVICE_DASHBOARD_PATH
  || context.currentRoute.name === DEVICE_DASHBOARD_MENU_CODE
  || context.currentView === DEVICE_DASHBOARD_MENU_CODE
);

const isDeviceDashboardAvailable = (context: HomeAgentCapabilityContext) => (
  !!context.findMenu(DEVICE_DASHBOARD_MENU_CODE)
  || !!context.findMenu(DEVICE_DASHBOARD_PATH)
);

const getPromptExamples = () => [
  i18n.global.t('DashBoard.homeAgent.prompt.deviceStatus'),
  i18n.global.t('DashBoard.homeAgent.prompt.messageAggregation'),
  i18n.global.t('DashBoard.homeAgent.prompt.messagePeak'),
  i18n.global.t('DashBoard.homeAgent.prompt.overview'),
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
        inputs: { shortcut: 'today|day|week|month', from: 'optional-start-time', to: 'optional-end-time' },
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

const getCurrentDayRange = () => ({
  from: dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  to: dayjs().format('YYYY-MM-DD HH:mm:ss'),
});

const getYesterdayRange = () => ({
  from: dayjs().subtract(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  to: dayjs().subtract(1, 'day').endOf('day').format('YYYY-MM-DD HH:mm:ss'),
});

const normalizeRangeShortcut = (value: unknown) => String(value || 'today').trim().toLowerCase();

const isShortcutIn = (shortcut: string, candidates: string[]) => candidates.includes(shortcut);

const toPlainRecord = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
);

const resolveDashboardTimeRange = (args: Record<string, any> = {}) => {
  const timeRangeRecord = toPlainRecord(args.timeRange);
  const nestedRange = Object.keys(timeRangeRecord).length ? timeRangeRecord : toPlainRecord(args.range);
  const from = args.from ?? args.start ?? args.startTime ?? nestedRange.from ?? nestedRange.start ?? nestedRange.startTime;
  const to = args.to ?? args.end ?? args.endTime ?? nestedRange.to ?? nestedRange.end ?? nestedRange.endTime;
  // Different models may pass shortcut as a flat field or as a nested timeRange object.
  const shortcut = normalizeRangeShortcut(
    args.shortcut
    || nestedRange.shortcut
    || nestedRange.value
    || nestedRange.type
    || args.timeRange
    || args.range,
  );
  const now = dayjs();
  if (from && to) {
    const startMs = dayjs(from).valueOf();
    const endMs = dayjs(to).valueOf();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
      throw new Error(i18n.global.t('DashBoard.homeAgent.tool.timeRange.invalidRange'));
    }
    return {
      from,
      to,
      label: 'custom',
      startMs,
      endMs,
    };
  }
  if (isShortcutIn(shortcut, ['day', '24h', 'last24h', 'last_24h', '最近24小时', '近24小时'])) {
    const start = now.subtract(24, 'hour');
    return {
      from: start.valueOf(),
      to: now.valueOf(),
      label: 'day',
      startMs: start.valueOf(),
      endMs: now.valueOf(),
    };
  }
  if (isShortcutIn(shortcut, ['week', '7d', 'last7d', 'last_7d', '最近7天', '近7天', '近一周'])) {
    const start = now.subtract(6, 'day').startOf('day');
    return {
      from: start.valueOf(),
      to: now.valueOf(),
      label: 'week',
      startMs: start.valueOf(),
      endMs: now.valueOf(),
    };
  }
  if (isShortcutIn(shortcut, ['month', '30d', 'last30d', 'last_30d', '最近30天', '近30天', '近一个月'])) {
    const start = now.subtract(30, 'day').startOf('day');
    return {
      from: start.valueOf(),
      to: now.valueOf(),
      label: 'month',
      startMs: start.valueOf(),
      endMs: now.valueOf(),
    };
  }
  const currentRange = getCurrentDayRange();
  return {
    ...currentRange,
    label: 'today',
    startMs: dayjs(currentRange.from).valueOf(),
    endMs: dayjs(currentRange.to).valueOf(),
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
    return { time: '1m', format: 'HH:mm', limit: 60 };
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
    .map((item) => ({
      time: item?.data?.timeString,
      value: toNumber(item?.data?.value),
    }))
    .reverse();
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

const createDeviceDashboardTools = (): AiClientToolDefinition<HomeAgentCapabilityContext>[] => ([
  {
    id: DEVICE_DASHBOARD_OVERVIEW_TOOL,
    name: DEVICE_DASHBOARD_OVERVIEW_TOOL,
    displayName: i18n.global.t('DashBoard.homeAgent.tool.overview.displayName'),
    progressText: i18n.global.t('DashBoard.homeAgent.tool.overview.progressText'),
    description: i18n.global.t('DashBoard.homeAgent.tool.overview.description'),
    help: i18n.global.t('DashBoard.homeAgent.tool.overview.help'),
    inputs: [],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: getDashboardOverview,
  },
  {
    id: DEVICE_DASHBOARD_PRODUCT_STATS_TOOL,
    name: DEVICE_DASHBOARD_PRODUCT_STATS_TOOL,
    displayName: i18n.global.t('DashBoard.homeAgent.tool.productStats.displayName'),
    progressText: i18n.global.t('DashBoard.homeAgent.tool.productStats.progressText'),
    description: i18n.global.t('DashBoard.homeAgent.tool.productStats.description'),
    help: i18n.global.t('DashBoard.homeAgent.tool.productStats.help'),
    inputs: [],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      ok: true,
      product: await getProductStats(),
    }),
  },
  {
    id: DEVICE_DASHBOARD_DEVICE_STATS_TOOL,
    name: DEVICE_DASHBOARD_DEVICE_STATS_TOOL,
    displayName: i18n.global.t('DashBoard.homeAgent.tool.deviceStats.displayName'),
    progressText: i18n.global.t('DashBoard.homeAgent.tool.deviceStats.progressText'),
    description: i18n.global.t('DashBoard.homeAgent.tool.deviceStats.description'),
    help: i18n.global.t('DashBoard.homeAgent.tool.deviceStats.help'),
    inputs: [],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      ok: true,
      device: await getDeviceStats(),
    }),
  },
  {
    id: DEVICE_DASHBOARD_ONLINE_TREND_TOOL,
    name: DEVICE_DASHBOARD_ONLINE_TREND_TOOL,
    displayName: i18n.global.t('DashBoard.homeAgent.tool.onlineTrend.displayName'),
    progressText: i18n.global.t('DashBoard.homeAgent.tool.onlineTrend.progressText'),
    description: i18n.global.t('DashBoard.homeAgent.tool.onlineTrend.description'),
    help: i18n.global.t('DashBoard.homeAgent.tool.onlineTrend.help'),
    inputs: [
      {
        id: 'shortcut',
        name: 'shortcut',
        description: i18n.global.t('DashBoard.homeAgent.tool.timeRange.shortcut'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'from',
        name: 'from',
        description: i18n.global.t('DashBoard.homeAgent.tool.timeRange.from'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'to',
        name: 'to',
        description: i18n.global.t('DashBoard.homeAgent.tool.timeRange.to'),
        required: false,
        valueType: 'string',
      },
    ],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: queryOnlineTrend,
  },
  {
    id: DEVICE_DASHBOARD_MESSAGE_AGGREGATION_TOOL,
    name: DEVICE_DASHBOARD_MESSAGE_AGGREGATION_TOOL,
    displayName: i18n.global.t('DashBoard.homeAgent.tool.messageAggregation.displayName'),
    progressText: i18n.global.t('DashBoard.homeAgent.tool.messageAggregation.progressText'),
    description: i18n.global.t('DashBoard.homeAgent.tool.messageAggregation.description'),
    help: i18n.global.t('DashBoard.homeAgent.tool.messageAggregation.help'),
    inputs: [
      {
        id: 'shortcut',
        name: 'shortcut',
        description: i18n.global.t('DashBoard.homeAgent.tool.timeRange.shortcut'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'from',
        name: 'from',
        description: i18n.global.t('DashBoard.homeAgent.tool.timeRange.from'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'to',
        name: 'to',
        description: i18n.global.t('DashBoard.homeAgent.tool.timeRange.to'),
        required: false,
        valueType: 'string',
      },
    ],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: analyzeMessageAggregation,
  },
]);

const createDeviceDashboardCapabilities = (context: HomeAgentCapabilityContext) => {
  const currentRoute = isDeviceDashboardRoute(context);
  const base = {
    category: 'device-dashboard',
    menuCode: DEVICE_DASHBOARD_MENU_CODE,
    routeName: DEVICE_DASHBOARD_MENU_CODE,
    path: DEVICE_DASHBOARD_PATH,
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
        promptExamples: getPromptExamples(),
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
  ];
};

export const deviceDashboardHomeAgentProvider: HomeAgentCapabilityProvider = {
  id: 'device-dashboard',
  order: 100,
  getCapabilities: (context) => (isDeviceDashboardAvailable(context)
    ? createDeviceDashboardCapabilities(context)
    : []),
  getClientTools: (context) => (isDeviceDashboardAvailable(context) ? createDeviceDashboardTools() : []),
  getPromptExamples: (context) => (isDeviceDashboardRoute(context)
    ? getPromptExamples()
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
