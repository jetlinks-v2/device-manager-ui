import i18n from '@jetlinks-web-core/locales';
import {
  registerHomeAgentCapabilityProvider,
  type HomeAgentCapabilityContext,
  type HomeAgentCapabilityProvider,
  type HomeAgentWorkflowGuide,
} from '@jetlinks-web-core/layout/components/AiChat/homeAgentCapabilities';
import type { AiClientToolDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientTools';
import { compactHomeAgentCapability } from '@jetlinks-web-core/layout/components/AiChat/homeAgentCatalog';
import { isPrivateDeployment } from '@jetlinks-web-core/utils/deployment';
import { queryProductList } from '../../../api/product';
import {
  createDeviceGuidanceCapabilities,
  DEVICE_ONBOARDING_CAPABILITY_ID,
} from '../../../agentCapabilities/deviceGuidance/homeAgentProvider';

const DEVICE_PRODUCT_MENU_CODE = 'device/Product';
const DEVICE_PRODUCT_DETAIL_ROUTE = 'device/Product/Detail';
const DEVICE_PRODUCT_PATH = '/iot/device/Product';
const DEVICE_PRODUCT_SEARCH_TOOL = 'device_product_search';
const PRODUCT_SEARCH_INPUT_IDS = [
  'keyword', 'idOrName', 'id', 'name', 'state', 'deviceType',
  'classifiedId', 'accessId', 'accessProvider', 'describe', 'limit', 'pageIndex',
];

const normalizeText = (value: unknown) => String(value || '').trim();

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

const enumValue = (value: any) => (value && typeof value === 'object' ? value.value : value);

const enumText = (value: any) => (value && typeof value === 'object' ? value.text : value);

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

const isDeviceProductRoute = (context: HomeAgentCapabilityContext) => (
  context.currentRoute.path === DEVICE_PRODUCT_PATH
  || context.currentRoute.name === DEVICE_PRODUCT_MENU_CODE
  || context.currentView === DEVICE_PRODUCT_MENU_CODE
);

const isDeviceProductAvailable = (context: HomeAgentCapabilityContext) => (
  !!context.findMenu(DEVICE_PRODUCT_MENU_CODE)
  || !!context.findMenu(DEVICE_PRODUCT_PATH)
);

const buildProductSearchFilter = (args: Record<string, any>) => {
  const keyword = firstTextArg(args, 'keyword', 'query');
  const idOrName = firstTextArg(args, 'idOrName', 'productIdOrName', 'product');
  const id = firstTextArg(args, 'id', 'productId');
  const name = firstTextArg(args, 'name', 'productName');
  const onlyUncertainId = id && !name && !keyword && !idOrName && args.strictId !== true;
  const filter: Record<string, any> = {};

  const idOrNameValue = keyword || idOrName || (onlyUncertainId ? id : '');
  if (idOrNameValue) {
    setIdOrNameLikeFilter(filter, idOrNameValue);
  } else {
    setLikeFilterValue(filter, 'id', id);
  }

  setLikeFilterValue(filter, 'name', name);
  setFilterValue(filter, 'state', firstTextArg(args, 'state'));
  setFilterValue(filter, 'deviceType', firstTextArg(args, 'deviceType'));
  setFilterValue(filter, 'classifiedId', firstTextArg(args, 'classifiedId', 'categoryId'));
  setFilterValue(filter, 'accessId', firstTextArg(args, 'accessId', 'gatewayId'));
  setFilterValue(filter, 'accessProvider', firstTextArg(args, 'accessProvider'));
  setLikeFilterValue(filter, 'describe', firstTextArg(args, 'describe', 'description'));

  return filter;
};

const compactProduct = (item: Record<string, any>) => {
  const id = normalizeText(item.id);
  const title = normalizeText(item.name) || id;
  const detailLink = `#route=${encodeURIComponent(DEVICE_PRODUCT_DETAIL_ROUTE)}&menu=${encodeURIComponent(DEVICE_PRODUCT_MENU_CODE)}&id=${encodeURIComponent(id)}`;
  return {
    id,
    name: item.name,
    deviceType: {
      value: enumValue(item.deviceType),
      text: enumText(item.deviceType),
    },
    state: {
      value: enumValue(item.state),
      text: enumText(item.state),
    },
    classifiedId: item.classifiedId,
    accessId: item.accessId,
    accessName: item.accessName,
    accessProvider: item.accessProvider,
    createTime: item.createTime,
    detailRoute: {
      routeName: DEVICE_PRODUCT_DETAIL_ROUTE,
      params: { id },
    },
    detailLink,
    markdownLink: `[${i18n.global.t('Product.homeAgent.detailLink', [title])}](${detailLink})`,
  };
};

const searchProducts = async (args: Record<string, any>, context: HomeAgentCapabilityContext) => {
  if (!isDeviceProductAvailable(context)) {
    return {
      ok: false,
      error: i18n.global.t('Product.homeAgent.tool.search.noPermission'),
    };
  }

  const pageSize = clampPageSize(args.limit ?? args.pageSize);
  const pageIndex = toPageIndex(args.pageIndex);
  const response = await queryProductList({
    paging: true,
    pageIndex,
    pageSize,
    filter: buildProductSearchFilter(args),
  });

  if (response?.success === false) {
    throw new Error(response?.message || 'device product search failed');
  }

  const { list, total } = resolvePagedResult(response);
  return {
    ok: true,
    total,
    pageIndex,
    pageSize,
    menu: {
      code: DEVICE_PRODUCT_MENU_CODE,
      path: DEVICE_PRODUCT_PATH,
      markdownLink: `[${i18n.global.t('Product.homeAgent.menu.deviceProduct')}](#menu=${encodeURIComponent(DEVICE_PRODUCT_MENU_CODE)})`,
    },
    items: list.map(compactProduct),
    summary: i18n.global.t('Product.homeAgent.tool.search.summary', [
      total,
      list.length,
    ]),
    instruction: i18n.global.t('Product.homeAgent.tool.search.instruction'),
  };
};

const getProductPromptExamples = () => [
  i18n.global.t('Product.homeAgent.prompt.searchProduct'),
  i18n.global.t('Product.homeAgent.prompt.findEnabledProduct'),
  i18n.global.t('Product.homeAgent.prompt.ruleProduct'),
];

/** 从已授权功能声明生成入口，沿用统一设备页的受控打开行为，不让模型按标题猜菜单。 */
const getDeviceCreationEntry = (context: HomeAgentCapabilityContext) => {
  const capability = createDeviceGuidanceCapabilities(context)
    .find(item => item.id === DEVICE_ONBOARDING_CAPABILITY_ID);
  return capability ? compactHomeAgentCapability(capability) : undefined;
};

/** 私有化产品按当前表单与详情流程引导，设备创建步骤只对可访问设备列表的账号提供。 */
const getPrivateProductCreationGuides = (context: HomeAgentCapabilityContext): HomeAgentWorkflowGuide[] => {
  // SaaS 产品可能来自设备库模板，不能复用私有化手工创建步骤。
  if (!isPrivateDeployment()) {
    return [];
  }

  const deviceEntry = getDeviceCreationEntry(context);

  return [{
    id: 'device-product:create-private-product',
    name: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.name'),
    description: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.description'),
    when: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.when'),
    keywords: ['创建产品', '新增产品', '物模型', '新增属性', '首台设备', 'create product', 'thing model', 'MQTT'],
    priority: 100,
    steps: [
      {
        title: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.step.basic.title'),
        description: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.step.basic.description', [
          i18n.global.t('Save.index.912481-11'),
        ]),
      },
      {
        title: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.step.access.title'),
        description: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.step.access.description'),
      },
      {
        title: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.step.metadata.title'),
        description: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.step.metadata.description'),
      },
      ...(deviceEntry ? [{
        title: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.step.device.title'),
        description: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.step.device.description', [
          deviceEntry.markdownLink,
        ]),
      }] : []),
    ],
    output: i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.output'),
    notes: [
      i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.notes'),
      ...(!deviceEntry ? [i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.noDeviceMenu')] : []),
    ],
  }];
};

