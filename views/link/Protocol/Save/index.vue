<template>
    <a-modal
        :title="protocolId ? $t('Save.index.903552-0') : $t('Save.index.903552-1')"
        :open="true"
        width="700px"
        :mask-closable="false"
        @cancel="handleCancel"
    >
        <a-form
            class="form"
            layout="vertical"
            :model="formData"
            name="basic"
            autocomplete="off"
            ref="formRef"
        >
            <a-form-item
                :label="$t('Save.index.903552-2')"
                name="name"
                :rules="[
                    { required: true, message: $t('Save.index.903552-3'), trigger: 'blur' },
                    { max: 64, message: $t('Save.index.903552-4') },
                ]"
            >
                <a-input
                    :placeholder="$t('Save.index.903552-3')"
                    v-model:value="formData.name"
                />
            </a-form-item>
            <a-form-item
                :label="$t('Save.index.903552-5')"
                name="type"
                :rules="[
                    { required: true, message: $t('Save.index.903552-6'), trigger: 'blur' },
                ]"
            >
                <!-- 新增/编辑统一：单行字体图标；新增可点击切换，编辑只读 -->
                <div
                    class="protocol-type-inline-row"
                    :class="{ 'protocol-type-inline-row--readonly': !!protocolId }"
                >
                    <span
                        v-for="t in displayTypes"
                        :key="t"
                        class="protocol-type-inline-item"
                        :class="{
                            'is-active': currentTypeId() === t,
                            'is-clickable': !protocolId,
                        }"
                        role="button"
                        :tabindex="protocolId ? -1 : 0"
                        @click="onTypeItemClick(t)"
                        @keydown.enter.prevent="onTypeItemClick(t)"
                        @keydown.space.prevent="onTypeItemClick(t)"
                    >
                        <AIcon :type="protocolTypeFontIcon(t)" class="protocol-type-inline-icon" />
                        <span>{{ typeLabel(t) }}</span>
                    </span>
                </div>
            </a-form-item>
            <a-form-item
                v-if="!isMarketplaceType"
                :label="$t('Save.index.903552-7')"
                :name="['configuration', 'location']"
                :rules="locationRules"
            >
                <p v-if="typeHint(currentTypeId())" class="protocol-type-hint">
                    {{ typeHint(currentTypeId()) }}
                </p>
                <a-input
                    v-if="currentTypeId() === 'local'"
                    :placeholder="$t('Save.index.903552-8')"
                    v-model:value="formData.configuration.location"
                />
                <FileUpload
                    v-else-if="currentTypeId() === 'jar'"
                    v-model:modelValue="formData.configuration.location"
                    @change="handleFileUploadChange"
                />
            </a-form-item>
            <a-form-item v-else class="marketplace-install-item">
                <div v-if="protocolId && hasMarketplacePackage" class="marketplace-package-panel">
                    <div class="marketplace-package-panel__label">
                        {{ $t('Save.index.marketplaceCurrentPackage', '当前协议包') }}
                    </div>
                    <div class="marketplace-package-panel__value">
                        <span class="marketplace-package-panel__name">{{ marketplacePackageName }}</span>
                        <span v-if="marketplacePackageVersion" class="marketplace-package-panel__version">
                            {{ marketplacePackageVersion }}
                        </span>
                    </div>
                </div>
                <a-button type="primary" class="marketplace-open-btn" @click="openMarketplaceInstall">
                    {{ $t('Save.index.marketplaceInstallOpenBtn', '从能力市场安装协议包') }}
                </a-button>
            </a-form-item>
            <a-form-item :label="$t('Save.index.903552-9')" name="description">
                <a-textarea
                    :placeholder="$t('Save.index.903552-10')"
                    v-model:value="formData.description"
                    :maxlength="200"
                    :rows="3"
                    showCount
                />
            </a-form-item>
        </a-form>
        <template #footer>
            <a-button key="back" @click="handleCancel">{{ $t('Save.index.903552-11') }}</a-button>
            <j-permission-button
                v-if="!isMarketplaceType || protocolId"
                key="submit"
                type="primary"
                :loading="loading"
                @click="handleOk"
                style="margin-left: 8px"
                :hasPermission="`link/Protocol:${protocolId ? 'update' : 'add'}`"
            >
                {{ $t('Save.index.903552-12') }}
            </j-permission-button>
        </template>
    </a-modal>
    <MarketplaceProtocolInstallModal
        v-model:visible="marketplaceInstallVisible"
        :install-payload="installPayload"
        :protocol-edit-mode="!!protocolId"
        :default-keyword="marketplacePackageId"
        @success="onMarketplaceInstallSuccess"
    />
