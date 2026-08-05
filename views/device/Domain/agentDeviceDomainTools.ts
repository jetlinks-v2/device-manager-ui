import i18n from '@jetlinks-web-core/locales';
import type { AiClientToolDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientTools';
import type { ClientToolInput } from '@jetlinks-web-core/layout/components/AiChat/clientToolApi';
import type { HomeAgentCapabilityContext } from '@jetlinks-web-core/layout/components/AiChat/homeAgentCapabilities';
import {
  detail as getDeviceDetail,
  getProperty,
  getPropertyData,
} from '../../../api/instance';
import { detail as getProductDetail } from '../../../api/product';
import { createDevicePropertyAggregateTool } from '../agentTools/propertyAggregateTool';
import {
  createDeviceLatestPropertiesTool,
  createDeviceMetadataSearchTool,
  createDeviceModelGetTool,
  createDevicePropertyHistorySummaryTool,
  createDevicePropertyHistoryTool,
  devicePropertyAnalysisResult,
  DEVICE_PROPERTY_ANALYSIS_TOOL_IDS,
} from '../agentTools/devicePropertyAnalysisTools';
import {
  describeDeviceToolTimeRange,
  resolveDeviceToolTimeRange,
} from '../agentTools/timeRangeSupport';

const DEVICE_INSTANCE_MENU_CODE = 'device/Instance';
const DEVICE_PRODUCT_MENU_CODE = 'device/Product';

const METADATA_SECTIONS = ['properties', 'functions', 'events', 'tags'] as const;
const VALID_METADATA_SECTIONS = new Set<string>(METADATA_SECTIONS);

type DeviceDomainSubjectType = 'device' | 'product';

interface ResolvedTimeRange {
  start?: number;
  end?: number;
}

interface DeviceDomainSubject {
  type: DeviceDomainSubjectType;
  id: string;
  name?: string;
  productId?: string;
  productName?: string;
  state?: unknown;
  metadata: Record<string, any>;
  raw: Record<string, any>;
}

export const DEVICE_DOMAIN_TOOL_IDS = DEVICE_PROPERTY_ANALYSIS_TOOL_IDS;

const DEVICE_ONLY_TOOL_IDS = new Set<string>([
  DEVICE_DOMAIN_TOOL_IDS.latestProperties,
  DEVICE_DOMAIN_TOOL_IDS.propertyHistorySummary,
  DEVICE_DOMAIN_TOOL_IDS.propertyHistory,
  DEVICE_DOMAIN_TOOL_IDS.propertyAggregate,
]);

interface CreateDeviceDomainToolsOptions {
  includeDeviceTools?: boolean;
  includeProductTools?: boolean;
}

export const isDeviceInstanceAvailable = (context: HomeAgentCapabilityContext) => (
  !!context.findMenu(DEVICE_INSTANCE_MENU_CODE)
);

export const isDeviceProductAvailable = (context: HomeAgentCapabilityContext) => (
  !!context.findMenu(DEVICE_PRODUCT_MENU_CODE)
);

export const isDeviceDomainAvailable = (context: HomeAgentCapabilityContext) => (
  isDeviceInstanceAvailable(context) || isDeviceProductAvailable(context)
);

const normalizeText = (value: unknown) => String(value || '').trim();

const asArray = <T = any>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const clampNumber = (value: unknown, min: number, max: number, defaultValue: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return defaultValue;
  }
  return Math.min(max, Math.max(min, Math.floor(numberValue)));
};

const responseResult = (response: any) => response?.result ?? response?.data ?? response;

const ensureSuccessResult = (response: any) => {
  if (response?.success === false) {
    throw new Error(response?.message || response?.result || 'request failed');
  }
  if (response?.status && response.status !== 200) {
    throw new Error(response?.message || `${response.status}`);
  }
  return responseResult(response);
};

const parseJsonObject = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const compactInlineValue = (value: unknown, maxLength = 1200) => {
  if (value === undefined || value === null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : value;
  } catch {
    return String(value);
  }
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

const firstTextArg = (args: Record<string, any>, ...keys: string[]) => {
  for (const key of keys) {
    const text = normalizeText(args[key]);
    if (text) return text;
  }
  return '';
};

const parseListArg = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }
  return String(value ?? '')
    .split(/[\s,，、/|]+/)
    .map(normalizeText)
    .filter(Boolean);
};

const normalizeMetadataSection = (section?: unknown) => {
  const value = normalizeText(section || 'all');
  return value === 'all' || VALID_METADATA_SECTIONS.has(value) ? value : 'all';
};

const normalizeMetadataTypes = (value: unknown) => {
  const normalized = parseListArg(value).filter((type) => VALID_METADATA_SECTIONS.has(type));
  return normalized.length ? normalized : [...METADATA_SECTIONS];
};

const metadataSectionItems = (metadata: Record<string, any>, section: string) => {
  if (VALID_METADATA_SECTIONS.has(section)) return asArray(metadata[section]);
  return METADATA_SECTIONS.flatMap((type) => (
    asArray(metadata[type]).map((item) => ({ ...item, __type: type }))
  ));
};

const metadataCounts = (metadata: Record<string, any>) => Object.fromEntries(
  METADATA_SECTIONS.map((section) => [section, asArray(metadata[section]).length]),
);

