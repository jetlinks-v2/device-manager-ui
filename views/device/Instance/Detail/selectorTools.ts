import { query as queryDeviceInstance } from '../../../../api/instance';
import { aiClientToolRegistry } from '@jetlinks-web-core/layout/components/AiChat/clientToolRegistry';
import type { AiClientToolDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientTools';

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

const createDeviceSelectorTool = (): AiClientToolDefinition => ({
  id: 'device_selector_query',
  name: 'device_selector_query',
  description: '按关键词、产品或状态查询设备候选列表，用于需要用户选择其它设备的对话场景。',
  inputs: [
    {
      id: 'keyword',
      name: 'keyword',
      description: '设备ID、设备名称或产品名称关键词。',
      required: false,
      valueType: 'string',
    },
    {
      id: 'productId',
      name: 'productId',
      description: '产品ID，已知产品时用于缩小候选范围。',
      required: false,
      valueType: 'string',
    },
    {
      id: 'productName',
      name: 'productName',
      description: '产品名称关键词。',
      required: false,
      valueType: 'string',
    },
    {
      id: 'state',
      name: 'state',
      description: '设备状态：online/offline/notActive，也支持“在线/离线/禁用”。',
      required: false,
      valueType: 'string',
    },
    {
      id: 'limit',
      name: 'limit',
      description: '最多返回候选数量，默认10，最大20。',
      required: false,
      valueType: 'int',
    },
  ],
  output: { type: 'object' },
  help: '设备候选查询。当前设备详情页默认使用 subject 设备；只有用户明确要选择或对比其它设备、或问题缺少设备对象时才使用。多个候选时应列出候选并让用户确认，不要擅自切换当前 subject。',
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
      nextAction: paged.total > 1 ? '请根据候选设备让用户确认目标设备。' : undefined,
    };
  },
});

export const registerDeviceDetailSelectorTools = () => {
  aiClientToolRegistry.register(DEVICE_DETAIL_SELECTOR_SCOPE, createDeviceSelectorTool());
};

export { DEVICE_DETAIL_SELECTOR_SCOPE };
