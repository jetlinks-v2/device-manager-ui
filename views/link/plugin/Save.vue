<template>
    <a-modal
        :maskClosable="false"
        :open="true"
        :title="pluginId ? $t('plugin.Save.128565-0') : $t('plugin.Save.128565-1')"
        :confirmLoading="loading || uploading"
        @ok="handleSave"
        @cancel="handleCancel"
        width="650px"
    >
        <div>
            <a-form :layout="'vertical'" ref="formRef" :model="modelRef">
                <a-form-item v-if="showIdField" name="id" :rules="IdRules">
                    <template #label>
                        <span>
                            {{ $t('plugin.Save.128565-2') }}
                            <a-tooltip :title="$t('plugin.Save.128565-3')">
                                <AIcon
                                    type="QuestionCircleOutlined"
                                    style="margin-left: 2px"
                                />
                            </a-tooltip>
                        </span>
                    </template>
                    <a-input
                        :placeholder="$t('plugin.Save.128565-4')"
                        v-model:value="modelRef.id"
                        :disabled="!!pluginId"
                    />
                </a-form-item>
                <a-form-item :label="$t('plugin.Save.128565-5')" name="name" :rules="nameRules">
                    <a-input
                        :placeholder="$t('plugin.Save.128565-6')"
                        v-model:value="modelRef.name"
                    />
                </a-form-item>
                <a-form-item
                    :label="$t('plugin.Save.providerLabel', '来源')"
                    name="provider"
                    :rules="providerRules"
                >
                    <p v-if="providerHint(currentProviderId())" class="plugin-provider-hint">
                        {{ providerHint(currentProviderId()) }}
                    </p>
                    <div
                        class="plugin-provider-inline-row"
                        :class="{ 'plugin-provider-inline-row--readonly': !!pluginId }"
                    >
                        <span
                            v-for="provider in displayProviders"
                            :key="provider"
                            class="plugin-provider-inline-item"
                            :class="{
                                'is-active': currentProviderId() === provider,
                                'is-clickable': !pluginId,
                            }"
                            role="button"
                            :tabindex="pluginId ? -1 : 0"
                            @click="onProviderItemClick(provider)"
                            @keydown.enter.prevent="onProviderItemClick(provider)"
                            @keydown.space.prevent="onProviderItemClick(provider)"
                        >
                            <AIcon
                                :type="pluginProviderFontIcon(provider)"
                                class="plugin-provider-inline-icon"
                            />
                            <span>{{ providerLabel(provider) }}</span>
                        </span>
                    </div>
                </a-form-item>
                <a-form-item
                    v-if="!isMarketplaceProvider"
                    :label="$t('plugin.Save.128565-7')"
                    name="version"
                    :rules="versionRule"
                >
                    <UploadFile
                        v-model:modelValue="modelRef.version"
                        v-model:uploading="uploading"
                        @change="uploadChange"
                        :fileName="modelRef.filename"
                    />
                </a-form-item>
                <a-form-item v-else class="marketplace-install-item">
                    <div
                        v-if="pluginId && hasMarketplacePackage"
                        class="marketplace-package-panel"
                    >
                        <div class="marketplace-package-panel__label">
                            {{ $t('plugin.Save.marketplaceCurrentPackage', '当前插件包') }}
                        </div>
                        <div class="marketplace-package-panel__value">
                            <span class="marketplace-package-panel__name">
                                {{ marketplacePackageName }}
                            </span>
                            <span
                                v-if="marketplacePackageVersion"
                                class="marketplace-package-panel__version"
                            >
                                {{ marketplacePackageVersion }}
                            </span>
                        </div>
                    </div>
                    <a-button
                        type="primary"
                        class="marketplace-open-btn"
                        @click="openMarketplaceInstall"
                    >
                        {{ marketplaceOpenButtonText }}
                    </a-button>
                </a-form-item>
                <div v-if="!isMarketplaceProvider && modelRef.version" class="file-detail">
                    <div>
                        <span>{{ $t('plugin.Save.128565-8') }}</span>
                        <span class="file-detail-item">{{
                            getPluginTypeLabel(modelRef.type)
                        }}</span>
                    </div>
                    <div>
                        <span>{{ $t('plugin.Save.128565-9') }}</span>
                        <span class="file-detail-item">{{
                            modelRef.version
                        }}</span>
                    </div>
                </div>
                <a-form-item
                    :label="$t('plugin.Save.128565-10')"
                    name="description"
                    :rules="Max_Length_200"
                >
                    <a-textarea
                        v-model:value="modelRef.description"
                        :placeholder="$t('plugin.Save.128565-11')"
                        showCount
                        :maxlength="200"
                    />
                </a-form-item>
            </a-form>
        </div>
    </a-modal>
    <MarketplacePluginInstallModal
        v-model:visible="marketplaceInstallVisible"
        :install-payload="installPayload"
        :plugin-edit-mode="!!pluginId"
        :default-keyword="marketplacePackageId"
        @success="onMarketplaceInstallSuccess"
    />
</template>

