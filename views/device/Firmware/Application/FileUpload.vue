<template>
    <a-upload
        name="file"
        accept=".jar,.zip"
        :action="FileStaticPath()"
        :headers="getUploadHeaders()"
        :file-list="fileList"
        :max-count="1"
        :disabled="props.disabled || uploading"
        :before-upload="beforeUpload"
        @change="handleChange"
        @remove="handleRemove"
    >
        <a-button :loading="uploading" :disabled="props.disabled">
            <template #icon><AIcon type="UploadOutlined" /></template>
            {{ $t('Application.FileUpload.385271-0') }}
        </a-button>
    </a-upload>
</template>

<script setup lang="ts" name="ApplicationFirmwareFileUpload">
import { FileStaticPath } from '@jetlinks-web-core/api/comm';
import { getUploadHeaders, onlyMessage } from '@jetlinks-web-core/utils/comm';
import { notification as Notification } from 'ant-design-vue';
import type { UploadChangeParam, UploadProps } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import type {
    ApplicationFirmwareFile,
    FirmwareUploadResult,
} from '../type';

interface UploadResponse {
    success?: boolean;
    message?: string;
    result?: FirmwareUploadResult;
}

const { t: $t } = useI18n();
const props = defineProps({
    disabled: {
        type: Boolean,
        default: false,
    },
});
const emit = defineEmits<{
    (event: 'change', value?: ApplicationFirmwareFile): void;
    (event: 'update:uploading', value: boolean): void;
}>();

const fileList = ref<UploadProps['fileList']>([]);
const uploading = ref(false);

const setUploading = (value: boolean) => {
    uploading.value = value;
    emit('update:uploading', value);
};

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const valid = extension === 'jar' || extension === 'zip';
    if (!valid) {
        onlyMessage($t('Application.FileUpload.385271-1'), 'error');
    }
    return valid;
};

const clearFile = () => {
    fileList.value = [];
    setUploading(false);
    emit('change', undefined);
};

const handleRemove = () => {
    clearFile();
    return true;
};

const handleChange = (info: UploadChangeParam) => {
    if (!info.file.status) {
        return;
    }
    fileList.value = info.fileList.slice(-1);
    if (info.file.status === 'uploading') {
        setUploading(true);
        return;
    }
    if (info.file.status === 'done') {
        const response = info.file.response as UploadResponse | undefined;
        const result = response?.result;
        if (
            response?.success === false ||
            !result?.accessUrl ||
            !result.sha256 ||
            typeof result.length !== 'number'
        ) {
            Notification.error({
                message: $t('Application.FileUpload.385271-2'),
                description:
                    response?.message ||
                    $t('Application.FileUpload.385271-3'),
            });
            clearFile();
            return;
        }
        // Application 固件固定提交文件服务返回的 SHA256 摘要，避免用户手工选择后不一致。
        emit('change', {
            url: result.accessUrl,
            sign: result.sha256,
            signMethod: 'SHA256',
            size: result.length,
        });
        setUploading(false);
        onlyMessage($t('Application.FileUpload.385271-4'), 'success');
        return;
    }
    if (info.file.status === 'error') {
        const response = info.file.response as UploadResponse | undefined;
        Notification.error({
            message: $t('Application.FileUpload.385271-2'),
            description:
                response?.message || $t('Application.FileUpload.385271-3'),
        });
        clearFile();
    }
};
</script>
