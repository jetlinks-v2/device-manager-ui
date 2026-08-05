<template>
    <a-modal
        :open="true"
        :title="$t('Application.index.385271-0')"
        :ok-text="$t('Application.index.385271-1')"
        :cancel-text="$t('Application.index.385271-2')"
        :confirm-loading="submitting"
        :ok-button-props="{ disabled: okDisabled }"
        :mask-closable="false"
        width="700px"
        @ok="handleOk"
        @cancel="handleCancel"
    >
        <a-form layout="vertical" :model="formData">
            <a-form-item
                :label="$t('Application.index.385271-3')"
                v-bind="validateInfos.name"
            >
                <a-input
                    v-model:value="formData.name"
                    :maxlength="64"
                    :placeholder="$t('Application.index.385271-4')"
                />
            </a-form-item>
            <a-form-item
                :label="$t('Application.index.385271-5')"
                v-bind="validateInfos.productId"
            >
                <a-select
                    v-model:value="formData.productId"
                    :options="props.productOptions"
                    :placeholder="$t('Application.index.385271-6')"
                    allow-clear
                    show-search
                    :filter-option="filterOption"
                    @change="handleProductChange"
                />
            </a-form-item>
            <a-form-item
                :label="$t('Application.index.385271-7')"
                :extra="
                    formData.productId
                        ? $t('Application.index.385271-8')
                        : $t('Application.index.385271-9')
                "
            >
                <FileUpload
                    :disabled="!formData.productId"
                    v-model:uploading="uploading"
                    @change="handleFileChange"
                />
            </a-form-item>
            <a-form-item :label="$t('Application.index.385271-10')">
                <a-spin v-if="parsing" :tip="$t('Application.index.385271-11')" />
                <a-descriptions
                    v-else-if="preview"
                    bordered
                    size="small"
                    :column="2"
                >
                    <a-descriptions-item
                        :label="$t('Application.index.385271-12')"
                    >
                        {{ preview.releaseVersion }}
                    </a-descriptions-item>
                    <a-descriptions-item
                        :label="$t('Application.index.385271-13')"
                    >
                        {{ preview.buildVersion }}
                    </a-descriptions-item>
                    <a-descriptions-item
                        :label="$t('Application.index.385271-14')"
                    >
                        {{ preview.requiredJavaVersion }}
                    </a-descriptions-item>
                    <a-descriptions-item
                        :label="$t('Application.index.385271-15')"
                    >
                        <a-space wrap>
                            <a-tag
                                v-for="version in preview.upgradeToVersions"
                                :key="version"
                            >
                                {{ version }}
                            </a-tag>
                        </a-space>
                    </a-descriptions-item>
                </a-descriptions>
                <a-alert
                    v-else
                    type="info"
                    show-icon
                    :message="$t('Application.index.385271-16')"
                />
            </a-form-item>
            <a-form-item
                :label="$t('Application.index.385271-17')"
                v-bind="validateInfos.description"
            >
                <a-textarea
                    v-model:value="formData.description"
                    :maxlength="200"
                    :rows="3"
                    show-count
                    :placeholder="$t('Application.index.385271-18')"
                />
            </a-form-item>
        </a-form>
    </a-modal>
</template>

<script setup lang="ts" name="ApplicationFirmwareSave">
import { Form } from 'ant-design-vue';
import type { SelectProps } from 'ant-design-vue';
import type { PropType } from 'vue';
import { onlyMessage } from '@jetlinks-web-core/utils/comm';
import { useI18n } from 'vue-i18n';
import {
    parseApplicationFirmware,
    saveApplicationFirmware,
} from '../../../../api/firmware';
import FileUpload from './FileUpload.vue';
import type {
    ApplicationFirmwareFile,
    ApplicationFirmwareInfo,
    FirmwareProductOption,
} from '../type';

const props = defineProps({
    productOptions: {
        type: Array as PropType<FirmwareProductOption[]>,
        default: () => [],
    },
});
const emit = defineEmits<{
    (event: 'change', saved: boolean): void;
    (event: 'fallback'): void;
}>();
const { t: $t } = useI18n();

const formData = reactive({
    name: '',
    productId: undefined as string | undefined,
    description: '',
});
const file = ref<ApplicationFirmwareFile>();
const preview = ref<ApplicationFirmwareInfo>();
const uploading = ref(false);
const parsing = ref(false);
const submitting = ref(false);
let parseRequestId = 0;

const { validate, validateInfos } = Form.useForm(
    formData,
    reactive({
        name: [
            { required: true, message: $t('Application.index.385271-4') },
            { max: 64, message: $t('Application.index.385271-19') },
        ],
        productId: [
            { required: true, message: $t('Application.index.385271-6') },
        ],
        description: [
            { max: 200, message: $t('Application.index.385271-20') },
        ],
    }),
);

const okDisabled = computed(
    () => uploading.value || parsing.value || !file.value || !preview.value,
);

const filterOption: SelectProps['filterOption'] = (input, option) =>
    String(option?.label || '')
        .toLowerCase()
        .includes(input.toLowerCase());

const resetPreview = () => {
    parseRequestId += 1;
    preview.value = undefined;
    parsing.value = false;
};

const fallbackToManual = (requestId: number) => {
    if (requestId === parseRequestId) {
        // 当前交互不区分解析无结果与错误，统一回到原手工创建。
        preview.value = undefined;
        emit('fallback');
    }
};

const parseFirmware = async () => {
    if (!formData.productId || !file.value) {
        return;
    }
    const currentRequestId = ++parseRequestId;
    parsing.value = true;
    try {
        const response = await parseApplicationFirmware({
            productId: formData.productId,
            url: file.value.url,
        });
        // 产品或文件切换后，只接收最后一次解析结果，避免展示过期版本。
        if (currentRequestId === parseRequestId) {
            const application = response.status === 200
                ? response.result?.metadata.application
                : undefined;
            if (application) {
                preview.value = application;
            } else {
                fallbackToManual(currentRequestId);
            }
        }
    } catch {
        fallbackToManual(currentRequestId);
    } finally {
        if (currentRequestId === parseRequestId) {
            parsing.value = false;
        }
    }
};

const handleProductChange = () => {
    resetPreview();
    void parseFirmware();
};

const handleFileChange = (value?: ApplicationFirmwareFile) => {
    file.value = value;
    resetPreview();
    void parseFirmware();
};

const handleOk = async () => {
    if (!file.value || !preview.value) {
        return;
    }
    const values = await validate().catch(() => undefined);
    if (!values?.productId) {
        return;
    }
    submitting.value = true;
    try {
        const response = await saveApplicationFirmware({
            productId: values.productId,
            name: values.name,
            description: values.description || undefined,
            url: file.value.url,
            sign: file.value.sign,
            signMethod: file.value.signMethod,
            size: file.value.size,
        });
        if (response.status === 200) {
            onlyMessage(
                $t('Application.index.385271-21', { name: values.name }),
                'success',
            );
            emit('change', true);
        }
    } finally {
        submitting.value = false;
    }
};

const handleCancel = () => emit('change', false);
</script>