const metadataTypeName = (type: string) => ({
  properties: i18n.global.t('Domain.homeAgent.metadata.properties'),
  functions: i18n.global.t('Domain.homeAgent.metadata.functions'),
  events: i18n.global.t('Domain.homeAgent.metadata.events'),
  tags: i18n.global.t('Domain.homeAgent.metadata.tags'),
}[type] || type);

const dataTypeText = (valueType: any): string => {
  if (!valueType) return 'unknown';
  if (typeof valueType === 'string') return valueType;
  const type = valueType.type || valueType.id || 'object';
  if (type === 'array') {
    return `array<${dataTypeText(valueType.elementType)}>`;
  }
  if (type === 'object' && Array.isArray(valueType.properties)) {
    const props = valueType.properties
      .slice(0, 6)
      .map((item: any) => `${item.id}:${dataTypeText(item.valueType)}`)
      .join(', ');
    return props ? `object{${props}}` : 'object';
  }
  if (Array.isArray(valueType.elements) && valueType.elements.length) {
    const elements = valueType.elements
      .slice(0, 8)
      .map((item: any) => `${item.text || item.label || item.value}:${item.value}`)
      .join(', ');
    return `${type}(${elements})`;
  }
  return String(type);
};

const propertyAccessText = (item: any) => {
  const raw = item?.expands?.type;
  const type = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return type.join('/');
};

const escapeMarkdownTableCell = (value: unknown) => (
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
);

const fallbackText = (value: unknown, fallback = '--') => {
  const text = enumText(value);
  if (text !== undefined && text !== null && text !== '') {
    return text;
  }
  const raw = enumValue(value);
  return raw === undefined || raw === null || raw === '' ? fallback : raw;
};

const getSubjectState = (subject: DeviceDomainSubject) => fallbackText(subject.state);

const pickMetadataSections = (
  metadata: Record<string, any>,
  section: string,
  limit: number,
) => {
  const sectionKey = normalizeMetadataSection(section);
  const sections = sectionKey === 'all' ? [...METADATA_SECTIONS] : [sectionKey as typeof METADATA_SECTIONS[number]];
  return Object.fromEntries(sections.map((key) => [key, metadataSectionItems(metadata, key).slice(0, limit)]));
};

const buildMetadataMarkdown = (
  subject: DeviceDomainSubject,
  section = 'all',
  limit = 80,
) => {
  const sectionKey = normalizeMetadataSection(section);
  const sections = sectionKey === 'all' ? [...METADATA_SECTIONS] : [sectionKey as typeof METADATA_SECTIONS[number]];
  const subjectLabel = subject.type === 'device'
    ? i18n.global.t('Domain.homeAgent.subject.device')
    : i18n.global.t('Domain.homeAgent.subject.product');
  const lines = [
    `# ${subject.name || subject.id || subjectLabel}${i18n.global.t('Domain.homeAgent.metadata.titleSuffix')}`,
    '',
    `- ${subjectLabel}ID: ${subject.id || '--'}`,
    subject.type === 'device' ? `- ${i18n.global.t('Domain.homeAgent.metadata.product')}: ${subject.productName || subject.productId || '--'}` : '',
    `- ${i18n.global.t('Domain.homeAgent.metadata.state')}: ${getSubjectState(subject)}`,
    '',
  ].filter((line) => line !== '');

  sections.forEach((key) => {
    const allItems = metadataSectionItems(subject.metadata, key);
    const items = allItems.slice(0, limit);
    lines.push(`## ${metadataTypeName(key)}（${allItems.length}）`, '');
    if (!items.length) {
      lines.push(i18n.global.t('Domain.homeAgent.metadata.empty'), '');
      return;
    }
    if (key === 'properties') {
      lines.push('| ID | Name | Type | Access | Description |', '| --- | --- | --- | --- | --- |');
      items.forEach((item: any) => {
        lines.push(`| ${escapeMarkdownTableCell(item.id)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(dataTypeText(item.valueType))} | ${escapeMarkdownTableCell(propertyAccessText(item))} | ${escapeMarkdownTableCell(item.description)} |`);
      });
    } else if (key === 'functions') {
      lines.push('| ID | Name | Inputs | Output | Description |', '| --- | --- | --- | --- | --- |');
      items.forEach((item: any) => {
        const inputs = asArray(item.inputs).map((input: any) => `${input.id}:${dataTypeText(input.valueType)}`).join(', ');
        lines.push(`| ${escapeMarkdownTableCell(item.id)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(inputs || '--')} | ${escapeMarkdownTableCell(dataTypeText(item.output))} | ${escapeMarkdownTableCell(item.description)} |`);
      });
    } else if (key === 'events') {
      lines.push('| ID | Name | Type | Output | Description |', '| --- | --- | --- | --- | --- |');
      items.forEach((item: any) => {
        const outputs = asArray(item.properties || item.valueType?.properties)
          .map((property: any) => `${property.id}:${dataTypeText(property.valueType)}`)
          .join(', ');
        lines.push(`| ${escapeMarkdownTableCell(item.id)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(item.type || item.expands?.eventType || '--')} | ${escapeMarkdownTableCell(outputs || '--')} | ${escapeMarkdownTableCell(item.description)} |`);
      });
    } else {
      lines.push('| ID | Name | Type | Description |', '| --- | --- | --- | --- |');
      items.forEach((item: any) => {
        lines.push(`| ${escapeMarkdownTableCell(item.id || item.key)} | ${escapeMarkdownTableCell(item.name)} | ${escapeMarkdownTableCell(dataTypeText(item.valueType || item.dataType))} | ${escapeMarkdownTableCell(item.description)} |`);
      });
    }
    lines.push('');
  });

  return lines.join('\n');
};