<script setup lang="ts" name="PluginSave">
import { computed, watch } from 'vue';
import {
    ID_Rule,
    Max_Length_64,
    Max_Length_200,
    RequiredStringFn,
} from '../components/Form/rules';
import UploadFile from './UploadFile.vue';
import MarketplacePluginInstallModal from './components/MarketplacePluginInstallModal.vue';
import { FileUploadResult } from '../plugin/typings';
import { add, update, vailIdFn } from '../../../api/link/plugin';
import { getPluginTypeLabel } from './util';
import { onlyMessage } from '@jetlinks-web-core/utils/comm';
import { useI18n } from 'vue-i18n';
import { useTabSaveSuccessBack } from '@jetlinks-web-core/hooks';
import { usePluginProviderTypes } from './usePluginProviderTypes';
import { pluginProviderFontIcon } from './pluginProviderAssets';
import { PLUGIN_PROVIDER_ORDER } from './pluginProviders';

const { t: $t } = useI18n();
const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
});

const emit = defineEmits(['cancel', 'ok']);
const formRef = ref();
const loading = ref(false);
const uploading = ref(false);
const marketplaceInstallVisible = ref(false);

const { onBack } = useTabSaveSuccessBack();
const { supportedProviders, providerLabel, providerHint, coerceProvider } =
    usePluginProviderTypes();

const pluginId = computed(() => props.data?.id as string | undefined);

const modelRef = reactive<any>({
    id: props.data.id,
    name: props.data.name,
    description: props.data.description,
    type: props.data.type,
    provider: props.data.provider || 'jar',
    version: props.data.version,
    filename: props.data.filename,
    configuration: { ...(props.data.configuration || {}) },
});

const vailId = async (_: any, value: string) => {
    if (!pluginId.value && value) {
        const resp = await vailIdFn(value);
        if (resp.success && resp.result && !resp.result.passed) {
            return Promise.reject($t('plugin.Save.128565-12'));
        }
    }
    return Promise.resolve();
};

const nameRules = [RequiredStringFn($t('plugin.Save.128565-5')), ...Max_Length_64];

const providerRules = [
    {
        required: true,
        message: $t('plugin.Save.providerRequired', '请选择来源'),
        trigger: 'change',
    },
];

const IdRules = [
    ...ID_Rule,
    {
        validator: vailId,
        trigger: 'blur',
    },
];

const versionRule = [
    {
        required: true,
        message: $t('plugin.Save.128565-13'),
        trigger: 'blur',
    },
];

function currentProviderId(): string | undefined {
    const provider = modelRef.provider;
    return provider == null || provider === '' ? undefined : String(provider);
}

function resolvePluginTypeId(type: unknown): string | undefined {
    if (!type) {
        return undefined;
    }
    if (typeof type === 'string') {
        return type;
    }
    if (typeof type === 'object') {
        const value = (type as any).value ?? (type as any).id ?? (type as any).type;
        return value == null || value === '' ? undefined : String(value);
    }
    return undefined;
}

function getResponseMessage(error: any, fallback: string) {
    const response = error?.response?.data || error?.data || error;
    return (
        response?.message ||
        response?.result?.message ||
        error?.message ||
        fallback
    );
}

function isFormValidationError(error: any) {
    return Array.isArray(error?.errorFields) || Array.isArray(error?.errors);
}

const isMarketplaceProvider = computed(
    () => currentProviderId()?.toLowerCase() === 'marketplace',
);

const showIdField = computed(() => !!pluginId.value || !isMarketplaceProvider.value);

const marketplacePackageId = computed(() => {
    if (!pluginId.value) return '';
    const pkgId = modelRef.configuration?.pkgId;
    return typeof pkgId === 'string' ? pkgId.trim() : '';
});

const marketplacePackageName = computed(() => {
    if (!pluginId.value) return '';
    const pkgName = modelRef.configuration?.pkgName;
    return typeof pkgName === 'string' ? pkgName.trim() : '';
});

const marketplacePackageVersion = computed(() => {
    if (!pluginId.value) return '';
    const pkgVersion = modelRef.configuration?.pkgVersion;
    return typeof pkgVersion === 'string' ? pkgVersion.trim() : '';
});

const hasMarketplacePackage = computed(
    () => !!(marketplacePackageName.value || marketplacePackageVersion.value),
);

const marketplaceOpenButtonText = computed(() =>
    pluginId.value
        ? $t('plugin.Save.marketplaceUpgradeOpenBtn', '从能力市场升级')
        : $t('plugin.Save.marketplaceInstallOpenBtn', '从能力市场安装插件包'),
);

const installPayload = computed(() => ({
    name: modelRef.name,
    description: modelRef.description,
    ...(pluginId.value ? { id: pluginId.value } : {}),
    ...(modelRef.type ? { type: modelRef.type } : {}),
    provider: 'marketplace',
}));

/** 编辑态：固定 provider 顺序 + 可能的历史未知 provider */
const providerRowTypes = computed(() => {
    const cur = currentProviderId();
    const base = [...PLUGIN_PROVIDER_ORDER] as string[];
    if (cur && !base.includes(cur)) {
        base.push(cur);
    }
    return base;
});

