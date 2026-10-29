import type { I18nMessages } from '@jetlinks-web-core/components';

export type FormDataType = {
    description: string;
    name: string;
    productId: string | undefined;
    version: undefined;
    versionOrder: undefined;
    signMethod: string | undefined;
    sign: string;
    url: string;
    size: number;
    properties: Array<Properties>;
    id?: string;
    format?: string;
    mode?: object;
    creatorId?: string;
    createTime?: number;
    i18nMessages?: I18nMessages;
};

export interface Properties {
    id: string;
    value: any;
    keyid: number;
}

export type FirmwareSignMethod = 'MD5' | 'SHA256';

export interface FirmwareProductOption {
    label: string;
    value: string;
}

export interface FirmwareUploadResult {
    accessUrl: string;
    sha256: string;
    length: number;
}

export interface ApplicationFirmwareFile {
    url: string;
    sign: string;
    signMethod: FirmwareSignMethod;
    size: number;
}

export interface ApplicationFirmwareParseRequest {
    productId: string;
    url: string;
}

export interface ApplicationFirmwareInfo {
    releaseVersion: string;
    buildVersion: string;
    requiredJavaVersion: number;
    upgradeToVersions: string[];
}

export interface ApplicationFirmwareParseResult {
    version: string;
    metadata: {
        application: ApplicationFirmwareInfo;
        modules: Record<string, unknown>;
    };
}

export interface ApplicationFirmwareCreateRequest
    extends ApplicationFirmwareParseRequest {
    name: string;
    description?: string;
    i18nMessages?: I18nMessages;
    sign: string;
    signMethod: FirmwareSignMethod;
    size: number;
}