</template>
<script lang="ts" setup>
import { onlyMessage } from '@jetlinks-web-core/utils/comm';
import type { UploadChangeParam, FormInstance } from 'ant-design-vue';
import FileUpload from './FileUpload.vue';
import MarketplaceProtocolInstallModal from '../components/MarketplaceProtocolInstallModal.vue';
import { save, update } from '../../../../api/link/protocol';
import { FormDataType } from '../type.d';
import { useI18n } from 'vue-i18n';
import { computed, watch } from 'vue';
import { useTabSaveSuccessBack } from '@jetlinks-web-core/hooks'
import { useProtocolTypeProviders } from '../useProtocolTypeProviders';
import { protocolTypeFontIcon } from '../protocolTypeAssets';
import { PROTOCOL_TYPE_ORDER } from '../protocolTypes';
import { cloneDeep } from 'lodash-es';

const { t: $t } = useI18n();
const loading = ref(false);
const fileLoading = ref(false);
const formRef = ref<FormInstance>();
const props = defineProps({
    data: {
        type: Object,
        default: () => {},
    },
});
const emit = defineEmits(['change']);

const editingRecord = ref<Record<string, any>>({});
const protocolId = computed(() => editingRecord.value?.id as string | undefined);

const { supportedTypes, typeLabel, coerceType, typeHint } = useProtocolTypeProviders();

const marketplaceInstallVisible = ref(false);
const marketplacePackageId = computed(() => {
    if (!protocolId.value) return '';
    const pkgId = formData.value.configuration?.pkgId;
    return typeof pkgId === 'string' ? pkgId.trim() : '';
});
const marketplacePackageName = computed(() => {
    if (!protocolId.value) return '';
    const pkgName = formData.value.configuration?.pkgName;
    return typeof pkgName === 'string' ? pkgName.trim() : '';
});
const marketplacePackageVersion = computed(() => {
    if (!protocolId.value) return '';
    const pkgVersion = formData.value.configuration?.pkgVersion;
    return typeof pkgVersion === 'string' ? pkgVersion.trim() : '';
});
const hasMarketplacePackage = computed(
    () => !!(marketplacePackageName.value || marketplacePackageVersion.value),
);

const installPayload = computed(() => ({
    name: formData.value.name,
    description: formData.value.description,
    ...(protocolId.value ? { id: protocolId.value } : {}),
}));

const formData = ref<FormDataType>({
    type: 'jar',
    name: '',
    configuration: {
        location: '',
    },
    description: '',
});

const locationRules = computed(() => {
    if (isMarketplaceType.value) return [];
    return [
        {
            required: true,
            message: $t('Save.index.903552-8'),
            trigger: 'blur',
        },
    ];
});

function currentTypeId(): string | undefined {
    const t = formData.value.type;
    if (typeof t === 'string') return t;
    if (Array.isArray(t) && t.length) {
        const x = t[0] as any;
        return typeof x === 'string' ? x : x?.value;
    }
    return undefined;
}

function createEmptyFormData(): FormDataType {
    return {
        type: 'jar',
        name: '',
        configuration: {
            location: '',
        },
        description: '',
    };
}

function normalizeTypeForForm(rawType: unknown): FormDataType['type'] {
    if (Array.isArray(rawType)) {
        return rawType
            .map((item: any) => (typeof item === 'string' ? item : item?.value))
            .filter((item) => item != null);
    }
    if (typeof rawType === 'string') {
        return rawType;
    }
    if ((rawType as any)?.value != null) {
        return String((rawType as any).value);
    }
    return 'jar';
}

function applyProtocolData(value?: Record<string, any>) {
    const nextRecord = cloneDeep(value || {});
    editingRecord.value = nextRecord;
    formData.value = {
        ...createEmptyFormData(),
        ...nextRecord,
        type: normalizeTypeForForm(nextRecord?.type),
        configuration: {
            location: '',
            ...(nextRecord?.configuration || {}),
        },
    };
}