const normalizeMetadataMatch = (type: string, item: any) => ({
  type,
  typeName: metadataTypeName(type),
  id: item.id || item.key,
  name: item.name,
  description: item.description,
  valueType: dataTypeText(item.valueType || item.dataType || item.output),
  access: type === 'properties' ? propertyAccessText(item) : undefined,
  inputs: type === 'functions'
    ? asArray(item.inputs).map((input: any) => ({
      id: input.id,
      name: input.name,
      valueType: dataTypeText(input.valueType),
    }))
    : undefined,
});

const fuzzySearchMetadata = (metadata: Record<string, any>, keyword: string, types: string[], limit: number) => {
  const lower = keyword.toLowerCase();
  const candidates = normalizeMetadataTypes(types)
    .flatMap((type) => metadataSectionItems(metadata, type).map((item) => ({ type, item })));
  return candidates
    .filter(({ item }) => {
      const text = [
        item.id,
        item.key,
        item.name,
        item.description,
        item.type,
        dataTypeText(item.valueType || item.dataType || item.output),
      ].filter(Boolean).join(' ').toLowerCase();
      return !lower || text.includes(lower);
    })
    .slice(0, limit)
    .map(({ type, item }) => normalizeMetadataMatch(type, item));
};

const normalizePagedList = (response: any) => {
  const result = responseResult(response) || {};
  const list = result.data || result.records || result.result || (Array.isArray(result) ? result : []);
  const hasTotal = result.total !== undefined || result.count !== undefined;
  return {
    data: Array.isArray(list) ? list : [],
    total: Number(result.total ?? result.count ?? (Array.isArray(list) ? list.length : 0)),
    hasTotal,
  };
};

const parseLocalDateTime = (value: string) => {
  const matched = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?)?$/);
  if (!matched) return undefined;

  const [, year, month, day, hour = '0', minute = '0', second = '0', millisecond = '0'] = matched;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millisecond.padEnd(3, '0')),
  );
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const parsePlainTimeValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }

  const raw = String(value).trim();
  if (!raw) return undefined;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const timestamp = Number(raw);
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }

  const localDateTime = parseLocalDateTime(raw);
  if (localDateTime !== undefined) return localDateTime;

  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
};

const startOfWeek = (date = new Date()) => {
  const value = new Date(startOfDay(date));
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value.getTime();
};

const startOfMonth = (date = new Date()) => {
  const value = new Date(date);
  value.setDate(1);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
};

const addDays = (timestamp: number, days: number) => {
  const value = new Date(timestamp);
  value.setDate(value.getDate() + days);
  return value.getTime();
};

const addMonths = (timestamp: number, months: number) => {
  const value = new Date(timestamp);
  value.setMonth(value.getMonth() + months);
  return value.getTime();
};

const endOfPreviousMillisecond = (timestamp: number) => Math.max(0, timestamp - 1);

