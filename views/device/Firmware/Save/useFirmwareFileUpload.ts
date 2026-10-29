import { ref, watch, type Ref } from 'vue';
import { notification, type UploadChangeParam, type UploadFile } from 'ant-design-vue';
import { onlyMessage } from '@jetlinks-web/utils';
import { useI18n } from 'vue-i18n';
import { useSystemStore } from '@jetlinks-web-core/store/system';

interface FirmwareFileInfo {
    id: string;
    length: number;
    md5?: string;
    sha256?: string;
    others: { accessKey: string };
}

interface FirmwareUploadResponse {
    success?: boolean;
    message?: string;
    result?: FirmwareFileInfo;
}

interface FirmwareUploadEvents {
    onValueChange: (value: string) => void;
    onExtraValueChange: (value?: FirmwareFileInfo) => void;
    onUploadingChange: (value: boolean) => void;
}

/** 将通用上传结果适配为手工固件所需的访问地址与文件元信息。 */
export function useFirmwareFileUpload(modelValue: Readonly<Ref<string>>, events: FirmwareUploadEvents) {
    const { t: $t } = useI18n();
    const systemStore = useSystemStore();
    const uploading = ref(false);
    const fileList = ref<UploadFile[]>([]);
    let uploadedFile: { url: string; name: string } | undefined;

    const syncFileList = () => {
        const url = modelValue.value;
        fileList.value = url ? [{
            uid: 'firmware-file',
            name: uploadedFile?.url === url
                ? uploadedFile.name
                : url.split('?')[0].split('/').pop() || url,
            url,
            status: 'done',
        }] : [];
    };
    // 解析回退与编辑回显以外层表单地址为准。
    watch(modelValue, syncFileList, { immediate: true });

    const setUploading = (value: boolean) => {
        uploading.value = value;
        events.onUploadingChange(value);
    };

    const handleChange = (info: UploadChangeParam<UploadFile<FirmwareUploadResponse>>) => {
        if (!info.file.status) return;
        setUploading(info.file.status === 'uploading');
        if (info.file.status === 'uploading') {
            fileList.value = info.fileList.slice(-1);
            return;
        }
        if (info.file.status === 'error') {
            // 公共组件提示请求失败，保留原地址、元信息与文件回显以便重试。
            syncFileList();
            return;
        }
        if (info.file.status !== 'done') return;

        const response = info.file.response;
        const result = response?.result;
        if (response?.success === false || !result?.id || !result.others?.accessKey || typeof result.length !== 'number') {
            syncFileList();
            notification.error({
                message: $t('Application.FileUpload.385271-2'),
                description: response?.message || $t('Application.FileUpload.385271-3'),
            });
            return;
        }
        const basePath = systemStore.systemInfo.paths?.['base-path'] || '';
        const url = `${basePath}/file/${result.id}?accessKey=${encodeURIComponent(result.others.accessKey)}`;
        uploadedFile = { url, name: info.file.name };
        fileList.value = [{ ...info.file, url }];
        events.onValueChange(url);
        events.onExtraValueChange(result);
        onlyMessage($t('Application.FileUpload.385271-4'), 'success');
    };

    const handleRemove = () => {
        uploadedFile = undefined;
        fileList.value = [];
        setUploading(false);
        events.onValueChange('');
        events.onExtraValueChange();
    };

    return { fileList, uploading, handleChange, handleRemove };
}
