import { request } from '@jetlinks-web/core';

export type DeviceLibraryParserTemplate = {
  parserType?: string;
  parserName?: string;
  modbusLinkType?: string;
  mappings?: Record<string, unknown>[];
};

type InstalledCapability = {
  capabilityId?: string;
  resourceId?: string;
  resourcesId?: string;
  id?: string;
  dataId?: string;
  productId?: string;
  version?: string;
  data?: Record<string, unknown>;
  result?: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

type MarketplaceVersion = Record<string, unknown>;

export async function queryInstalledDeviceLibraryParserTemplate(
  productId: string,
): Promise<DeviceLibraryParserTemplate | undefined> {
  const installedRows = unwrapArray<InstalledCapability>(
    await request.post('/marketplace/capabilities/device-template/installed', [productId]),
  );
  const matchedRows = installedRows.filter((row) => {
    const installedProductId = firstString(
      row.dataId,
      row.productId,
      row.data?.dataId,
      row.data?.productId,
      row.result?.dataId,
      row.result?.productId,
      row.extra?.dataId,
      row.extra?.productId,
    );
    return !installedProductId || installedProductId === productId;
  });

  for (const row of matchedRows.length ? matchedRows : installedRows) {
    const capabilityIds = uniqueStrings(row.capabilityId, row.resourceId, row.resourcesId, row.id);
    const installedVersion = firstString(row.version);

    for (const capabilityId of capabilityIds) {
      const template = await queryCapabilityParserTemplate(capabilityId, installedVersion);
      if (template) return template;
    }
  }

  return undefined;
}

async function queryCapabilityParserTemplate(capabilityId: string, installedVersion?: string) {
  const versions: string[] = [];
  if (installedVersion) versions.push(installedVersion);

  const published = latestPublishedVersion(
    unwrapArray<MarketplaceVersion>(
      await request.get(`/marketplace/capabilities/${encodeURIComponent(capabilityId)}/versions`).catch(() => []),
    ),
  );
  const publishedVersion = firstString(published?.version);
  if (publishedVersion) versions.push(publishedVersion);

  for (const version of uniqueStrings(...versions)) {
    const pkg = await request
      .get(`/marketplace/capabilities/${encodeURIComponent(capabilityId)}/versions/${encodeURIComponent(version)}/package`)
      .catch(() => undefined);
    const template = extractParserTemplate(pkg);
    if (template) return template;
  }

  return undefined;
}

function extractParserTemplate(payload: unknown): DeviceLibraryParserTemplate | undefined {
  const source = unwrapResult(payload);
  const candidates = collectTemplateCandidates(source);

  for (const candidate of candidates) {
    const template = readParserTemplate(candidate);
    if (template) return template;
  }

  return undefined;
}

function collectTemplateCandidates(source: unknown) {
  const root = parseJsonObject(source);
  if (!root) return [];

  const candidates: unknown[] = [root, root.capabilityPackage, root.package, root.resource];
  const resources = Array.isArray(root.resources) ? root.resources : [];
  candidates.push(
    ...resources.filter((item) => isRecord(item) && item.type === 'device-template'),
    ...resources,
  );
  return candidates;
}

function readParserTemplate(source: unknown): DeviceLibraryParserTemplate | undefined {
  const node = parseJsonObject(source);
  if (!node) return undefined;

  const metadata = parseJsonObject(node.metadata);
  const directTemplate = parseJsonObject(node.template);
  const metadataTemplate = parseJsonObject(metadata?.template);
  const template = directTemplate ?? metadataTemplate;
  const dataParser = parseJsonObject(template?.dataParser ?? node.dataParser);
  if (!dataParser) return undefined;

  const mappings = Array.isArray(dataParser.mappings)
    ? dataParser.mappings.filter(isRecord)
    : undefined;

  return {
    parserType: firstString(dataParser.parserType),
    parserName: firstString(dataParser.parserName),
    modbusLinkType: firstString(dataParser.modbusLinkType),
    mappings,
  };
}

function latestPublishedVersion(versions: MarketplaceVersion[]) {
  const sorted = [...versions].sort((left, right) => {
    const timeGap = toVersionTime(right) - toVersionTime(left);
    if (timeGap !== 0) return timeGap;
    return firstString(right.version).localeCompare(firstString(left.version));
  });

  return sorted.find((item) => {
    const state = firstString(item.state, item.status, item.releaseState, item.publishState).toLowerCase();
    return !state || ['enabled', 'published', 'released', 'release', 'current'].includes(state);
  }) ?? sorted[0];
}

function toVersionTime(version: MarketplaceVersion) {
  const time = Number(version.releaseTime ?? version.createTime ?? version.updateTime);
  return Number.isFinite(time) ? time : 0;
}

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!isRecord(payload)) return [];
  const result = 'result' in payload ? payload.result : 'data' in payload ? payload.data : payload;
  if (Array.isArray(result)) return result as T[];
  if (isRecord(result)) {
    if (Array.isArray(result.data)) return result.data as T[];
    if (Array.isArray(result.records)) return result.records as T[];
  }
  return [];
}

function unwrapResult(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  if ('result' in payload) return payload.result;
  if ('data' in payload) return payload.data;
  return payload;
}

function parseJsonObject(value: unknown): Record<string, any> | undefined {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = value == null ? '' : String(value).trim();
    if (text) return text;
  }
  return '';
}

function uniqueStrings(...values: unknown[]) {
  return [...new Set(values.map((item) => firstString(item)).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
