<template>
    <!-- 外层表单校验的是上传完成后的地址，隔离上传过程中的文件列表变化。 -->
    <a-form-item-rest>
        <CoreFileUpload
            :value="fileList"
            accept=".jar,.zip"
            :size="Infinity"
            :multiple="false"
            :disabled="loading"
            :btn-text="$t('Save.FileUpload.dropPlaceholder')"
            :before-upload="beforeUpload"
            :custom-request="uploadRequest"
            drag
            @upload-change="handleChange"
            @remove="handleRemove"
        />
    </a-form-item-rest>
</template>

<script setup lang="ts" name="FileUpload">
import { toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { FileUpload as CoreFileUpload } from '@jetlinks-web-core/components';
import { useProtocolFileUpload } from './useProtocolFileUpload';

const { t: $t } = useI18n();
const props = defineProps({
    modelValue: {
        type: String,
        default: '',
    },
});

const emit = defineEmits(['update:modelValue', 'loadingChange', 'change']);
const { fileList, loading, beforeUpload, uploadRequest, handleChange, handleRemove } =
    useProtocolFileUpload(toRef(props, 'modelValue'), {
        onChange: (location) => {
            emit('update:modelValue', location);
            emit('change', location);
        },
        onLoadingChange: (value) => emit('loadingChange', value),
    });
</script>