const applyDateMath = (mathString: string, baseTime: number) => {
  let value = new Date(baseTime);
  for (let index = 0; index < mathString.length;) {
    const operator = mathString.charAt(index++);
    const round = operator === '/';
    const sign = operator === '-' ? -1 : 1;
    if (!round && operator !== '+' && operator !== '-') return undefined;
    if (index >= mathString.length) return undefined;

    const numberStart = index;
    while (index < mathString.length && /\d/.test(mathString.charAt(index))) {
      index += 1;
    }
    const amount = numberStart === index ? 1 : Number(mathString.slice(numberStart, index));
    if (!Number.isFinite(amount) || amount <= 0 || index >= mathString.length) return undefined;

    const unit = mathString.charAt(index++);
    if (round && amount !== 1) return undefined;

    if (round) {
      if (unit === 'y') value = new Date(value.getFullYear(), 0, 1);
      else if (unit === 'M') value = new Date(value.getFullYear(), value.getMonth(), 1);
      else if (unit === 'w') {
        const day = value.getDay() || 7;
        value = new Date(value.getFullYear(), value.getMonth(), value.getDate() - day + 1);
      } else if (unit === 'd') value = new Date(value.getFullYear(), value.getMonth(), value.getDate());
      else if (unit === 'h' || unit === 'H') value = new Date(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours());
      else if (unit === 'm') value = new Date(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes());
      else if (unit === 's') value = new Date(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes(), value.getSeconds());
      else return undefined;
      continue;
    }

    const next = new Date(value);
    if (unit === 'y') next.setFullYear(next.getFullYear() + sign * amount);
    else if (unit === 'M') next.setMonth(next.getMonth() + sign * amount);
    else if (unit === 'w') next.setDate(next.getDate() + sign * amount * 7);
    else if (unit === 'd') next.setDate(next.getDate() + sign * amount);
    else if (unit === 'h' || unit === 'H') next.setHours(next.getHours() + sign * amount);
    else if (unit === 'm') next.setMinutes(next.getMinutes() + sign * amount);
    else if (unit === 's') next.setSeconds(next.getSeconds() + sign * amount);
    else return undefined;
    value = next;
  }

  const timestamp = value.getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const parseDateMathValue = (value: unknown) => {
  if (value === undefined || value === null || value === '' || typeof value === 'object') return undefined;

  const raw = String(value).trim();
  if (!raw) return undefined;

  const compact = raw.replace(/\s+/g, '');
  const nowMatched = compact.match(/^now(?:\(\))?(.*)$/i);
  if (nowMatched) {
    return applyDateMath(nowMatched[1] || '', Date.now());
  }

  const separatorIndex = raw.indexOf('||');
  if (separatorIndex < 0) return undefined;

  const base = parsePlainTimeValue(raw.slice(0, separatorIndex).trim());
  if (base === undefined) return undefined;
  return applyDateMath(raw.slice(separatorIndex + 2).replace(/\s+/g, ''), base);
};

const toTimeValue = (value: unknown) => parseDateMathValue(value) ?? parsePlainTimeValue(value);

const normalizeRelativeTimeRange = (value: unknown): ResolvedTimeRange | undefined => {
  if (value === undefined || value === null || value === '' || typeof value === 'object') return undefined;

  const raw = String(value).trim();
  if (!raw) return undefined;

  const normalized = raw.toLowerCase().replace(/\s+/g, '');
  const now = Date.now();
  const todayStart = startOfDay();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  if (['today', '今日', '今天', '本日', '当天'].includes(normalized)) {
    return { start: todayStart, end: now };
  }
  if (['yesterday', '昨日', '昨天'].includes(normalized)) {
    return { start: addDays(todayStart, -1), end: endOfPreviousMillisecond(todayStart) };
  }
  if (['thisweek', '本周', '这周', '当前周'].includes(normalized)) {
    return { start: weekStart, end: now };
  }
  if (['thismonth', '本月', '这个月', '当前月'].includes(normalized)) {
    return { start: monthStart, end: now };
  }
  if (['lastmonth', '上月'].includes(normalized)) {
    return { start: addMonths(monthStart, -1), end: endOfPreviousMillisecond(monthStart) };
  }
  if (['lastweek', '上周'].includes(normalized)) {
    return { start: addDays(weekStart, -7), end: endOfPreviousMillisecond(weekStart) };
  }

  const relativeMatched = normalized.match(/^(?:last|past|recent|最近|近|过去)?(\d+)(ms|毫秒|s|秒|min|minute|minutes|分钟|m|h|hour|hours|小时|d|day|days|天|w|week|weeks|周|month|months|个月)$/);
  if (!relativeMatched) return undefined;

  const amount = Number(relativeMatched[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;

  const unit = relativeMatched[2];
  const unitMs = ({
    ms: 1,
    '毫秒': 1,
    s: 1000,
    '秒': 1000,
    min: 60 * 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    '分钟': 60 * 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    '小时': 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    '天': 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    '周': 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    '个月': 30 * 24 * 60 * 60 * 1000,
  } as Record<string, number>)[unit];

  return unitMs ? { start: now - amount * unitMs, end: now } : undefined;
};

const resolveTimePoint = (value: unknown, boundary: 'start' | 'end') => {
  const timestamp = toTimeValue(value);
  if (timestamp !== undefined) return timestamp;
  const range = normalizeRelativeTimeRange(value);
  return boundary === 'end' ? range?.end : range?.start;
};

const toTimeRangeValue = (value: unknown): ResolvedTimeRange | undefined => {
  const relative = normalizeRelativeTimeRange(value);
  if (relative) return relative;

  if (Array.isArray(value)) {
    const start = resolveTimePoint(value[0], 'start');
    const end = resolveTimePoint(value[1], 'end');
    return start === undefined && end === undefined ? undefined : { start, end };
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, any>;
    const startValue = record.start ?? record.from ?? record.startTime ?? record.begin ?? record.beginTime;
    const endValue = record.end ?? record.to ?? record.endTime ?? record.finish ?? record.finishTime;
    const start = resolveTimePoint(startValue, 'start');
    const end = resolveTimePoint(endValue, 'end');
    if (start !== undefined || end !== undefined) return { start, end };
  }

  const timestamp = toTimeValue(value);
  return timestamp === undefined ? undefined : { start: timestamp };
};

const getTimeRangeArg = (args: Record<string, any>) => (
  ['timeRange', 'range', 'date', 'period']
    .map((key) => args[key])
    .find((value) => value !== undefined && value !== null && value !== '')
);

const resolveTimeRange = (args: Record<string, any>): ResolvedTimeRange => {
  const range = toTimeRangeValue(getTimeRangeArg(args));
  const startRange = normalizeRelativeTimeRange(args.startTime);
  const endRange = normalizeRelativeTimeRange(args.endTime);
  const start = resolveTimePoint(args.startTime, 'start') ?? range?.start ?? (!args.startTime ? endRange?.start : undefined);
  const end = resolveTimePoint(args.endTime, 'end') ?? startRange?.end ?? range?.end;
  if (start !== undefined && end !== undefined && start > end) {
    return { start: end, end: start };
  }
  return { start, end };
};

const describeResolvedTimeRange = (range: ResolvedTimeRange) => (
  range.start === undefined && range.end === undefined
    ? undefined
    : {
      startTime: range.start,
      endTime: range.end,
      startTimeText: range.start === undefined ? undefined : new Date(range.start).toLocaleString(),
      endTimeText: range.end === undefined ? undefined : new Date(range.end).toLocaleString(),
    }
);

const buildTimeTerms = (args: Record<string, any>, column = 'timestamp', resolved = resolveTimeRange(args)) => {
  const { start, end } = resolved;
  if (start === undefined && end === undefined) {
    return [];
  }
  return [
    {
      column,
      termType: 'btw',
      value: [start ?? 0, end ?? Date.now()],
    },
  ];
};

const timeRangeInput = () => ({
  id: 'timeRange',
  name: 'timeRange',
  description: i18n.global.t('Domain.homeAgent.tool.common.timeRange'),
  required: false,
  valueType: 'string',
});

const resolveSubjectType = (args: Record<string, any>): DeviceDomainSubjectType | undefined => {
  const value = normalizeText(args.subjectType || args.type).toLowerCase();
  if (['device', 'instance', '设备', '设备实例'].includes(value)) return 'device';
  if (['product', '设备产品', '产品'].includes(value)) return 'product';
  return undefined;
};

const resolveDeviceMetadata = (record: Record<string, any>) => {
  const metadata = parseJsonObject(record.metadata);
  if (Object.keys(metadata).length) return metadata;
  return parseJsonObject(record.deriveMetadata || record.productMetadata);
};

const fetchDeviceSubject = async (deviceId: string): Promise<DeviceDomainSubject> => {
  const device = ensureSuccessResult(await getDeviceDetail(deviceId));
  return {
    type: 'device',
    id: normalizeText(device.id) || deviceId,
    name: device.name,
    productId: device.productId,
    productName: device.productName,
    state: device.state,
    metadata: resolveDeviceMetadata(device),
    raw: device,
  };
};

const fetchProductSubject = async (productId: string): Promise<DeviceDomainSubject> => {
  const product = ensureSuccessResult(await getProductDetail(productId));
  return {
    type: 'product',
    id: normalizeText(product.id) || productId,
    name: product.name,
    productId: normalizeText(product.id) || productId,
    productName: product.name,
    state: product.state,
    metadata: parseJsonObject(product.metadata),
    raw: product,
  };
};

const ensureDevicePermission = (context: HomeAgentCapabilityContext) => {
  if (!isDeviceInstanceAvailable(context)) {
    throw new Error(i18n.global.t('Domain.homeAgent.tool.common.noDevicePermission'));
  }
};

const ensureProductPermission = (context: HomeAgentCapabilityContext) => {
  if (!isDeviceProductAvailable(context)) {
    throw new Error(i18n.global.t('Domain.homeAgent.tool.common.noProductPermission'));
  }
};

const resolveModelSubject = async (
  args: Record<string, any>,
  context: HomeAgentCapabilityContext,
) => {
  const subjectType = resolveSubjectType(args);
  const deviceId = firstTextArg(args, 'deviceId');
  const productId = firstTextArg(args, 'productId');

  if ((subjectType === 'device' || (!subjectType && deviceId)) && deviceId) {
    ensureDevicePermission(context);
    return fetchDeviceSubject(deviceId);
  }
  if ((subjectType === 'product' || productId) && productId) {
    ensureProductPermission(context);
    return fetchProductSubject(productId);
  }
  throw new Error(i18n.global.t('Domain.homeAgent.tool.common.subjectIdRequired'));
};

const extractPropertyValue = (record: Record<string, any>, propertyId: string) => {
  const formatKey = `${propertyId}_format`;
  return record?.value
    ?? record?.propertyValue
    ?? record?.[formatKey]
    ?? record?.[propertyId]
    ?? record?.data
    ?? record?.result
    ?? record;
};

const normalizeLatestPropertyRead = (item: Record<string, any>) => {
  const result = item.result && typeof item.result === 'object' ? item.result : { value: item.result };
  return {
    propertyId: item.propertyId,
    success: !!item.success,
    source: item.source,
    timestamp: result.timestamp ?? result.time ?? result.createTime,
    value: compactInlineValue(extractPropertyValue(result, item.propertyId), 1600),
    error: item.error,
    readError: item.readError,
  };
};

const normalizePropertyHistoryRecord = (item: Record<string, any>, propertyId: string) => ({
  timestamp: item.timestamp ?? item.time ?? item.createTime,
  value: compactInlineValue(extractPropertyValue(item, propertyId), 1600),
  messageId: item.messageId,
  formatValue: item[`${propertyId}_format`],
});

const normalizeToolError = (error: any) => ({
  message: error?.message || String(error),
  status: error?.status || error?.response?.status,
  code: error?.code || error?.response?.data?.code,
});

const readLatestProperty = async (deviceId: string, propertyId: string) => {
  try {
    const resp = await getProperty(deviceId, propertyId);
    return {
      propertyId,
      success: true,
      source: 'read',
      result: responseResult(resp),
    };
  } catch (error) {
    try {
      const historyResp = await getPropertyData(deviceId, propertyId, {
        paging: true,
        pageIndex: 0,
        pageSize: 1,
        sorts: [{ name: 'timestamp', order: 'desc' }],
        terms: [],
      });
      const latest = normalizePagedList(historyResp).data[0];
      return {
        propertyId,
        success: !!latest,
        source: 'history',
        result: latest,
        readError: normalizeToolError(error),
      };
    } catch (historyError) {
      return {
        propertyId,
        success: false,
        source: 'none',
        error: normalizeToolError(historyError),
        readError: normalizeToolError(error),
      };
    }
  }
};

const subjectInputs = (): ClientToolInput[] => [
  {
    id: 'subjectType',
    name: 'subjectType',
    description: i18n.global.t('Domain.homeAgent.tool.common.subjectType'),
    required: false,
    valueType: 'string',
  },
  {
    id: 'deviceId',
    name: 'deviceId',
    description: i18n.global.t('Domain.homeAgent.tool.common.deviceId'),
    required: false,
    valueType: 'string',
  },
  {
    id: 'productId',
    name: 'productId',
    description: i18n.global.t('Domain.homeAgent.tool.common.productId'),
    required: false,
    valueType: 'string',
  },
];

export const createDeviceDomainTools = (
  options: CreateDeviceDomainToolsOptions = {},
): AiClientToolDefinition<HomeAgentCapabilityContext>[] => {
  const includeDeviceTools = options.includeDeviceTools !== false;
  const includeProductTools = options.includeProductTools !== false;
  const hasDomainTools = includeDeviceTools || includeProductTools;

  return [
  createDeviceModelGetTool<HomeAgentCapabilityContext>({
    copy: {
      displayName: i18n.global.t('Domain.homeAgent.tool.modelGet.displayName'),
      progressText: i18n.global.t('Domain.homeAgent.tool.modelGet.progressText'),
      description: i18n.global.t('Domain.homeAgent.tool.modelGet.description'),
      help: i18n.global.t('Domain.homeAgent.tool.modelGet.help'),
    },
    inputs: [
      ...subjectInputs(),
      {
        id: 'section',
        name: 'section',
        description: i18n.global.t('Domain.homeAgent.tool.common.section'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'format',
        name: 'format',
        description: i18n.global.t('Domain.homeAgent.tool.modelGet.format'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'limit',
        name: 'limit',
        description: i18n.global.t('Domain.homeAgent.tool.modelGet.limit'),
        required: false,
        valueType: 'int',
      },
    ],
    execute: async (args, context) => {
      const subject = await resolveModelSubject(args, context);
      const section = normalizeMetadataSection(args.section);
      const limit = clampNumber(args.limit, 1, 120, 40);
      const format = normalizeText(args.format).toLowerCase() === 'json' ? 'json' : 'markdown';
      const model = pickMetadataSections(subject.metadata, section, limit);
      return devicePropertyAnalysisResult({
        subject: {
          type: subject.type,
          id: subject.id,
          name: subject.name,
          productId: subject.productId,
          productName: subject.productName,
          state: {
            value: enumValue(subject.state),
            text: enumText(subject.state),
          },
        },
        section,
        counts: metadataCounts(subject.metadata),
        format,
        markdown: format === 'markdown' ? buildMetadataMarkdown(subject, section, limit) : undefined,
        metadata: format === 'json' ? model : undefined,
        model,
      }, {
        summary: {
          subjectType: subject.type,
          subjectId: subject.id,
          section,
          counts: metadataCounts(subject.metadata),
        },
      });
    },
  }),
  createDeviceMetadataSearchTool<HomeAgentCapabilityContext>({
    copy: {
      displayName: i18n.global.t('Domain.homeAgent.tool.metadataSearch.displayName'),
      progressText: i18n.global.t('Domain.homeAgent.tool.metadataSearch.progressText'),
      description: i18n.global.t('Domain.homeAgent.tool.metadataSearch.description'),
      help: i18n.global.t('Domain.homeAgent.tool.metadataSearch.help'),
    },
    inputs: [
      ...subjectInputs(),
      {
        id: 'keyword',
        name: 'keyword',
        description: i18n.global.t('Domain.homeAgent.tool.metadataSearch.keyword'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'types',
        name: 'types',
        description: i18n.global.t('Domain.homeAgent.tool.metadataSearch.types'),
        required: false,
        valueType: { type: 'array', elementType: { type: 'string' } },
      },
      {
        id: 'limit',
        name: 'limit',
        description: i18n.global.t('Domain.homeAgent.tool.metadataSearch.limit'),
        required: false,
        valueType: 'int',
      },
    ],
    execute: async (args, context) => {
      const subject = await resolveModelSubject(args, context);
      const keyword = normalizeText(args.keyword);
      const types = normalizeMetadataTypes(args.types);
      const limit = clampNumber(args.limit, 1, 100, 20);
      const matches = fuzzySearchMetadata(subject.metadata, keyword, types, limit);
      return devicePropertyAnalysisResult({
        subject: {
          type: subject.type,
          id: subject.id,
          name: subject.name,
          productId: subject.productId,
          productName: subject.productName,
        },
        keyword,
        types,
        counts: metadataCounts(subject.metadata),
        matches,
      }, {
        status: matches.length ? 'ok' : 'empty',
        summary: {
          subjectType: subject.type,
          subjectId: subject.id,
          keyword,
          returned: matches.length,
        },
      });
    },
  }),
  createDeviceLatestPropertiesTool<HomeAgentCapabilityContext, Record<string, unknown>>({
    copy: {
      displayName: i18n.global.t('Domain.homeAgent.tool.latestProperties.displayName'),
      progressText: i18n.global.t('Domain.homeAgent.tool.latestProperties.progressText'),
      description: i18n.global.t('Domain.homeAgent.tool.latestProperties.description'),
      help: i18n.global.t('Domain.homeAgent.tool.latestProperties.help'),
    },
    inputs: [
      {
        id: 'deviceId',
        name: 'deviceId',
        description: i18n.global.t('Domain.homeAgent.tool.common.deviceIdRequired'),
        required: true,
        valueType: 'string',
      },
      {
        id: 'propertyIds',
        name: 'propertyIds',
        description: i18n.global.t('Domain.homeAgent.tool.latestProperties.propertyIds'),
        required: false,
        valueType: { type: 'array', elementType: { type: 'string' } },
      },
      {
        id: 'limit',
        name: 'limit',
        description: i18n.global.t('Domain.homeAgent.tool.latestProperties.limit'),
        required: false,
        valueType: 'int',
      },
    ],
    execute: async (args, context) => {
      ensureDevicePermission(context);
      const deviceId = firstTextArg(args, 'deviceId');
      if (!deviceId) throw new Error(i18n.global.t('Domain.homeAgent.tool.common.deviceIdMissing'));
      const limit = clampNumber(args.limit, 1, 30, 15);
      const providedPropertyIds = parseListArg(args.propertyIds);
      const subject = providedPropertyIds.length ? undefined : await fetchDeviceSubject(deviceId);
      const propertyIds = providedPropertyIds.length
        ? providedPropertyIds
        : asArray(subject?.metadata.properties).map((item: any) => item.id).filter(Boolean).slice(0, limit);
      const data = await Promise.all(propertyIds.map((propertyId) => readLatestProperty(deviceId, propertyId)));
      return devicePropertyAnalysisResult({
        deviceId,
        count: data.length,
        successCount: data.filter((item) => item.success).length,
        data: data.map(normalizeLatestPropertyRead),
      }, {
        status: data.length ? 'ok' : 'empty',
        summary: {
          deviceId,
          count: data.length,
          successCount: data.filter((item) => item.success).length,
        },
      });
    },
  }),
  createDevicePropertyHistorySummaryTool<HomeAgentCapabilityContext, Record<string, unknown>>({
    copy: {
      displayName: i18n.global.t('Domain.homeAgent.tool.historySummary.displayName'),
      progressText: i18n.global.t('Domain.homeAgent.tool.historySummary.progressText'),
      description: i18n.global.t('Domain.homeAgent.tool.historySummary.description'),
      help: i18n.global.t('Domain.homeAgent.tool.historySummary.help'),
    },
    inputs: [
      {
        id: 'deviceId',
        name: 'deviceId',
        description: i18n.global.t('Domain.homeAgent.tool.common.deviceIdRequired'),
        required: true,
        valueType: 'string',
      },
      {
        id: 'propertyId',
        name: 'propertyId',
        description: i18n.global.t('Domain.homeAgent.tool.common.propertyId'),
        required: true,
        valueType: 'string',
      },
      {
        id: 'startTime',
        name: 'startTime',
        description: i18n.global.t('Domain.homeAgent.tool.common.startTime'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'endTime',
        name: 'endTime',
        description: i18n.global.t('Domain.homeAgent.tool.common.endTime'),
        required: false,
        valueType: 'string',
      },
      timeRangeInput(),
      {
        id: 'sampleLimit',
        name: 'sampleLimit',
        description: i18n.global.t('Domain.homeAgent.tool.historySummary.sampleLimit'),
        required: false,
        valueType: 'int',
      },
    ],
    execute: async (args, context) => {
      ensureDevicePermission(context);
      const deviceId = firstTextArg(args, 'deviceId');
      const propertyId = firstTextArg(args, 'propertyId', 'property');
      if (!deviceId) throw new Error(i18n.global.t('Domain.homeAgent.tool.common.deviceIdMissing'));
      if (!propertyId) throw new Error(i18n.global.t('Domain.homeAgent.tool.common.propertyIdMissing'));
      const sampleLimit = clampNumber(args.sampleLimit, 1, 10, 3);
      const timeRange = resolveDeviceToolTimeRange(args, {
        invalidInputMessage: i18n.global.t('DeviceDetail.agentTools.common.errors.timeRangeInvalid'),
      });
      const resp = await getPropertyData(deviceId, propertyId, {
        paging: true,
        pageIndex: 0,
        pageSize: sampleLimit,
        sorts: [{ name: 'timestamp', order: 'desc' }],
        terms: buildTimeTerms(args, 'timestamp', timeRange),
      });
      const result = normalizePagedList(resp);
      const resolvedRange = describeDeviceToolTimeRange(timeRange);
      return devicePropertyAnalysisResult({
        deviceId,
        propertyId,
        timeRange: resolvedRange,
        total: result.total,
        returned: result.data.length,
        samples: result.data.map((item: Record<string, any>) => normalizePropertyHistoryRecord(item, propertyId)),
      }, {
        status: result.total ? 'ok' : 'empty',
        requestedRange: resolvedRange,
        summary: {
          deviceId,
          propertyId,
          total: result.total,
          returned: result.data.length,
        },
        facts: { deviceId, propertyId, total: result.total },
      });
    },
  }),
  createDevicePropertyHistoryTool<HomeAgentCapabilityContext>({
    copy: {
      displayName: i18n.global.t('Domain.homeAgent.tool.history.displayName'),
      progressText: i18n.global.t('Domain.homeAgent.tool.history.progressText'),
      description: i18n.global.t('Domain.homeAgent.tool.history.description'),
      help: i18n.global.t('Domain.homeAgent.tool.history.help'),
    },
    inputs: [
      {
        id: 'deviceId',
        name: 'deviceId',
        description: i18n.global.t('Domain.homeAgent.tool.common.deviceIdRequired'),
        required: true,
        valueType: 'string',
      },
      {
        id: 'propertyId',
        name: 'propertyId',
        description: i18n.global.t('Domain.homeAgent.tool.common.propertyId'),
        required: true,
        valueType: 'string',
      },
      {
        id: 'startTime',
        name: 'startTime',
        description: i18n.global.t('Domain.homeAgent.tool.common.startTime'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'endTime',
        name: 'endTime',
        description: i18n.global.t('Domain.homeAgent.tool.common.endTime'),
        required: false,
        valueType: 'string',
      },
      timeRangeInput(),
      {
        id: 'limit',
        name: 'limit',
        description: i18n.global.t('Domain.homeAgent.tool.history.limit'),
        required: false,
        valueType: 'int',
      },
    ],
    execute: async (args, context) => {
      ensureDevicePermission(context);
      const deviceId = firstTextArg(args, 'deviceId');
      const propertyId = firstTextArg(args, 'propertyId', 'property');
      if (!deviceId) throw new Error(i18n.global.t('Domain.homeAgent.tool.common.deviceIdMissing'));
      if (!propertyId) throw new Error(i18n.global.t('Domain.homeAgent.tool.common.propertyIdMissing'));
      const limit = clampNumber(args.limit, 1, 50, 20);
      const timeRange = resolveDeviceToolTimeRange(args, {
        invalidInputMessage: i18n.global.t('DeviceDetail.agentTools.common.errors.timeRangeInvalid'),
      });
      const resp = await getPropertyData(deviceId, propertyId, {
        paging: true,
        pageIndex: 0,
        pageSize: limit,
        sorts: [{ name: 'timestamp', order: 'desc' }],
        terms: buildTimeTerms(args, 'timestamp', timeRange),
      });
      const result = normalizePagedList(resp);
      const resolvedRange = describeDeviceToolTimeRange(timeRange);
      const records = result.data.map((item: Record<string, any>) => normalizePropertyHistoryRecord(item, propertyId));
      const truncated = result.total > records.length;
      return devicePropertyAnalysisResult({ records }, {
        status: result.total ? 'ok' : 'empty',
        complete: !truncated,
        truncated,
        limitReason: truncated ? 'records' : undefined,
        requestedRange: resolvedRange,
        summary: {
          deviceId,
          propertyId,
          total: result.total,
          returned: records.length,
        },
        facts: { deviceId, propertyId, total: result.total },
      });
    },
  }),
  createDevicePropertyAggregateTool<HomeAgentCapabilityContext>({
    displayName: i18n.global.t('Domain.homeAgent.tool.aggregate.displayName'),
    progressText: i18n.global.t('Domain.homeAgent.tool.aggregate.progressText'),
    copy: {
      description: i18n.global.t('Domain.homeAgent.tool.aggregate.description'),
      help: i18n.global.t('Domain.homeAgent.tool.aggregate.help'),
      propertyId: i18n.global.t('Domain.homeAgent.tool.aggregate.propertyId'),
      propertyIds: i18n.global.t('Domain.homeAgent.tool.aggregate.propertyIds'),
      aggregation: i18n.global.t('Domain.homeAgent.tool.aggregate.agg'),
      interval: i18n.global.t('Domain.homeAgent.tool.aggregate.interval'),
      startTime: i18n.global.t('Domain.homeAgent.tool.common.startTime'),
      endTime: i18n.global.t('Domain.homeAgent.tool.common.endTime'),
      timeRangeInput: timeRangeInput(),
      limit: i18n.global.t('Domain.homeAgent.tool.aggregate.limit'),
      deviceIdMissing: i18n.global.t('Domain.homeAgent.tool.common.deviceIdMissing'),
      propertyIdMissing: i18n.global.t('Domain.homeAgent.tool.common.propertyIdMissing'),
      nonNumericWarning: propertyId => i18n.global.t(
        'Domain.homeAgent.tool.aggregate.nonNumericWarning',
        [propertyId],
      ),
      longitudeLabel: propertyLabel => i18n.global.t(
        'Domain.homeAgent.tool.aggregate.longitudeLabel',
        [propertyLabel],
      ),
      latitudeLabel: propertyLabel => i18n.global.t(
        'Domain.homeAgent.tool.aggregate.latitudeLabel',
        [propertyLabel],
      ),
      pathResolutionAdjusted: (requested, resolved) => i18n.global.t(
        'Domain.homeAgent.tool.aggregate.pathResolutionAdjusted',
        [requested, resolved],
      ),
      truncated: i18n.global.t('Domain.homeAgent.tool.aggregate.truncated'),
    },
    decorateInputs: inputs => [
      {
        id: 'deviceId',
        name: 'deviceId',
        description: i18n.global.t('Domain.homeAgent.tool.common.deviceIdRequired'),
        required: true,
        valueType: 'string',
      },
      ...inputs,
    ],
    resolveSubject: async (args, context) => {
      ensureDevicePermission(context);
      const deviceId = firstTextArg(args, 'deviceId');
      if (!deviceId) return { deviceId: '', metadata: {} };
      const subject = await fetchDeviceSubject(deviceId);
      return { deviceId, metadata: subject.metadata };
    },
    resolveTimeRange: (args) => resolveDeviceToolTimeRange(args, {
      invalidInputMessage: i18n.global.t('DeviceDetail.agentTools.common.errors.timeRangeInvalid'),
    }),
    describeTimeRange: describeDeviceToolTimeRange,
    dataTypeText,
    compactValue: compactInlineValue,
  }),
  ].filter((tool) => (
    hasDomainTools
    && (!DEVICE_ONLY_TOOL_IDS.has(tool.id) || includeDeviceTools)
  ));
};

export const DEVICE_DOMAIN_MENU_CODES = {
  instance: DEVICE_INSTANCE_MENU_CODE,
  product: DEVICE_PRODUCT_MENU_CODE,
};
