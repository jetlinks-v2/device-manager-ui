import { computed, ref, type Ref } from 'vue';
import { Upload, type UploadChangeParam, type UploadFile, type UploadProps } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { onlyMessage } from '@jetlinks-web/utils';
import { useSystemStore } from '@jetlinks-web-core/store/system';
import { uploadByRequest } from '@jetlinks-web-core/components/Upload/utils';

interface ProtocolUploadResponse {
    result?: {
        id: string;
        others?: { accessKey?: string };
    };
}

interface ProtocolUploadEvents {
    onChange: (location: string) => void;
    onLoadingChange: (loading: boolean) => void;
}

/** 适配通用文件上传：协议配置需要服务器可访问的地址，不能直接保存文件 ID。 */
export function useProtocolFileUpload(modelValue: Readonly<Ref<string>>, events: ProtocolUploadEvents) {
    const { t: $t } = useI18n();
    const systemStore = useSystemStore();
    const loading = ref(false);
    const uploadedFile = ref<{ location: string; name: string }>();
    const fileList = computed<UploadFile[]>(() => modelValue.value ? [{
        uid: 'protocol-package',
        name: uploadedFile.value?.location === modelValue.value
            ? uploadedFile.value.name
            : $t('Save.FileUpload.currentPackage'),
        url: modelValue.value,
        status: 'done',
    }] : []);

    // JAR 的 MIME 在不同系统上不一致，按后缀校验，同时覆盖拖拽选择。
    const beforeUpload: UploadProps['beforeUpload'] = (file) => {
        if (!/\.(jar|zip)$/i.test(file.name)) {
            onlyMessage($t('Save.FileUpload.684757-1'), 'error');
            return Upload.LIST_IGNORE;
        }
        return true;
    };

    const handleChange = (info: UploadChangeParam<UploadFile<ProtocolUploadResponse>>) => {
        loading.value = info.file.status === 'uploading';
        events.onLoadingChange(loading.value);
        if (info.file.status !== 'done') return;

        const result = info.file.response?.result;
        // 缺少访问凭证时保留原配置，避免把不可访问的文件 ID 写入协议地址。
        if (!result?.id || !result.others?.accessKey) {
            onlyMessage($t('Save.FileUpload.684757-4'), 'error');
            return;
        }

        const basePath = systemStore.systemInfo.paths?.['base-path'] || '';
        const location = `${basePath}/file/${result.id}?accessKey=${encodeURIComponent(result.others.accessKey)}`;
        uploadedFile.value = { location, name: info.file.name };
        onlyMessage($t('Save.FileUpload.684757-2'), 'success');
        events.onChange(location);
    };

    const handleRemove = () => {
        uploadedFile.value = undefined;
        events.onChange('');
    };

    return { fileList, loading, beforeUpload, uploadRequest: uploadByRequest, handleChange, handleRemove };
}
