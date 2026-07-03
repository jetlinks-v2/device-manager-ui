import i18n from '@jetlinks-web-core/locales';
import {
  registerHomeAgentCapabilityProvider,
  type HomeAgentCapabilityContext,
  type HomeAgentCapabilityProvider,
} from '@jetlinks-web-core/layout/components/AiChat/homeAgentCapabilities';
import type { AiClientToolDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientTools';
import { getOrgList, query } from '../../../api/instance';

const DEVICE_INSTANCE_MENU_CODE = 'device/Instance';
const DEVICE_INSTANCE_DETAIL_ROUTE = 'device/Instance/Detail';
const DEVICE_INSTANCE_PATH = '/iot/device/Instance';
const DEVICE_INSTANCE_SEARCH_TOOL = 'device_instance_search';

const normalizeText = (value: unknown) => String(value || '').trim();
const normalizeComparableText = (value: unknown) => normalizeText(value).toLowerCase();

const firstTextArg = (args: Record<string, any>, ...keys: string[]) => {
  for (const key of keys) {
    const text = normalizeText(args[key]);
    if (text) {
      return text;
    }
  }
  return '';
};

const clampPageSize = (value: unknown) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return 10;
  }
  return Math.min(20, Math.max(1, Math.floor(numberValue)));
};

const toPageIndex = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, Math.floor(numberValue)) : 0;
};

const isDeviceInstanceRoute = (context: HomeAgentCapabilityContext) => (
  context.currentRoute.path === DEVICE_INSTANCE_PATH
  || context.currentRoute.name === DEVICE_INSTANCE_MENU_CODE
  || context.currentView === DEVICE_INSTANCE_MENU_CODE
);

const isDeviceInstanceAvailable = (context: HomeAgentCapabilityContext) => (
  !!context.findMenu(DEVICE_INSTANCE_MENU_CODE)
  || !!context.findMenu(DEVICE_INSTANCE_PATH)
);

const getPromptExamples = () => [
  i18n.global.t('Instance.homeAgent.prompt.searchDevice'),
  i18n.global.t('Instance.homeAgent.prompt.onlineDevices'),
  i18n.global.t('Instance.homeAgent.prompt.findByProduct'),
];

const getSpecificDeviceWorkflowGuides = () => [
  {
    id: 'device-instance:specific-device-routing',
    name: i18n.global.t('Instance.homeAgent.workflow.specificDevice.name'),
    description: i18n.global.t('Instance.homeAgent.workflow.specificDevice.description'),
    when: i18n.global.t('Instance.homeAgent.workflow.specificDevice.when'),
    scenarios: [
      i18n.global.t('Instance.homeAgent.workflow.specificDevice.scenario.deviceContext'),
      i18n.global.t('Instance.homeAgent.workflow.specificDevice.scenario.noActiveSubject'),
    ],
    keywords: ['device', 'device instance', '设备', '设备实例'],
    priority: 100,
    steps: [
      {
        title: i18n.global.t('Instance.homeAgent.workflow.specificDevice.step.extract.title'),
        description: i18n.global.t('Instance.homeAgent.workflow.specificDevice.step.extract.description'),
        required: true,
      },
      {
        title: i18n.global.t('Instance.homeAgent.workflow.specificDevice.step.search.title'),
        description: i18n.global.t('Instance.homeAgent.workflow.specificDevice.step.search.description'),
        tools: [DEVICE_INSTANCE_SEARCH_TOOL],
        inputs: {
          keyword: 'device-id-or-name-clue',
          organizationName: 'optional-organization-clue',
          limit: 5,
        },
        required: true,
      },
      {
        title: i18n.global.t('Instance.homeAgent.workflow.specificDevice.step.resolve.title'),
        description: i18n.global.t('Instance.homeAgent.workflow.specificDevice.step.resolve.description'),
        required: true,
      },
      {
        title: i18n.global.t('Instance.homeAgent.workflow.specificDevice.step.handoff.title'),
        description: i18n.global.t('Instance.homeAgent.workflow.specificDevice.step.handoff.description'),
        required: true,
      },
    ],
    output: i18n.global.t('Instance.homeAgent.workflow.specificDevice.output'),
    notes: i18n.global.t('Instance.homeAgent.workflow.specificDevice.notes'),
  },
];

const resolvePagedResult = (response: any) => {
  const result = response?.result ?? response?.data ?? response ?? {};
  const data = result?.data ?? result?.records ?? result?.result ?? (Array.isArray(result) ? result : []);
  const list = Array.isArray(data) ? data : [];
  const total = Number(result?.total ?? result?.count ?? list.length);
  return {
    list,
    total: Number.isFinite(total) ? total : list.length,
  };
};

const enumValue = (value: any) => (
  value && typeof value === 'object' ? value.value : value
);

