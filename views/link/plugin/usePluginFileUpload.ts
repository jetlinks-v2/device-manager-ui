import { ref } from 'vue';
import { Upload, notification, type UploadChangeParam, type UploadFile, type UploadProps } from 'ant-design-vue';
import { onlyMessage } from '@jetlinks-web/utils';
import { useI18n } from 'vue-i18n';
import type { FileUploadResult } from './typings';

interface PluginUploadResponse {
    success?: boolean;
    message?: string;
    result?: FileUploadResult & { message?: string };
}

interface PluginUploadEvents {
    onChange: (result?: FileUploadResult) => void;
    onUploadingChange: (uploading: boolean) => void;
}

/** 适配公共文件上传与插件解析结果，失败时保留已选插件包及表单数据。 */
export function usePluginFileUpload(fileName: string | undefined, events: PluginUploadEvents) {
    const { t: $t } = useI18n();
    const uploading = ref(false);
    const fileList = ref<UploadFile[]>(fileName ? [{
        uid: 'plugin-package',
        name: fileName,
        status: 'done',
    }] : []);
    let uploadedFiles = [...fileList.value];

    const setUploading = (value: boolean) => {
        uploading.value = value;
        events.onUploadingChange(value);
    };

    // JAR 的 MIME 随系统变化，点击和拖拽均按后缀校验；拒绝时保留已有文件。
    const beforeUpload: UploadProps['beforeUpload'] = (file) => {
        if (!/\.(jar|zip)$/i.test(file.name)) {
            onlyMessage($t('plugin.UploadFile.628586-3'), 'error');
            return Upload.LIST_IGNORE;
        }
        return true;
    };

    const handleChange = (info: UploadChangeParam<UploadFile<PluginUploadResponse>>) => {
        if (info.file.status === 'uploading') {
            fileList.value = info.fileList.slice(-1);
            setUploading(true);
            return;
        }
        if (info.file.status === 'done') {
            setUploading(false);
            const response = info.file.response;
            const result = response?.result;
            // 版本和地址必须来自插件解析接口，异常响应不能覆盖原有插件配置。
            if (response?.success === false || !result?.version || !result.accessUrl) {
                fileList.value = [...uploadedFiles];
                notification.error({
                    message: $t('plugin.UploadFile.628586-5'),
                    description: response?.message || result?.message || $t('plugin.UploadFile.628586-5'),
                });
                return;
            }
            fileList.value = info.fileList.slice(-1);
            uploadedFiles = [...fileList.value];
            events.onChange(result);
            onlyMessage($t('plugin.UploadFile.628586-4'), 'success');
        } else if (info.file.status === 'error') {
            // 公共组件负责请求失败提示，这里恢复文件列表并解除提交禁用。
            fileList.value = [...uploadedFiles];
            setUploading(false);
        }
    };

    const handleRemove = () => {
        fileList.value = [];
        uploadedFiles = [];
        setUploading(false);
        events.onChange();
    };

    return { fileList, uploading, beforeUpload, handleChange, handleRemove };
}
