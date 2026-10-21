import { isCancel } from 'axios';
import type { UploadProps } from 'ant-design-vue';
import { uploadApplicationFirmware } from '../../../../api/firmware';

export const uploadFirmware: NonNullable<UploadProps['customRequest']> = (options) => {
    const controller = new AbortController();
    const formData = new FormData();
    formData.append(options.filename || 'file', options.file as Blob);

    void uploadApplicationFirmware(formData, {
        signal: controller.signal,
        onUploadProgress: (event) => {
            if (event.total) {
                options.onProgress?.({ percent: event.loaded / event.total * 100 });
            }
        },
    }).then((response) => {
        options.onSuccess?.(response);
    }).catch((error: unknown) => {
        if (isCancel(error)) {
            return;
        }
        options.onError?.(error as Error);
    });

    return { abort: () => controller.abort() };
};