const enumText = (value: any) => (
  value && typeof value === 'object' ? value.text : value
);

const likeValue = (value: unknown) => {
  const text = normalizeText(value);
  if (!text) {
    return '';
  }
  return text.includes('%') ? text : `%${text}%`;
};

const setFilterValue = (filter: Record<string, any>, key: string, value: unknown) => {
  const text = normalizeText(value);
  if (text) {
    filter[key] = text;
  }
};

const setLikeFilterValue = (filter: Record<string, any>, key: string, value: unknown) => {
  const text = likeValue(value);
  if (text) {
    filter[`${key}$like`] = text;
  }
};

const setIdOrNameLikeFilter = (filter: Record<string, any>, value: unknown) => {
  const text = likeValue(value);
  if (text) {
    filter['id$like'] = text;
    filter['$or$name$like'] = text;
  }
};

const productInfoFilterValue = (args: Record<string, any>) => {
  const filters = [
    ['classifiedId', firstTextArg(args, 'classifiedId', 'categoryId')],
    ['accessId', firstTextArg(args, 'accessId', 'gatewayId')],
    ['accessProvider', firstTextArg(args, 'accessProvider')],
  ]
    .map(([column, value]) => {
      const text = normalizeText(value);
      return text ? { column, termType: 'eq', value: text } : undefined;
    })
    .filter(Boolean);
  return filters.length ? filters : undefined;
};

const organizationAssetFilter = (organizationIds: string[]) => {
  const ids = organizationIds.map(normalizeText).filter(Boolean);
  return ids.length ? {
    'id$dim-assets': JSON.stringify({
      assetType: 'device',
      targets: ids.map((id) => ({ type: 'org', id })),
    }),
  } : {};
};

const buildSearchFilter = (args: Record<string, any>, relationFilter: Record<string, any> = {}) => {
  const keyword = firstTextArg(args, 'keyword', 'query');
  const idOrName = firstTextArg(args, 'idOrName', 'deviceIdOrName', 'device');
  const id = firstTextArg(args, 'id', 'deviceId');
  const name = firstTextArg(args, 'name', 'deviceName');
  const onlyUncertainId = id && !name && !keyword && !idOrName && args.strictId !== true;

  const filter: Record<string, any> = {};
  const idOrNameValue = keyword || idOrName || (onlyUncertainId ? id : '');
  if (idOrNameValue) {
    // QueryParamEntity.filter avoids hand-built terms in the client tool.
    setIdOrNameLikeFilter(filter, idOrNameValue);
  } else {
    setLikeFilterValue(filter, 'id', id);
  }

  setLikeFilterValue(filter, 'name', name);
  setLikeFilterValue(filter, 'productName', firstTextArg(args, 'productName'));
  setFilterValue(filter, 'productId', firstTextArg(args, 'productId'));
  setFilterValue(filter, 'state', firstTextArg(args, 'state'));
  setFilterValue(filter, 'deviceType', firstTextArg(args, 'deviceType'));
  setLikeFilterValue(filter, 'describe', firstTextArg(args, 'describe', 'description'));

  const productInfo = productInfoFilterValue(args);
  if (productInfo) {
    filter['productId$product-info'] = productInfo;
  }

  // Keep extra AND filters after the id/name OR pair; the backend parser preserves map order.
  Object.assign(filter, relationFilter);

  return filter;
};

const isOrganizationFilterAvailable = (context: HomeAgentCapabilityContext) => (
  !!context.findMenu('system/Department')
);

const compactOrganization = (item: Record<string, any>) => ({
  id: normalizeText(item.id),
  name: normalizeText(item.name),
  code: normalizeText(item.code),
});

const searchOrganizations = async (keyword: string) => {
  const response = await getOrgList({
    paging: false,
    filter: {
      'id$like': likeValue(keyword),
      '$or$name$like': likeValue(keyword),
    },
  });

  if (response?.success === false) {
    throw new Error(response?.message || 'organization search failed');
  }

  return resolvePagedResult(response)
    .list
    .map(compactOrganization)
    .filter((item) => item.id);
};