/** 将页面事实随每次请求发送，避免仅有入口说明时模型自行补全不存在的字段或按钮。 */
const getProductSystemPromptLines = (context: HomeAgentCapabilityContext) => {
  if (!isDeviceProductAvailable(context)) {
    return [];
  }

  const lines = [i18n.global.t('Product.homeAgent.prompt.globalSystem')];
  if (isPrivateDeployment()) {
    lines.push(i18n.global.t('Product.homeAgent.prompt.privateCreation', [
      i18n.global.t('Save.index.912481-11'),
      i18n.global.t('Save.index.912481-13'),
      i18n.global.t('Save.index.912481-15'),
    ]));
    const deviceEntry = getDeviceCreationEntry(context);
    lines.push(deviceEntry
      ? i18n.global.t('Product.homeAgent.prompt.privateDeviceEntry', [deviceEntry.markdownLink])
      : i18n.global.t('Product.homeAgent.workflow.createPrivateProduct.noDeviceMenu'));
  }
  return lines;
};

const getProductWorkflowGuides = (): HomeAgentWorkflowGuide[] => [
  {
    id: 'device-product:resolve-product-id',
    name: i18n.global.t('Product.homeAgent.workflow.resolveProduct.name'),
    description: i18n.global.t('Product.homeAgent.workflow.resolveProduct.description'),
    when: i18n.global.t('Product.homeAgent.workflow.resolveProduct.when'),
    scenarios: [
      i18n.global.t('Product.homeAgent.workflow.resolveProduct.scenario.ruleFilter'),
      i18n.global.t('Product.homeAgent.workflow.resolveProduct.scenario.productContext'),
    ],
    keywords: ['product', 'product id', 'rule', 'subscription', '产品', '产品ID', '规则', '订阅'],
    priority: 95,
    steps: [
      {
        title: i18n.global.t('Product.homeAgent.workflow.resolveProduct.step.extract.title'),
        description: i18n.global.t('Product.homeAgent.workflow.resolveProduct.step.extract.description'),
        required: true,
      },
      {
        title: i18n.global.t('Product.homeAgent.workflow.resolveProduct.step.search.title'),
        description: i18n.global.t('Product.homeAgent.workflow.resolveProduct.step.search.description'),
        tools: [DEVICE_PRODUCT_SEARCH_TOOL],
        inputs: { keyword: 'product-id-or-name-clue', limit: 5 },
        required: true,
      },
      {
        title: i18n.global.t('Product.homeAgent.workflow.resolveProduct.step.apply.title'),
        description: i18n.global.t('Product.homeAgent.workflow.resolveProduct.step.apply.description'),
        required: true,
      },
    ],
    output: i18n.global.t('Product.homeAgent.workflow.resolveProduct.output'),
    notes: i18n.global.t('Product.homeAgent.workflow.resolveProduct.notes'),
  },
];