const isMarketplaceType = computed(() => currentTypeId() === 'marketplace');

/** 编辑态：固定三种 + 可能的历史未知类型 */
const typeRowTypes = computed(() => {
    const cur = currentTypeId();
    const base = [...PROTOCOL_TYPE_ORDER] as string[];
    if (cur && !base.includes(cur)) {
        base.push(cur);
    }
    return base;
});

/** 新建：仅展示后端支持的类型，与编辑同一套视觉 */
const typePickTypes = computed(() => {
    let values = [...supportedTypes.value];
    const cur = currentTypeId();
    if (cur && !values.includes(cur as any)) {
        values = [...values, cur];
    }
    return values;
});

const displayTypes = computed(() =>
    protocolId.value ? typeRowTypes.value : typePickTypes.value,
);

function onTypeItemClick(t: string) {
    if (protocolId.value) return;
    if (currentTypeId() === t) return;
    formData.value.type = t;
    formData.value.configuration.location = '';
    formRef.value?.validateFields(['type']).catch(() => {});
}

watch(
    supportedTypes,
    () => {
        if (protocolId.value || !supportedTypes.value.length) return;
        const next = coerceType(currentTypeId());
        if (next !== currentTypeId()) {
            formData.value.type = next;
            formData.value.configuration.location = '';
        }
    },
    { immediate: true },
);

const { onBack } = useTabSaveSuccessBack()

function normalizeTypeForSubmit(): string {
    const t = formData.value.type;
    if (typeof t === 'string') return t;
    if (Array.isArray(t) && t.length) {
        const x = t[0] as any;
        return typeof x === 'string' ? x : x?.value ?? 'jar';
    }
    return 'jar';
}

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
    emit('change', true);
};

const onSubmit = async () => {
    const data: any = await formRef.value?.validate();
    loading.value = true;
    const type = normalizeTypeForSubmit();
    const payload = {
        name: data.name,
        description: data.description,
        type,
        configuration: data.configuration ?? formData.value.configuration,
    };
    const response: any = !protocolId.value
        ? await save(payload).catch(() => {})
        : await update(protocolId.value!, {
              id: protocolId.value,
              ...payload,
          }).catch(() => {});
    if (response?.status === 200) {
        emit('change', response?.status === 200);
        if (response.result?.id) {
          onBack(response)
        }
    }
    loading.value = false;
};

const handleChange = (info: UploadChangeParam) => {
    fileLoading.value = true;
    if (info.file.status === 'done') {
        onlyMessage($t('Save.index.903552-13'), 'success');
        const result = info.file.response?.result;
        formData.value.configuration.location = result;
        fileLoading.value = false;
    }
};

const handleFileUploadChange = () => {
    formRef.value?.validate()
};

const handleOk = () => {
    if (isMarketplaceType.value && !protocolId.value) {
        openMarketplaceInstall();
        return;
    }
    onSubmit();
};
const handleCancel = () => {
    emit('change', false);
};

watch(
    () => props.data,
    (value: any) => {
        applyProtocolData(value);
    },
    { immediate: true, deep: true },
);
</script>

<style lang="less" scoped>
.protocol-type-hint {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
    line-height: 1.5;
    margin: 0 0 8px;
}
.protocol-type-inline-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
.protocol-type-inline-row--readonly .protocol-type-inline-item {
    cursor: default;
}
.protocol-type-inline-item {
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
.protocol-type-inline-item.is-clickable {
    cursor: pointer;
}
.protocol-type-inline-item.is-clickable:hover:not(.is-active) {
    border-color: rgba(0, 0, 0, 0.2);
    background: rgba(0, 0, 0, 0.04);
}
.protocol-type-inline-item.is-active {
    border-color: @primary-color;
    color: @primary-color;
    background: fade(@primary-color, 8%);
}
.protocol-type-inline-icon {
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
    background: linear-gradient(180deg, rgba(22, 119, 255, 0.06), rgba(22, 119, 255, 0.02));
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
.form {
    .form-upload-button {
        margin-top: 10px;
    }
    .form-submit {
        background-color: @primary-color !important;
    }
}
</style>
