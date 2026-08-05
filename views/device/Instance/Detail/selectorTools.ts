import { query as queryDeviceInstance } from '../../../../api/instance';
import { aiClientToolRegistry } from '@jetlinks-web-core/layout/components/AiChat/clientToolRegistry';
import type { AiClientToolDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientTools';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

const DEVICE_DETAIL_SELECTOR_SCOPE = 'device-detail-selectors';

const responseResult = (response: any) => response?.result ?? response?.data ?? response;

const normalizePagedList = (response: any) => {
  const result = responseResult(response) || {};
  const list = result.data || result.records || result.result || (Array.isArray(result) ? result : []);
  return {
    data: Array.isArray(list) ? list : [],
    total: Number(result.total ?? result.count ?? (Array.isArray(list) ? list.length : 0)),
  };
};

const enumValue = (value: any) => {
  if (value && typeof value === 'object') {
    return value.value ?? value.id ?? value.key ?? value.text ?? value.name;
  }
  return value;
};

const enumText = (value: any) => {
  if (value && typeof value === 'object') {
    return value.text ?? value.name ?? value.label ?? value.value ?? value.id;
  }
  return value;
};

const clampNumber = (value: unknown, min: number, max: number, defaultValue: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.min(max, Math.max(min, n));
};

const normalizeDeviceState = (value: unknown) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return undefined;
  return ({
    online: 'online',
    '在线': 'online',
    '上线': 'online',
    offline: 'offline',
    '离线': 'offline',
    '下线': 'offline',
    disabled: 'notActive',
    inactive: 'notActive',
    notactive: 'notActive',
    '禁用': 'notActive',
    '未激活': 'notActive',
  } as Record<string, string>)[raw] || raw;
};

const buildDeviceSelectorTerms = (args: Record<string, any>) => {
  const keyword = String(args.keyword || args.name || '').trim();
  const productId = String(args.productId || '').trim();
  const productName = String(args.productName || '').trim();
  const state = normalizeDeviceState(args.state);
  const terms: any[] = [];

  if (keyword) {
    terms.push({
      type: 'or',
      terms: [
        { column: 'id', termType: 'like', value: keyword },
        { column: 'name', termType: 'like', value: keyword },
        { column: 'productName', termType: 'like', value: keyword },
      ],
    });
  }

  if (productId) {
    terms.push({ column: 'productId', termType: 'eq', value: productId });
  }
  if (productName) {
    terms.push({ column: 'productName', termType: 'like', value: productName });
  }
  if (state) {
    terms.push({ column: 'state', termType: 'eq', value: state });
  }

  return terms;
};

const normalizeDeviceCandidate = (item: Record<string, any>) => ({
  id: item.id,
  name: item.name,
  productId: item.productId,
  productName: item.productName,
  state: {
    value: enumValue(item.state),
    text: enumText(item.state),
  },
  deviceType: item.deviceType,
  accessProvider: item.accessProvider,
  registryTime: item.registryTime,
  createTime: item.createTime,
});

const createDeviceSelectorTool = (t: TranslateFn): AiClientToolDefinition => ({
  id: 'device_selector_query',
  name: 'device_selector_query',
  description: t('DeviceDetail.agentTools.deviceSelector.description'),
  inputs: [
    {
      id: 'keyword',
      name: 'keyword',
      description: t('DeviceDetail.agentTools.deviceSelector.inputs.keyword'),
      required: false,
      valueType: 'string',
    },
    {
      id: 'productId',
      name: 'productId',
      description: t('DeviceDetail.agentTools.deviceSelector.inputs.productId'),
      required: false,
      valueType: 'string',
    },
    {
      id: 'productName',
      name: 'productName',
      description: t('DeviceDetail.agentTools.deviceSelector.inputs.productName'),
      required: false,
      valueType: 'string',
    },
    {
      id: 'state',
      name: 'state',
      description: t('DeviceDetail.agentTools.deviceSelector.inputs.state'),
      required: false,
      valueType: 'string',
    },
    {
      id: 'limit',
      name: 'limit',
      description: t('DeviceDetail.agentTools.deviceSelector.inputs.limit'),
      required: false,
      valueType: 'int',
    },
  ],
  output: { type: 'object' },
  help: t('DeviceDetail.agentTools.deviceSelector.help'),
  execute: async (args) => {
    const limit = clampNumber(args.limit, 1, 20, 10);
    const resp = await queryDeviceInstance({
      paging: true,
      pageIndex: 0,
      pageSize: limit,
      sorts: [{ name: 'createTime', order: 'desc' }],
      terms: buildDeviceSelectorTerms(args),
    });
    const paged = normalizePagedList(resp);
    return {
      resourceType: 'device',
      mode: 'candidate-list',
      total: paged.total,
      returned: paged.data.length,
      candidates: paged.data.map(normalizeDeviceCandidate),
      nextAction: paged.total > 1 ? t('DeviceDetail.agentTools.deviceSelector.nextAction.confirmTarget') : undefined,
    };
  },
});

export const registerDeviceDetailSelectorTools = (t: TranslateFn) => {
  aiClientToolRegistry.register(DEVICE_DETAIL_SELECTOR_SCOPE, createDeviceSelectorTool(t));
};

export { DEVICE_DETAIL_SELECTOR_SCOPE };