const resolveOrganizationFilter = async (args: Record<string, any>, context: HomeAgentCapabilityContext) => {
  const organizationId = firstTextArg(args, 'organizationId', 'orgId');
  const organizationName = firstTextArg(args, 'organizationName', 'orgName');
  const organizationKeyword = firstTextArg(args, 'organizationKeyword', 'orgKeyword');
  const keyword = organizationKeyword || organizationName || organizationId;

  if (!keyword) {
    return {
      filter: {},
      candidates: [],
      selected: [],
    };
  }

  if (!isOrganizationFilterAvailable(context)) {
    return {
      filter: {},
      candidates: [],
      selected: [],
      error: i18n.global.t('Instance.homeAgent.tool.search.organizationNoPermission'),
    };
  }

  if (organizationId && !organizationName && !organizationKeyword) {
    const selected = [{ id: organizationId, name: '', code: '' }];
    return {
      filter: organizationAssetFilter([organizationId]),
      candidates: selected,
      selected,
    };
  }

  const candidates = await searchOrganizations(keyword);
  if (!candidates.length) {
    return {
      filter: {},
      candidates: [],
      selected: [],
      notFound: true,
    };
  }

  const comparableId = normalizeComparableText(organizationId);
  const comparableName = normalizeComparableText(organizationName || organizationKeyword);
  const exactMatches = candidates.filter((item) => (
    (!!comparableId && normalizeComparableText(item.id) === comparableId)
    || (!!comparableName && normalizeComparableText(item.name) === comparableName)
    || (!!comparableName && normalizeComparableText(item.code) === comparableName)
  ));
  const selected = exactMatches.length
    ? exactMatches
    : (candidates.length === 1 ? candidates : []);

  if (!selected.length) {
    return {
      filter: {},
      candidates,
      selected: [],
      needsSelection: true,
    };
  }

  return {
    filter: organizationAssetFilter(selected.map((item) => item.id)),
    candidates,
    selected,
  };
};

const compactDevice = (item: Record<string, any>) => {
  const id = normalizeText(item.id);
  const title = normalizeText(item.name) || id;
  const detailLink = `#route=${encodeURIComponent(DEVICE_INSTANCE_DETAIL_ROUTE)}&menu=${encodeURIComponent(DEVICE_INSTANCE_MENU_CODE)}&id=${encodeURIComponent(id)}`;
  return {
    id,
    name: item.name,
    productId: item.productId,
    productName: item.productName,
    deviceType: {
      value: enumValue(item.deviceType),
      text: enumText(item.deviceType),
    },
    state: {
      value: enumValue(item.state),
      text: enumText(item.state),
    },
    accessProvider: item.accessProvider,
    createTime: item.createTime,
    detailRoute: {
      routeName: DEVICE_INSTANCE_DETAIL_ROUTE,
      params: { id },
    },
    detailLink,
    markdownLink: `[${i18n.global.t('Instance.homeAgent.detailLink', [title])}](${detailLink})`,
  };
};

const searchDevices = async (args: Record<string, any>, context: HomeAgentCapabilityContext) => {
  if (!isDeviceInstanceAvailable(context)) {
    return {
      ok: false,
      error: i18n.global.t('Instance.homeAgent.tool.search.noPermission'),
    };
  }

  const organizationFilter = await resolveOrganizationFilter(args, context);
  if (organizationFilter.error) {
    return {
      ok: false,
      error: organizationFilter.error,
    };
  }
  if (organizationFilter.notFound) {
    return {
      ok: true,
      total: 0,
      pageIndex: 0,
      pageSize: clampPageSize(args.limit ?? args.pageSize),
      items: [],
      organizationCandidates: [],
      summary: i18n.global.t('Instance.homeAgent.tool.search.organizationNotFound'),
      instruction: i18n.global.t('Instance.homeAgent.tool.search.organizationInstruction'),
    };
  }
  if (organizationFilter.needsSelection) {
    return {
      ok: true,
      total: 0,
      pageIndex: 0,
      pageSize: clampPageSize(args.limit ?? args.pageSize),
      items: [],
      organizationCandidates: organizationFilter.candidates,
      needsOrganizationSelection: true,
      summary: i18n.global.t('Instance.homeAgent.tool.search.organizationNeedSelection', [
        organizationFilter.candidates.length,
      ]),
      instruction: i18n.global.t('Instance.homeAgent.tool.search.organizationInstruction'),
    };
  }

  const pageSize = clampPageSize(args.limit ?? args.pageSize);
  const pageIndex = toPageIndex(args.pageIndex);
  const response = await query({
    paging: true,
    pageIndex,
    pageSize,
    filter: buildSearchFilter(args, organizationFilter.filter),
  });

  if (response?.success === false) {
    throw new Error(response?.message || 'device instance search failed');
  }

  const { list, total } = resolvePagedResult(response);
  return {
    ok: true,
    total,
    pageIndex,
    pageSize,
    menu: {
      code: DEVICE_INSTANCE_MENU_CODE,
      path: DEVICE_INSTANCE_PATH,
      markdownLink: `[${i18n.global.t('Instance.homeAgent.menu.deviceInstance')}](#menu=${encodeURIComponent(DEVICE_INSTANCE_MENU_CODE)})`,
    },
    organizationCandidates: organizationFilter.candidates,
    selectedOrganizations: organizationFilter.selected,
    items: list.map(compactDevice),
    summary: i18n.global.t('Instance.homeAgent.tool.search.summary', [
      total,
      list.length,
    ]),
    instruction: i18n.global.t('Instance.homeAgent.tool.search.linkInstruction'),
  };
};

