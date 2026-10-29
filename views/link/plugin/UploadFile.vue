<template>
    <CoreFileUpload
        :value="fileList"
        accept=".jar,.zip"
        :size="Infinity"
        :multiple="false"
        :max-count="1"
        :disabled="props.disabled || props.uploading || uploading"
        :before-upload="beforeUpload"
        :custom-request="uploadPluginFile"
        drag
        @upload-change="handleChange"
        @remove="handleRemove"
    />
</template>

<script setup lang="ts" name="PluginFileUpload">
import { FileUpload as CoreFileUpload } from '@jetlinks-web-core/components';
import { uploadPluginFile } from '../../../api/link/plugin';
import { usePluginFileUpload } from './usePluginFileUpload';

const props = defineProps({
    modelValue: {
        type: String,
        default: '',
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    fileName: {
        type: String,
        default: undefined,
    },
    uploading: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(['update:modelValue', 'change', 'update:uploading']);
const { fileList, uploading, beforeUpload, handleChange, handleRemove } =
    usePluginFileUpload(props.fileName, {
        onChange: (result) => {
            emit('update:modelValue', result?.version || '');
            emit('change', result || {});
        },
        onUploadingChange: (value) => emit('update:uploading', value),
    });
</script>