const createProductTools = (): AiClientToolDefinition<HomeAgentCapabilityContext>[] => ([
  {
    id: DEVICE_PRODUCT_SEARCH_TOOL,
    name: DEVICE_PRODUCT_SEARCH_TOOL,
    displayName: i18n.global.t('Product.homeAgent.tool.search.displayName'),
    progressText: i18n.global.t('Product.homeAgent.tool.search.progressText'),
    description: i18n.global.t('Product.homeAgent.tool.search.description'),
    help: i18n.global.t('Product.homeAgent.tool.search.help'),
    inputs: PRODUCT_SEARCH_INPUT_IDS.map((id) => ({
      id,
      name: id,
      description: i18n.global.t(`Product.homeAgent.tool.search.${id}`),
      required: false,
      valueType: ['limit', 'pageIndex'].includes(id) ? 'int' : 'string',
    })),
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: searchProducts,
  },
]);

const createProductCapabilities = (context: HomeAgentCapabilityContext) => {
  const currentRoute = isDeviceProductRoute(context);
  return [
    {
      id: 'device-product:search',
      name: i18n.global.t('Product.homeAgent.capability.search.name'),
      description: i18n.global.t('Product.homeAgent.capability.search.description'),
      kind: 'tool' as const,
      category: 'device-product',
      menuCode: DEVICE_PRODUCT_MENU_CODE,
      routeName: DEVICE_PRODUCT_MENU_CODE,
      path: DEVICE_PRODUCT_PATH,
      order: 10,
      keywords: ['product', 'device product', 'search', '产品', '设备产品', '搜索'],
      metadata: {
        currentRoute,
        promptExamples: currentRoute ? getProductPromptExamples() : undefined,
      },
    },
  ];
};

export const deviceProductHomeAgentProvider: HomeAgentCapabilityProvider = {
  id: 'device-product',
  order: 80,
  getCapabilities: (context) => (isDeviceProductAvailable(context) ? createProductCapabilities(context) : []),
  getClientTools: (context) => (isDeviceProductAvailable(context) ? createProductTools() : []),
  getPromptExamples: (context) => (isDeviceProductRoute(context) ? getProductPromptExamples() : []),
  getWorkflowGuides: (context) => (isDeviceProductAvailable(context)
    ? [...getPrivateProductCreationGuides(context), ...getProductWorkflowGuides()]
    : []),
  getSystemPromptLines: getProductSystemPromptLines,
};

export const registerDeviceProductHomeAgentProvider = () => (
  registerHomeAgentCapabilityProvider(deviceProductHomeAgentProvider)
);

export default deviceProductHomeAgentProvider;