const createDeviceInstanceTools = (): AiClientToolDefinition<HomeAgentCapabilityContext>[] => ([
  {
    id: DEVICE_INSTANCE_SEARCH_TOOL,
    name: DEVICE_INSTANCE_SEARCH_TOOL,
    description: i18n.global.t('Instance.homeAgent.tool.search.description'),
    help: i18n.global.t('Instance.homeAgent.tool.search.help'),
    inputs: [
      {
        id: 'keyword',
        name: 'keyword',
        description: i18n.global.t('Instance.homeAgent.tool.search.keyword'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'idOrName',
        name: 'idOrName',
        description: i18n.global.t('Instance.homeAgent.tool.search.idOrName'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'id',
        name: 'id',
        description: i18n.global.t('Instance.homeAgent.tool.search.id'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'name',
        name: 'name',
        description: i18n.global.t('Instance.homeAgent.tool.search.name'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'productId',
        name: 'productId',
        description: i18n.global.t('Instance.homeAgent.tool.search.productId'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'productName',
        name: 'productName',
        description: i18n.global.t('Instance.homeAgent.tool.search.productName'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'state',
        name: 'state',
        description: i18n.global.t('Instance.homeAgent.tool.search.state'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'deviceType',
        name: 'deviceType',
        description: i18n.global.t('Instance.homeAgent.tool.search.deviceType'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'classifiedId',
        name: 'classifiedId',
        description: i18n.global.t('Instance.homeAgent.tool.search.classifiedId'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'accessId',
        name: 'accessId',
        description: i18n.global.t('Instance.homeAgent.tool.search.accessId'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'accessProvider',
        name: 'accessProvider',
        description: i18n.global.t('Instance.homeAgent.tool.search.accessProvider'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'describe',
        name: 'describe',
        description: i18n.global.t('Instance.homeAgent.tool.search.describe'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'organizationId',
        name: 'organizationId',
        description: i18n.global.t('Instance.homeAgent.tool.search.organizationId'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'organizationName',
        name: 'organizationName',
        description: i18n.global.t('Instance.homeAgent.tool.search.organizationName'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'organizationKeyword',
        name: 'organizationKeyword',
        description: i18n.global.t('Instance.homeAgent.tool.search.organizationKeyword'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'limit',
        name: 'limit',
        description: i18n.global.t('Instance.homeAgent.tool.search.limit'),
        required: false,
        valueType: 'int',
      },
      {
        id: 'pageIndex',
        name: 'pageIndex',
        description: i18n.global.t('Instance.homeAgent.tool.search.pageIndex'),
        required: false,
        valueType: 'int',
      },
    ],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: searchDevices,
  },
]);

const createDeviceInstanceCapabilities = (context: HomeAgentCapabilityContext) => {
  const currentRoute = isDeviceInstanceRoute(context);
  return [
    {
      id: 'device-instance:search',
      name: i18n.global.t('Instance.homeAgent.capability.search.name'),
      description: i18n.global.t('Instance.homeAgent.capability.search.description'),
      kind: 'tool' as const,
      category: 'device-instance',
      menuCode: DEVICE_INSTANCE_MENU_CODE,
      routeName: DEVICE_INSTANCE_MENU_CODE,
      path: DEVICE_INSTANCE_PATH,
      order: 20,
      keywords: ['device', 'instance', 'search', '设备', '实例', '搜索'],
      metadata: {
        currentRoute,
        promptExamples: getPromptExamples(),
      },
    },
  ];
};

export const deviceInstanceHomeAgentProvider: HomeAgentCapabilityProvider = {
  id: 'device-instance',
  order: 90,
  getCapabilities: (context) => (isDeviceInstanceAvailable(context)
    ? createDeviceInstanceCapabilities(context)
    : []),
  getClientTools: (context) => (isDeviceInstanceAvailable(context) ? createDeviceInstanceTools() : []),
  getPromptExamples: (context) => (isDeviceInstanceRoute(context)
    ? getPromptExamples()
    : []),
  getWorkflowGuides: (context) => (isDeviceInstanceAvailable(context)
    ? getSpecificDeviceWorkflowGuides()
    : []),
  getSystemPromptLines: (context) => {
    if (isDeviceInstanceRoute(context)) {
      return i18n.global.t('Instance.homeAgent.prompt.system');
    }
    return isDeviceInstanceAvailable(context)
      ? i18n.global.t('Instance.homeAgent.prompt.globalSystem')
      : [];
  },
};

export const registerDeviceInstanceHomeAgentProvider = () => (
  registerHomeAgentCapabilityProvider(deviceInstanceHomeAgentProvider)
);

export default deviceInstanceHomeAgentProvider;