/** 新建：仅展示当前 UI 支持且后端开放的 provider */
const providerPickTypes = computed(() => {
    let values = [...supportedProviders.value];
    const cur = currentProviderId();
    if (cur && !values.includes(cur as any)) {
        values = [...values, cur as any];
    }
    return values;
});

const displayProviders = computed(() =>
    pluginId.value ? providerRowTypes.value : providerPickTypes.value,
);

function resetSourceState() {
    if (pluginId.value) return;
    modelRef.version = undefined;
    modelRef.filename = undefined;
    modelRef.type = undefined;
    const next = { ...(modelRef.configuration || {}) };
    delete next.location;
    delete next.pkgId;
    delete next.pkgName;
    delete next.pkgVersion;
    modelRef.configuration = next;
}

function onProviderItemClick(provider: string) {
    if (pluginId.value) return;
    if (currentProviderId() === provider) return;
    modelRef.provider = provider;
    resetSourceState();
    formRef.value?.validateFields(['provider']).catch(() => {});
}

watch(
    supportedProviders,
    () => {
        if (pluginId.value || !supportedProviders.value.length) return;
        const next = coerceProvider(currentProviderId());
        if (next !== currentProviderId()) {
            modelRef.provider = next;
            resetSourceState();
        }
    },
    { immediate: true },
);

const uploadChange = (data: FileUploadResult) => {
    modelRef.type =
        resolvePluginTypeId(data?.type) ||
        resolvePluginTypeId((data as any)?.others?.type) ||
        modelRef.type;
    modelRef.filename = data.filename;
    modelRef.configuration = {
        ...(modelRef.configuration || {}),
        location: data.accessUrl,
    };
};

const openMarketplaceInstall = async () => {
    try {
        await formRef.value?.validateFields(['name']);
        marketplaceInstallVisible.value = true;
    } catch {
        /* 校验未通过 */
    }
};

const onMarketplaceInstallSuccess = () => {
    marketplaceInstallVisible.value = false;
    emit('ok');
};

const handleSave = async () => {
    if (isMarketplaceProvider.value && !pluginId.value) {
        openMarketplaceInstall();
        return;
    }

    try {
        const data = await formRef.value.validate();
        if (data) {
            loading.value = true;
            const payload = {
                id: modelRef.id ? modelRef.id : null,
                name: data.name,
                description: data.description,
                type: modelRef.type,
                provider: currentProviderId(),
                version: modelRef.version,
                filename: modelRef.filename,
                configuration: { ...(modelRef.configuration || {}) },
            };
            const resp = pluginId.value
                ? await update(payload)
                : await add(payload);
            if (resp?.success) {
                onlyMessage($t('plugin.Save.128565-14'));
                onBack(resp);
                emit('ok');
                formRef.value.resetFields();
                return;
            }
            onlyMessage(
                resp?.message || $t('plugin.Save.128565-15', '保存失败'),
                'error',
            );
        }
    } catch (error: any) {
        if (isFormValidationError(error)) {
            return;
        }
        const message = getResponseMessage(
            error,
            $t('plugin.Save.128565-15', '保存失败'),
        );
        if (message) {
            onlyMessage(message, 'error');
        }
    } finally {
        loading.value = false;
    }
};

const handleCancel = () => {
    emit('cancel');
};
</script>

<style scoped lang="less">
.plugin-provider-hint {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
    line-height: 1.5;
    margin: 0 0 8px;
}

.plugin-provider-inline-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}

.plugin-provider-inline-row--readonly .plugin-provider-inline-item {
    cursor: default;
}

.plugin-provider-inline-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    background: rgba(0, 0, 0, 0.02);
    color: rgba(0, 0, 0, 0.65);
    font-size: 13px;
    line-height: 1.2;
    user-select: none;
    transition:
        border-color 0.2s,
        background 0.2s,
        color 0.2s;
}

.plugin-provider-inline-item.is-clickable {
    cursor: pointer;
}

.plugin-provider-inline-item.is-clickable:hover:not(.is-active) {
    border-color: rgba(0, 0, 0, 0.2);
    background: rgba(0, 0, 0, 0.04);
}

.plugin-provider-inline-item.is-active {
    border-color: @primary-color;
    color: @primary-color;
    background: fade(@primary-color, 8%);
}

.plugin-provider-inline-icon {
    font-size: 16px;
}

.marketplace-install-item :deep(.ant-form-item-control-input-content) {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
}

.marketplace-package-panel {
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(22, 119, 255, 0.12);
    background: linear-gradient(
        180deg,
        rgba(22, 119, 255, 0.06),
        rgba(22, 119, 255, 0.02)
    );
}

.marketplace-package-panel__label {
    margin-bottom: 6px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
    line-height: 1.2;
}

.marketplace-package-panel__value {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}

.marketplace-package-panel__name {
    color: rgba(0, 0, 0, 0.88);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
}

.marketplace-package-panel__version {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(22, 119, 255, 0.08);
    color: #0958d9;
    font-size: 12px;
    line-height: 18px;
}

.marketplace-open-btn {
    margin-top: 0;
    display: inline-flex;
    align-items: center;
}

.file-detail {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 16px;

    .file-detail-item {
        color: #4f4f4f;
    }
}
</style>
